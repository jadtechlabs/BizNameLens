import { NextRequest, NextResponse } from "next/server";
import { getUsageStatus, applyUsageCookies } from "../../../lib/usage";
import { stripeConfigured } from "../../../lib/stripe";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const resolution = await getUsageStatus(request);
    const response = NextResponse.json({
      ...resolution.status,
      billingConfigured: stripeConfigured(),
    });
    applyUsageCookies(response, resolution);
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to read usage status." },
      { status: 500 },
    );
  }
}
