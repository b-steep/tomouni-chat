/**
 * CSRF guard (Origin/Referer 検証)
 * 設計書 §10.1 層1 — isai-intelligence/lib/csrf.ts を簡略移植
 *
 * Phase 1 (dev) では localhost / preview URL を許可する。
 * 本番は ALLOWED_ORIGINS を絞り込む。
 */

function getAllowedOrigins(): string[] {
  const list = new Set<string>();

  // dev
  list.add("http://localhost:3000");
  list.add("http://127.0.0.1:3000");

  // Vercel が現在のデプロイメントに対して自動で吐く URL
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) list.add(`https://${vercelUrl}`);

  // Vercel の安定 production alias (例: tomouni-chat-peach.vercel.app)
  const productionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (productionUrl) list.add(`https://${productionUrl}`);

  // 本番カスタムドメイン (設計書 §15.2)
  list.add("https://chat.b-steep.com");
  list.add("https://tomouni-chat.vercel.app");
  list.add("https://tomouni-chat-peach.vercel.app");

  // 追加オリジン (環境変数で渡せる)
  const extra = process.env.ALLOWED_ORIGINS;
  if (extra) {
    for (const o of extra.split(",")) {
      const trimmed = o.trim();
      if (trimmed) list.add(trimmed);
    }
  }

  return Array.from(list);
}

export function guardCsrf(req: Request): Response | null {
  // GET/HEAD は素通し
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return null;

  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");

  // dev: localhost / 127.0.0.1 の任意ポートを許可 (next dev が 3000 と限らないので)
  if (process.env.NODE_ENV !== "production") {
    const url = origin ?? referer ?? "";
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(url)) return null;
  }

  const allowed = getAllowedOrigins();
  const ok =
    (origin && allowed.includes(origin)) ||
    (referer && allowed.some((a) => referer.startsWith(a)));

  if (!ok) {
    return new Response(JSON.stringify({ error: "CSRF: invalid origin" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }
  return null;
}
