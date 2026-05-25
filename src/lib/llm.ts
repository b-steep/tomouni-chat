/**
 * LLM provider 切替
 * dev (LLM_PROVIDER=ollama) → ローカルOllama
 * prod (LLM_PROVIDER=google) → 直接 Google Gemini 2.5 Flash
 *
 * 設計書 §11.2 参照
 *
 * モデル選定の経緯:
 *   - gemini-2.0-flash: 無料枠 limit:0 エラー（APIキーのプロジェクト制限）
 *   - gemini-1.5-flash: v1beta APIで廃止済み（not found）
 *   - gemini-2.5-flash: 2026年現在の最新・安定モデル ✅
 */
import { createOllama } from "ollama-ai-provider-v2";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { gateway } from "@ai-sdk/gateway";
import type { LanguageModel } from "ai";

/** 環境変数で上書き可能。デフォルトは gemini-2.5-flash */
const DEFAULT_GOOGLE_MODEL = "gemini-2.5-flash";

export function getModel(): LanguageModel {
  const provider = process.env.LLM_PROVIDER ?? "google";

  if (provider === "ollama") {
    const ollama = createOllama({
      baseURL: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/api",
    });
    return ollama(process.env.OLLAMA_MODEL ?? "qwen2.5:7b");
  }

  // google / gateway / その他すべて → 直接 Gemini API に接続
  // (Vercel AI Gateway はクレジットカード未登録でブロックされるためバイパス)
  const google = createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  });
  return google(process.env.GOOGLE_MODEL ?? DEFAULT_GOOGLE_MODEL);
}

export function getModelLabel(): string {
  const provider = process.env.LLM_PROVIDER ?? "google";
  if (provider === "ollama") {
    return `ollama/${process.env.OLLAMA_MODEL ?? "qwen2.5:7b"}`;
  }
  return `google/${process.env.GOOGLE_MODEL ?? DEFAULT_GOOGLE_MODEL}`;
}
