/**
 * GET /api/health — 環境変数診断エンドポイント
 * 値は返さず、設定有無と長さのみ返す
 * ⚠ デプロイ後に動作確認できたら削除すること
 */
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

  return Response.json({
    ok: allSet,
    timestamp: new Date().toISOString(),
    node_env: process.env.NODE_ENV,
    env_vars: status,
  });
}
