import type { NextRequest, NextResponse } from "next/server";

export const TURNSTILE_COOKIE = "bnl_turnstile";
export const TURNSTILE_ACTION = "name-search";
export const TURNSTILE_TEST_SITE_KEY = "1x00000000000000000000AA";
const TURNSTILE_TEST_SECRET_KEY = "1x0000000000000000000000000000000AA";
const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

type TurnstileResponse = {
  success?: boolean;
  hostname?: string;
  action?: string;
  "error-codes"?: string[];
};

function secretKey() {
  const configured = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") return TURNSTILE_TEST_SECRET_KEY;
  return "";
}

export function turnstileSiteKey() {
  const configured = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") return TURNSTILE_TEST_SITE_KEY;
  return "";
}

export function turnstileConfigured() {
  return Boolean(secretKey() && turnstileSiteKey());
}

export function readTurnstileToken(request: NextRequest) {
  const raw = request.cookies.get(TURNSTILE_COOKIE)?.value;
  if (!raw) return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function clearTurnstileCookie(response: NextResponse) {
  response.cookies.set(TURNSTILE_COOKIE, "", {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

function requesterIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || undefined;
}

export async function verifyTurnstileToken(request: NextRequest, token: string) {
  const secret = secretKey();
  if (!secret) {
    return { ok: false, reason: "Human verification is not configured." };
  }

  if (!token) {
    return { ok: false, reason: "Complete the human verification to continue." };
  }

  try {
    const payload = new URLSearchParams({
      secret,
      response: token,
    });
    const ip = requesterIp(request);
    if (ip) payload.set("remoteip", ip);

    const response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: payload,
      signal: AbortSignal.timeout(6000),
    });

    if (!response.ok) {
      return { ok: false, reason: `Human verification returned ${response.status}.` };
    }

    const result = (await response.json()) as TurnstileResponse;
    if (!result.success) {
      return { ok: false, reason: "Human verification failed or expired. Please try again." };
    }

    if (result.action && result.action !== TURNSTILE_ACTION && result.action !== "test") {
      return { ok: false, reason: "Human verification action did not match this request." };
    }

    const expectedHostname = request.nextUrl.hostname;
    if (
      process.env.NODE_ENV === "production" &&
      result.hostname &&
      result.hostname.toLowerCase() !== expectedHostname.toLowerCase()
    ) {
      return { ok: false, reason: "Human verification hostname did not match this site." };
    }

    return { ok: true, reason: "verified" };
  } catch {
    return { ok: false, reason: "Human verification could not be validated. Please try again." };
  }
}
