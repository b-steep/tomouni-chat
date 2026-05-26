/**
 * POST /api/chat — TOMO チャット用 Route Handler
 *
 * 多層防御 (Phase 0):
 *   層1: CSRF guard (Origin/Referer 検証)
 *   層2: Cookie 二重チェック (middleware 非依存)
 *   層3: BAN check (Upstash Redis スコア合算)
 *   層4: 入力長制限 (2000字以下)
 *   層5: Prompt Injection regex 検知
 *   層6: Rate Limit 3段 (per-IP 5/min, per-anon 20/day, global 400/day)
 *   層7: コスト天井 (maxOutputTokens=1024, stopWhen=stepCountIs(3))
 *   層8: PII Redaction → question_analytics INSERT
 *
 * dev = ローカル Ollama / prod = AI Gateway 経由 Gemini
 * 履歴は Supabase env が設定されていれば onFinish で保存。
 */
import type { UIMessage } from "ai";
import { streamText, convertToModelMessages, stepCountIs } from "ai";
import { z } from "zod";
import { getModel, getModelLabel } from "@/lib/llm";
import { getSystemPrompt } from "@/lib/prompts/system";
import { guardCsrf } from "@/lib/csrf";
import { checkMultiRatelimit } from "@/lib/ratelimit";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifySessionCookie } from "@/lib/auth/cookie";
import { checkBan, extractIpSlash24 } from "@/lib/security/ban-check";
import { checkPromptInjection } from "@/lib/security/patterns";
import { redactPii } from "@/lib/analytics/pii-redact";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

const MAX_INPUT_CHARS = 2000;
const COOKIE_NAME = "tomouni_session";

const BodySchema = z.object({
  id: z.string().optional(),
  messages: z.array(z.unknown()).min(1).max(50),
  trigger: z.string().optional(),
  messageId: z.string().optional(),
});

function extractLastUserText(messages: UIMessage[]): string {
  const last = [...messages].reverse().find((m) => m.role === "user");
  if (!last) return "";
  return last.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { type: "text"; text: string }).text)
    .join("");
}

function getIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
}

export async function POST(req: Request) {
  // ── 層1: CSRF guard ──
  const csrfRes = guardCsrf(req);
  if (csrfRes) return csrfRes;

  // ── 層2: Cookie 二重チェック (middleware 非依存) ──
  const cookieHeader = req.headers.get("cookie") ?? "";
  const cookieMatch = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));
  const cookieValue = cookieMatch?.split("=").slice(1).join("=") ?? "";

  const session = cookieValue ? await verifySessionCookie(cookieValue) : null;
  if (!session) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const anonId = session.anonId;
  const ip = getIp(req);
  const ipSlash24 = extractIpSlash24(ip);

  // ── 層3: BAN check ──
  const banResult = await checkBan({ anonId, ipSlash24 });
  if (banResult.banned) {
    return Response.json(
      { error: "access_denied", reason: banResult.reason },
      { status: 403 },
    );
  }

  // ── body parse ──
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const messages = parsed.data.messages as UIMessage[];
  const chatId = parsed.data.id;

  // ── 層4: 入力長 ──
  const lastUserText = extractLastUserText(messages);
  if (lastUserText.length > MAX_INPUT_CHARS) {
    return Response.json(
      { error: "input_too_long", limit: MAX_INPUT_CHARS },
      { status: 413 },
    );
  }
  if (lastUserText.trim().length === 0) {
    return Response.json({ error: "empty_input" }, { status: 400 });
  }

  // ── 層5: Prompt Injection 検知 ──
  const injection = checkPromptInjection(lastUserText);
  if (injection.blocked) {
    console.warn(`[chat] prompt injection detected: ${injection.matches.join(", ")} | anonId=${anonId}`);
    return Response.json(
      { error: "invalid_input", message: "申し訳ありませんが、その質問にはお答えできません。" },
      { status: 400 },
    );
  }

  // ── 層6: Rate Limit 3段 ──
  const rate = await checkMultiRatelimit(ip, anonId);
  if (!rate.success) {
    const message =
      rate.blockedBy === "global"
        ? "現在アクセスが集中しています。しばらくしてからお試しください。"
        : rate.blockedBy === "per_anon"
          ? "本日の利用上限に達しました。明日またお越しください🐾"
          : "リクエストが多すぎます。少し時間をおいてください。";
    return Response.json(
      { error: "rate_limited", message, blockedBy: rate.blockedBy, reset: rate.reset },
      {
        status: 429,
        headers: { "X-RateLimit-Reset": String(rate.reset) },
      },
    );
  }

  // ── AI 呼び出し ──
  const model = getModel();
  const modelLabel = getModelLabel();
  const startedAt = Date.now();

  try {
    const modelMessages = await convertToModelMessages(messages);
    const result = streamText({
      model,
      system: getSystemPrompt(),
      messages: modelMessages,
      stopWhen: stepCountIs(3),
      // 日本語は 1文字 ≒ 1-2 tokens のため 1024 だと 500-800 文字で打ち切られる。
      // Gemini Flash は output 上限に余裕がありコストも低いため 4096 に引き上げ。
      // 再発検知のため onFinish で finishReason='length' を必ずログ出力する。
      maxOutputTokens: 4096,
      temperature: 0.7,
    });

    // クライアント切断時も onFinish を確実に発火させるため背景でstream消費
    result.consumeStream();

    return result.toUIMessageStreamResponse({
      originalMessages: messages,
      onFinish: async ({ responseMessage, finishReason }) => {
        // 出力上限到達は UX を壊すので必ず可視化する (Sentry/console)
        if (finishReason === "length") {
          console.warn(
            `[chat] response truncated by maxOutputTokens. ` +
              `anonId=${anonId} chatId=${chatId} model=${modelLabel}`,
          );
        }
        const admin = createAdminClient();

        // ── 履歴保存 ──
        if (admin && chatId) {
          try {
            await admin.from("tomouni_chat_sessions").upsert(
              {
                id: chatId,
                last_seen_at: new Date().toISOString(),
                ip_hash: null,
                user_agent: req.headers.get("user-agent") ?? null,
                referrer: req.headers.get("referer") ?? null,
              },
              { onConflict: "id" },
            );

            const userMsg = [...messages].reverse().find((m) => m.role === "user");
            const rows = [];
            if (userMsg) {
              rows.push({
                session_id: chatId,
                role: "user",
                parts: userMsg.parts,
                model: null,
              });
            }
            rows.push({
              session_id: chatId,
              role: "assistant",
              parts: responseMessage.parts,
              model: modelLabel,
              duration_ms: Date.now() - startedAt,
            });
            await admin.from("tomouni_chat_messages").insert(rows);
          } catch (e) {
            console.error("[chat] supabase save failed:", e);
          }
        }

        // ── 層8: PII Redaction → question_analytics INSERT ──
        if (admin && lastUserText) {
          try {
            const piiResult = redactPii(lastUserText);
            await admin.from("question_analytics").insert({
              anon_id: anonId,
              pii_redacted_content: piiResult.redacted,
              pii_flag: piiResult.hasPii,
            });
          } catch (e) {
            console.error("[chat] question_analytics insert failed:", e);
          }
        }
      },
    });
  } catch (e) {
    console.error("[chat] stream failed:", e);
    return Response.json(
      {
        error: "stream_failed",
        message: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
}

