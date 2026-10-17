import type { NextRequest } from "next/server";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const MINUTE_LIMIT = 6;
const HOUR_LIMIT = 30;
const MAX_TRACKED_IPS = 5_000;

type Bucket = {
  minuteStartedAt: number;
  minuteCount: number;
  hourStartedAt: number;
  hourCount: number;
  lastSeenAt: number;
};

type GlobalRateState = typeof globalThis & {
  __bizNameLensRateBuckets?: Map<string, Bucket>;
};

const globalState = globalThis as GlobalRateState;
const buckets = globalState.__bizNameLensRateBuckets ?? new Map<string, Bucket>();
globalState.__bizNameLensRateBuckets = buckets;

function clientIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.trim() || "unknown";
}

function cleanup(now: number) {
  if (buckets.size < MAX_TRACKED_IPS) return;
  for (const [key, bucket] of buckets) {
    if (now - bucket.lastSeenAt > HOUR_MS) buckets.delete(key);
    if (buckets.size < MAX_TRACKED_IPS) break;
  }
}

export function checkNameSearchRateLimit(request: NextRequest) {
  const now = Date.now();
  cleanup(now);
  const key = clientIp(request);
  const existing = buckets.get(key);
  const bucket: Bucket = existing ?? {
    minuteStartedAt: now,
    minuteCount: 0,
    hourStartedAt: now,
    hourCount: 0,
    lastSeenAt: now,
  };

  if (now - bucket.minuteStartedAt >= MINUTE_MS) {
    bucket.minuteStartedAt = now;
    bucket.minuteCount = 0;
  }
  if (now - bucket.hourStartedAt >= HOUR_MS) {
    bucket.hourStartedAt = now;
    bucket.hourCount = 0;
  }

  bucket.lastSeenAt = now;

  if (bucket.minuteCount >= MINUTE_LIMIT) {
    buckets.set(key, bucket);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((MINUTE_MS - (now - bucket.minuteStartedAt)) / 1000)),
      reason: "minute" as const,
    };
  }

  if (bucket.hourCount >= HOUR_LIMIT) {
    buckets.set(key, bucket);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((HOUR_MS - (now - bucket.hourStartedAt)) / 1000)),
      reason: "hour" as const,
    };
  }

  bucket.minuteCount += 1;
  bucket.hourCount += 1;
  buckets.set(key, bucket);
  return { allowed: true, retryAfterSeconds: 0, reason: null };
}
