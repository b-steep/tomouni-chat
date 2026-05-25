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
    const isPublicUrl = name === "NEXT_PUBLIC_SUPABASE_URL";
    return {
      name,
      set: !!val,
      length: val?.length ?? 0,
      trimmed_length: val?.trim().length ?? 0,
      has_whitespace: val ? (/\s/.test(val) || val !== val.trim()) : false,
      prefix: isPublicUrl ? val : (val ? val.trim().substring(0, 4) + "..." : "(empty)"),
    };
  });

  const allSet = status.every((s) => s.set);

  // Supabase接続テスト — SDKとfetch両方で診断
  let supabaseTest = "not_tested";
  let rawFetchTest = "not_tested";
  try {
    const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const rawKey = process.env.SUPABASE_SECRET_KEY;
    if (rawUrl && rawKey) {
      const url = rawUrl.trim();
      const key = rawKey.trim();
      // Test 1: SDK
      const client = createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data, error } = await client
        .from("invite_codes")
        .select("id")
        .limit(1);
      if (error) {
        supabaseTest = `error: ${error.message} (code: ${error.code}, details: ${error.details}, hint: ${error.hint})`;
      } else {
        supabaseTest = `ok: ${data?.length ?? 0} rows`;
      }

      // Test 2: Raw fetch
      const resp = await fetch(`${url}/rest/v1/invite_codes?select=id&limit=1`, {
        headers: {
          "apikey": key,
          "Authorization": `Bearer ${key}`,
        },
      });
      const body = await resp.text();
      rawFetchTest = `status=${resp.status}, body=${body.substring(0, 200)}`;
    } else {
      supabaseTest = "missing_env";
      rawFetchTest = "missing_env";
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
    raw_fetch_test: rawFetchTest,
  });
}
