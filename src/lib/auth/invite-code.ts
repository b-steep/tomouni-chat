/**
 * 招待コード照合
 * invite_codes テーブルから有効なコードを検索
 *
 * 照合条件: code一致 + is_active=true + expires_at > now() + used_count < max_uses
 *
 * 回数チェック:
 *   - max_uses が NULL → 無制限（後方互換）
 *   - max_uses が数値 → used_count < max_uses の場合のみ有効
 *
 * インクリメント:
 *   RPC `increment_invite_code_usage` で排他ロック付きインクリメント
 *   （同時リクエストで max_uses を超えないようにする）
 */
import { createAdminClient } from "@/lib/supabase/admin";

export interface InviteCodeResult {
  valid: boolean;
  error?: string;
}

/**
 * 招待コードを照合する
 * @param code ユーザーが入力したコード
 * @returns valid=true なら認証成功
 */
export async function verifyInviteCode(code: string): Promise<InviteCodeResult> {
  if (!code || code.trim().length === 0) {
    return { valid: false, error: "コードを入力してください" };
  }

  const trimmed = code.trim().toUpperCase();

  const admin = createAdminClient();
  if (!admin) {
    const diagUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const diagKey = process.env.SUPABASE_SECRET_KEY;
    console.error("[invite-code] Supabase admin client unavailable", {
      urlSet: !!diagUrl,
      urlLen: diagUrl?.length ?? 0,
      keySet: !!diagKey,
      keyLen: diagKey?.length ?? 0,
    });
    return { valid: false, error: `サーバーエラー(admin=null, url=${!!diagUrl}, key=${!!diagKey})` };
  }

  try {
    // Step 1: コードの存在・有効性チェック
    // NOTE: max_uses / used_count は migration 004 適用後に有効化する
    const { data, error } = await admin
      .from("invite_codes")
      .select("id, code, expires_at")
      .eq("code", trimmed)
      .eq("is_active", true)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (error) {
      console.error("[invite-code] Supabase query error:", error);
      return { valid: false, error: `サーバーエラー(query: ${error.message})` };
    }

    if (!data) {
      return { valid: false, error: "招待コードが無効です。コードを確認してください。" };
    }

    // Step 2: 回数制限チェック（migration 004 適用後に有効化）
    // max_uses / used_count カラムが存在しない場合はスキップ
    // if (data.max_uses !== null && data.used_count >= data.max_uses) {
    //   return { valid: false, error: "この招待コードの利用上限に達しました。" };
    // }

    // Step 3: 排他ロック付きインクリメント（migration 004 適用後に有効化）
    // RPC `increment_invite_code_usage` は migration 004 で作成
    // const { data: incremented, error: rpcError } = await admin
    //   .rpc("increment_invite_code_usage", { p_code: trimmed });
    // if (rpcError) { ... }

    return { valid: true };
  } catch (e) {
    console.error("[invite-code] unexpected error:", e);
    return { valid: false, error: `サーバーエラー(catch: ${e instanceof Error ? e.message : String(e)})` };
  }
}
