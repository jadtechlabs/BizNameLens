import { createHmac, timingSafeEqual } from "crypto";
import type { NextRequest, NextResponse } from "next/server";
import { PLANS, type PaidPlanKey, type PlanKey } from "./plans";
import { stripeConfigured, verifySubscription } from "./stripe";

export const USAGE_COOKIE = "bnl_usage";
export const ENTITLEMENT_COOKIE = "bnl_entitlement";

const VERIFY_EVERY_MS = 6 * 60 * 60 * 1000;
const BILLING_GRACE_MS = 7 * 24 * 60 * 60 * 1000;
const COOKIE_MAX_AGE = 400 * 24 * 60 * 60;

type UsagePayload = {
  v: 1;
  plan: PlanKey;
  period: string;
  count: number;
};

export type EntitlementPayload = {
  v: 1;
  plan: PaidPlanKey;
  customerId: string;
  subscriptionId: string;
  verifiedAt: number;
};

export type UsageStatus = {
  plan: PlanKey;
  planName: string;
  used: number;
  limit: number;
  remaining: number;
  cadence: "lifetime" | "month";
  period: string;
  paywall: boolean;
};

type Resolution = {
  status: UsageStatus;
  usageToken?: string;
  entitlementToken?: string | null;
};

function signingSecret() {
  const configured = process.env.USAGE_SIGNING_SECRET?.trim() || process.env.STRIPE_SECRET_KEY?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") return "biznamelens-development-only-secret";
  throw new Error("USAGE_SIGNING_SECRET is required in production.");
}

function signPayload(payload: object) {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", signingSecret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function readPayload<T>(token: string | undefined): T | null {
  if (!token) return null;
  try {
    const [body, provided] = token.split(".");
    if (!body || !provided) return null;
    const expected = createHmac("sha256", signingSecret()).update(body).digest("base64url");
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function expectedPeriod(plan: PlanKey) {
  return plan === "free" ? "lifetime" : currentMonth();
}

export function createEntitlementToken(payload: Omit<EntitlementPayload, "v">) {
  return signPayload({ v: 1, ...payload } satisfies EntitlementPayload);
}

export function readEntitlement(request: NextRequest) {
  const payload = readPayload<EntitlementPayload>(request.cookies.get(ENTITLEMENT_COOKIE)?.value);
  if (!payload || payload.v !== 1 || !payload.subscriptionId || !payload.customerId) return null;
  if (!PLANS[payload.plan] || payload.plan === "free") return null;
  return payload;
}

async function resolvePlan(request: NextRequest): Promise<{
  plan: PlanKey;
  entitlementToken?: string | null;
}> {
  const entitlement = readEntitlement(request);
  if (!entitlement) return { plan: "free" };

  const age = Date.now() - entitlement.verifiedAt;
  if (age < VERIFY_EVERY_MS) return { plan: entitlement.plan };

  if (!stripeConfigured()) {
    return age < BILLING_GRACE_MS ? { plan: entitlement.plan } : { plan: "free", entitlementToken: null };
  }

  try {
    const verified = await verifySubscription(entitlement.subscriptionId);
    if (!verified.active || !verified.plan) return { plan: "free", entitlementToken: null };
    const refreshed: EntitlementPayload = {
      v: 1,
      plan: verified.plan,
      customerId: verified.customerId || entitlement.customerId,
      subscriptionId: entitlement.subscriptionId,
      verifiedAt: Date.now(),
    };
    return { plan: refreshed.plan, entitlementToken: signPayload(refreshed) };
  } catch {
    return age < BILLING_GRACE_MS ? { plan: entitlement.plan } : { plan: "free", entitlementToken: null };
  }
}

function usageFor(request: NextRequest, plan: PlanKey) {
  const period = expectedPeriod(plan);
  const payload = readPayload<UsagePayload>(request.cookies.get(USAGE_COOKIE)?.value);
  if (!payload || payload.v !== 1 || payload.plan !== plan || payload.period !== period || !Number.isFinite(payload.count)) {
    return { period, count: 0 };
  }
  return { period, count: Math.max(0, Math.floor(payload.count)) };
}

function makeStatus(plan: PlanKey, period: string, used: number): UsageStatus {
  const definition = PLANS[plan];
  const safeUsed = Math.max(0, Math.floor(used));
  return {
    plan,
    planName: definition.name,
    used: safeUsed,
    limit: definition.searchLimit,
    remaining: Math.max(0, definition.searchLimit - safeUsed),
    cadence: definition.cadence,
    period,
    paywall: safeUsed >= definition.searchLimit,
  };
}

export async function getUsageStatus(request: NextRequest): Promise<Resolution> {
  const resolved = await resolvePlan(request);
  const usage = usageFor(request, resolved.plan);
  return {
    status: makeStatus(resolved.plan, usage.period, usage.count),
    entitlementToken: resolved.entitlementToken,
  };
}

export async function consumeSearch(request: NextRequest): Promise<Resolution & { allowed: boolean }> {
  const resolved = await getUsageStatus(request);
  if (resolved.status.paywall) return { ...resolved, allowed: false };

  const nextCount = resolved.status.used + 1;
  const nextPayload: UsagePayload = {
    v: 1,
    plan: resolved.status.plan,
    period: resolved.status.period,
    count: nextCount,
  };

  return {
    ...resolved,
    allowed: true,
    status: makeStatus(resolved.status.plan, resolved.status.period, nextCount),
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
  if (resolution.entitlementToken === null) {
    response.cookies.set(ENTITLEMENT_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
  } else if (resolution.entitlementToken) {
    response.cookies.set(ENTITLEMENT_COOKIE, resolution.entitlementToken, cookieOptions());
  }
}

export function setEntitlementCookie(response: NextResponse, token: string) {
  response.cookies.set(ENTITLEMENT_COOKIE, token, cookieOptions());
  response.cookies.set(USAGE_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
}
