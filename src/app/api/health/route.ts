/**
 * GET /api/health — 環境変数診断エンドポイント
 * 値は返さず、設定有無と長さのみ返す
 * ⚠ デプロイ後に動作確認できたら削除すること
 */
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const vars = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SECRET_KEY",
    "COOKIE_HMAC_SECRET",
    "LLM_PROVIDER",
    "RATELIMIT_ENABLED",
  ];

  const status = vars.map((name) => {
    const val = process.env[name];
    return {
      name,
      set: !!val,
      length: val?.length ?? 0,
      prefix: val ? val.substring(0, 4) + "..." : "(empty)",
    };
  });

  const allSet = status.every((s) => s.set);

  // Supabase接続テスト
  let supabaseTest = "not_tested";
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (url && key) {
      const client = createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data, error } = await client
        .from("invite_codes")
        .select("id")
        .limit(1);
      if (error) {
        supabaseTest = `error: ${error.message} (code: ${error.code})`;
      } else {
        supabaseTest = `ok: ${data?.length ?? 0} rows`;
      }
    } else {
      supabaseTest = "missing_env";
    }
  } catch (e) {
    supabaseTest = `catch: ${e instanceof Error ? e.message : String(e)}`;
  }

  return Response.json({
    ok: allSet,
    timestamp: new Date().toISOString(),
    node_env: process.env.NODE_ENV,
    env_vars: status,
    supabase_test: supabaseTest,
  });
}
