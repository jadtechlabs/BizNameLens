import { NextRequest, NextResponse } from "next/server";
import { stripeRequest } from "../../../../lib/stripe";
import { readEntitlement } from "../../../../lib/usage";

export const runtime = "nodejs";

type PortalSession = { url?: string };

function siteOrigin(request: NextRequest) {
  const configured = process.env.APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  return request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  const entitlement = readEntitlement(request);
  if (!entitlement) {
    return NextResponse.json({ error: "No active paid plan was found on this device." }, { status: 401 });
  }

  try {
    const params = new URLSearchParams();
    params.set("customer", entitlement.customerId);
    params.set("return_url", `${siteOrigin(request)}/#pricing`);

    const session = await stripeRequest<PortalSession>("/billing_portal/sessions", {
      method: "POST",
      body: params,
    });

    if (!session.url) throw new Error("Stripe did not return a billing portal URL.");
    return NextResponse.json({ url: session.url });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to open billing management." },
      { status: 502 },
    );
  }
}
