import { createHmac, timingSafeEqual } from "crypto";
import type { NextRequest, NextResponse } from "next/server";
import { PLANS } from "./plans";

export const USAGE_COOKIE = "bnl_usage";
export const CAPTCHA_AFTER_FREE_SEARCHES = 3;
const COOKIE_MAX_AGE = 400 * 24 * 60 * 60;

type UsagePayload = {
  v: 1;
  period: "lifetime";
  count: number;
};

export type UsageStatus = {
  plan: "free";
  planName: string;
  used: number;
  limit: number;
  remaining: number;
  cadence: "lifetime";
  period: "lifetime";
  paywall: boolean;
  challengeRequired: boolean;
  challengeAfter: number;
};

type Resolution = {
  status: UsageStatus;
  usageToken?: string;
};

function signingSecret() {
  const configured = process.env.USAGE_SIGNING_SECRET?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") return "biznamelens-development-only-secret";
  throw new Error("USAGE_SIGNING_SECRET is required in production.");
}

function signPayload(payload: UsagePayload) {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", signingSecret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function readPayload(token: string | undefined): UsagePayload | null {
  if (!token) return null;
  try {
    const [body, provided] = token.split(".");
    if (!body || !provided) return null;
    const expected = createHmac("sha256", signingSecret()).update(body).digest("base64url");
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as UsagePayload;
    if (parsed.v !== 1 || parsed.period !== "lifetime" || !Number.isFinite(parsed.count)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function makeStatus(used: number): UsageStatus {
  const definition = PLANS.free;
  const safeUsed = Math.max(0, Math.floor(used));
  const paywall = safeUsed >= definition.searchLimit;
  return {
    plan: "free",
    planName: definition.name,
    used: safeUsed,
    limit: definition.searchLimit,
    remaining: Math.max(0, definition.searchLimit - safeUsed),
    cadence: "lifetime",
    period: "lifetime",
    paywall,
    challengeRequired: !paywall && safeUsed >= CAPTCHA_AFTER_FREE_SEARCHES,
    challengeAfter: CAPTCHA_AFTER_FREE_SEARCHES,
  };
}

export function getUsageStatus(request: NextRequest): Resolution {
  const payload = readPayload(request.cookies.get(USAGE_COOKIE)?.value);
  return { status: makeStatus(payload?.count ?? 0) };
}

export function consumeSearch(request: NextRequest): Resolution & { allowed: boolean } {
  const resolved = getUsageStatus(request);
  if (resolved.status.paywall) return { ...resolved, allowed: false };

  const nextCount = resolved.status.used + 1;
  const nextPayload: UsagePayload = {
    v: 1,
    period: "lifetime",
    count: nextCount,
  };

  return {
    allowed: true,
    status: makeStatus(nextCount),
    usageToken: signPayload(nextPayload),
  };
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  };
}

export function applyUsageCookies(response: NextResponse, resolution: Resolution) {
  if (resolution.usageToken) {
    response.cookies.set(USAGE_COOKIE, resolution.usageToken, cookieOptions());
  }
}
