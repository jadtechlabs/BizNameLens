import { NextRequest, NextResponse } from "next/server";
import { isPaidPlanKey, priceIdForPlan } from "../../../../lib/plans";
import { stripeRequest } from "../../../../lib/stripe";

export const runtime = "nodejs";

type CheckoutSession = { url?: string };

function siteOrigin(request: NextRequest) {
  const configured = process.env.APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  return request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const plan = body?.plan;

  if (!isPaidPlanKey(plan)) {
    return NextResponse.json({ error: "Choose a valid paid plan." }, { status: 400 });
  }

  const priceId = priceIdForPlan(plan);
  if (!priceId) {
    return NextResponse.json({ error: "Billing is not configured for this plan yet." }, { status: 503 });
  }

  try {
    const origin = siteOrigin(request);
    const params = new URLSearchParams();
    params.set("mode", "subscription");
    params.set("line_items[0][price]", priceId);
    params.set("line_items[0][quantity]", "1");
    params.set("allow_promotion_codes", "true");
    params.set("success_url", `${origin}/api/billing/confirm?session_id={CHECKOUT_SESSION_ID}`);
    params.set("cancel_url", `${origin}/?billing=cancelled#pricing`);
    params.set("metadata[plan]", plan);
    params.set("subscription_data[metadata][plan]", plan);

    const session = await stripeRequest<CheckoutSession>("/checkout/sessions", {
      method: "POST",
      body: params,
    });

    if (!session.url) throw new Error("Stripe did not return a checkout URL.");
    return NextResponse.json({ url: session.url });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to start checkout." },
      { status: 502 },
    );
  }
}
