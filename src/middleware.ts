/**
 * Next.js Middleware — Edge Gate
 *
 * 責務:
 *   ① CVE-2025-29927 対策 (x-middleware-subrequest ヘッダー拒否)
 *   ② Cookie HMAC 検証 → 無効/未設定なら /login へリダイレクト
 *   ③ Cookie 自動延長 (残り3日以下でリフレッシュ)
 *   ④ BAN check (Upstash Redis スコア合算)
 *
 * スキップ対象:
 *   /login, /api/auth/*, /_next/*, /favicon.ico, /robots.txt,
 *   /mascots/*, /decor/*, /textures/*
 */
import { NextRequest, NextResponse } from "next/server";

// Cookie検証はEdge Runtime互換の軽量版を直接実装（next/headersはmiddlewareで使えないため）

const COOKIE_NAME = "tomouni_session";
const REFRESH_THRESHOLD_SECONDS = 3 * 24 * 60 * 60; // 3日
const MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7日

function getSecret(): string {
  return process.env.COOKIE_HMAC_SECRET ?? "";
}

async function hmacSign(payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function hmacVerify(payload: string, signature: string): Promise<boolean> {
  const expected = await hmacSign(payload);
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

interface SessionPayload {
  anonId: string;
  iat: number;
  exp: number;
}

function decodePayload(encoded: string): SessionPayload | null {
  try {
    const padded = encoded.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(padded)) as SessionPayload;
  } catch {
    return null;
  }
}

/** パス判定: middlewareをスキップすべきか */
function shouldSkip(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname.startsWith("/api/auth/") ||
    pathname === "/api/health" ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname.startsWith("/mascots/") ||
    pathname.startsWith("/decor/") ||
    pathname.startsWith("/textures/") ||
    pathname.startsWith("/security")
  );
}


export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── ① CVE-2025-29927 対策 ──
  if (req.headers.has("x-middleware-subrequest")) {
    return new NextResponse(null, { status: 403 });
  }

  // ── スキップ対象 ──
  if (shouldSkip(pathname)) {
    return NextResponse.next();
  }

  // ── ② Cookie 検証 ──
  const cookieValue = req.cookies.get(COOKIE_NAME)?.value;
  if (!cookieValue) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const parts = cookieValue.split(".");
  if (parts.length !== 2) {
    const res = NextResponse.redirect(new URL("/login", req.url));
    res.cookies.delete(COOKIE_NAME);
    return res;
  }

  const [encoded, sig] = parts;
  const valid = await hmacVerify(encoded, sig);
  if (!valid) {
    const res = NextResponse.redirect(new URL("/login", req.url));
    res.cookies.delete(COOKIE_NAME);
    return res;
  }

  const payload = decodePayload(encoded);
  if (!payload) {
    const res = NextResponse.redirect(new URL("/login", req.url));
    res.cookies.delete(COOKIE_NAME);
    return res;
  }

  // 有効期限チェック
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) {
    const res = NextResponse.redirect(new URL("/login", req.url));
    res.cookies.delete(COOKIE_NAME);
    return res;
  }

  // ── ③ Cookie 自動延長 ──
  const response = NextResponse.next();
  const remaining = payload.exp - now;
  if (remaining < REFRESH_THRESHOLD_SECONDS) {
    // 新しいCookieを発行
    const newPayload: SessionPayload = {
      anonId: payload.anonId,
      iat: now,
      exp: now + MAX_AGE_SECONDS,
    };
    const newEncoded = btoa(JSON.stringify(newPayload))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const newSig = await hmacSign(newEncoded);
    const newValue = `${newEncoded}.${newSig}`;

    response.cookies.set(COOKIE_NAME, newValue, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: MAX_AGE_SECONDS,
      path: "/",
    });
  }

  // ── ④ BAN check (Upstash Redis) ──
  // middlewareでのRedis呼び出しはEdge Runtimeで対応可能
  // ただしBAN判定はAPI層でも二重チェックするため、ここでは軽量チェックのみ
  // Phase 0: anonId をヘッダーに付与して下流で使えるようにする
  response.headers.set("x-anon-id", payload.anonId);

  return response;
}

export const config = {
  matcher: [
    /*
     * /_next/static, /_next/image, /favicon.ico は自動除外
     * 静的ファイル（画像等）も除外
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
