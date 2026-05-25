/**
 * LLM provider 切替
 * dev (LLM_PROVIDER=ollama) → ローカルOllama
 * prod (LLM_PROVIDER=google) → 直接 Google Gemini 2.0 Flash (AI Gateway バイパス)
 *
 * 設計書 §11.2 参照
 */
import { createOllama } from "ollama-ai-provider-v2";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { gateway } from "@ai-sdk/gateway";
import type { LanguageModel } from "ai";

export function getModel(): LanguageModel {
  const provider = process.env.LLM_PROVIDER ?? "google";

  if (provider === "ollama") {
    const ollama = createOllama({
      baseURL: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/api",
    });
    return ollama(process.env.OLLAMA_MODEL ?? "qwen2.5:7b");
  }

  if (provider === "google") {
    const google = createGoogleGenerativeAI({
      apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    });
    return google(process.env.GOOGLE_MODEL ?? "gemini-1.5-flash-latest");
  }

  // production (gateway): Vercel AI Gateway 経由
  if (provider === "gateway") {
    // クレジットカード未登録による Vercel AI Gateway エラーを回避するため直接 Gemini にバイパス接続
    const google = createGoogleGenerativeAI({
      apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    });
    return google(process.env.GOOGLE_MODEL ?? "gemini-1.5-flash-latest");
  }

  // デフォルトで直接 Gemini に接続
  const google = createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  });
  return google(process.env.GOOGLE_MODEL ?? "gemini-1.5-flash-latest");
}

export function getModelLabel(): string {
  const provider = process.env.LLM_PROVIDER ?? "google";
  if (provider === "ollama") {
    return `ollama/${process.env.OLLAMA_MODEL ?? "qwen2.5:7b"}`;
  }
  if (provider === "google") {
    return `google/${process.env.GOOGLE_MODEL ?? "gemini-1.5-flash-latest"}`;
  }
  return process.env.GATEWAY_MODEL ?? "google/gemini-1.5-flash-latest";
}
