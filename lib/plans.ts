export const PLAN_KEYS = ["free", "starter", "pro", "business"] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];
export type PaidPlanKey = Exclude<PlanKey, "free">;

export type PlanDefinition = {
  key: PlanKey;
  name: string;
  priceMonthly: number;
  searchLimit: number;
  cadence: "lifetime" | "month";
  description: string;
  highlighted?: boolean;
};

export const PLANS: Record<PlanKey, PlanDefinition> = {
  free: {
    key: "free",
    name: "Free",
    priceMonthly: 0,
    searchLimit: 10,
    cadence: "lifetime",
    description: "Try BizNameLens on up to 10 business names.",
  },
  starter: {
    key: "starter",
    name: "Starter",
    priceMonthly: 9,
    searchLimit: 100,
    cadence: "month",
    description: "For founders actively narrowing down a business or product name.",
  },
  pro: {
    key: "pro",
    name: "Pro",
    priceMonthly: 19,
    searchLimit: 500,
    cadence: "month",
    description: "For repeat naming work, consultants, and growing founder teams.",
    highlighted: true,
  },
  business: {
    key: "business",
    name: "Business",
    priceMonthly: 49,
    searchLimit: 2000,
    cadence: "month",
    description: "For agencies and teams screening names at higher volume.",
  },
};

export function isPlanKey(value: unknown): value is PlanKey {
  return typeof value === "string" && (PLAN_KEYS as readonly string[]).includes(value);
}

export function isPaidPlanKey(value: unknown): value is PaidPlanKey {
  return isPlanKey(value) && value !== "free";
}

export function planPriceEnv(plan: PaidPlanKey) {
  if (plan === "starter") return "STRIPE_PRICE_STARTER";
  if (plan === "pro") return "STRIPE_PRICE_PRO";
  return "STRIPE_PRICE_BUSINESS";
}

export function priceIdForPlan(plan: PaidPlanKey) {
  return process.env[planPriceEnv(plan)]?.trim() || "";
}

export function planFromPriceId(priceId: string | undefined): PaidPlanKey | null {
  if (!priceId) return null;
  for (const key of ["starter", "pro", "business"] as const) {
    if (priceIdForPlan(key) === priceId) return key;
  }
  return null;
}
