import { planFromPriceId, type PaidPlanKey } from "./plans";

const STRIPE_API = "https://api.stripe.com/v1";

type StripeSubscription = {
  id: string;
  status?: string;
  customer?: string | { id?: string };
  items?: { data?: Array<{ price?: { id?: string } }> };
};

export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

function stripeSecret() {
  const value = process.env.STRIPE_SECRET_KEY?.trim();
  if (!value) throw new Error("Stripe billing is not configured yet.");
  return value;
}

export async function stripeRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${STRIPE_API}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${stripeSecret()}`,
      ...(init?.body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(8000),
  });

  const data = (await response.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(data.error?.message || `Stripe returned ${response.status}.`);
  }
  return data;
}

export async function verifySubscription(subscriptionId: string): Promise<{
  active: boolean;
  plan: PaidPlanKey | null;
  customerId?: string;
}> {
  const subscription = await stripeRequest<StripeSubscription>(`/subscriptions/${encodeURIComponent(subscriptionId)}`);
  const status = subscription.status || "";
  const active = status === "active" || status === "trialing";
  const priceId = subscription.items?.data?.[0]?.price?.id;
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
  return { active, plan: active ? planFromPriceId(priceId) : null, customerId };
}
