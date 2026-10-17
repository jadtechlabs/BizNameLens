import { NextRequest, NextResponse } from "next/server";
import { isPaidPlanKey, planFromPriceId } from "../../../../lib/plans";
import { stripeRequest } from "../../../../lib/stripe";
import { createEntitlementToken, setEntitlementCookie } from "../../../../lib/usage";

export const runtime = "nodejs";

type CheckoutSession = {
  status?: string;
  mode?: string;
  metadata?: { plan?: string };
  customer?: string | { id?: string };
  subscription?:
    | string
    | {
        id?: string;
        status?: string;
        items?: { data?: Array<{ price?: { id?: string } }> };
      };
};

function customerId(session: CheckoutSession) {
  return typeof session.customer === "string" ? session.customer : session.customer?.id;
}

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session_id")?.trim();
  if (!sessionId) return NextResponse.redirect(new URL("/?billing=error#pricing", request.url));

  try {
    const session = await stripeRequest<CheckoutSession>(
      `/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=subscription`,
    );

    if (session.status !== "complete" || session.mode !== "subscription") {
      throw new Error("Checkout has not completed.");
    }

    const subscription = session.subscription;
    const subscriptionId = typeof subscription === "string" ? subscription : subscription?.id;
    const priceId = typeof subscription === "object" ? subscription.items?.data?.[0]?.price?.id : undefined;
    const metadataPlan = session.metadata?.plan;
    const plan = isPaidPlanKey(metadataPlan) ? metadataPlan : planFromPriceId(priceId);
    const customer = customerId(session);

    if (!plan || !subscriptionId || !customer) throw new Error("Checkout did not include a valid subscription entitlement.");

    const token = createEntitlementToken({
      plan,
      customerId: customer,
      subscriptionId,
      verifiedAt: Date.now(),
    });

    const destination = new URL("/?billing=success", request.url);
    destination.hash = "search";
    const response = NextResponse.redirect(destination);
    setEntitlementCookie(response, token);
    return response;
  } catch {
    const destination = new URL("/?billing=error", request.url);
    destination.hash = "pricing";
    return NextResponse.redirect(destination);
  }
}
