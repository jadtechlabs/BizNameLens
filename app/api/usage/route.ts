import { NextRequest, NextResponse } from "next/server";
import { turnstileConfigured, turnstileSiteKey } from "../../../lib/turnstile";
import { getUsageStatus } from "../../../lib/usage";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const resolution = getUsageStatus(request);
    return NextResponse.json({
      ...resolution.status,
      billingConfigured: false,
      turnstileConfigured: turnstileConfigured(),
      turnstileSiteKey: turnstileSiteKey(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to read usage status." },
      { status: 500 },
    );
  }
}
