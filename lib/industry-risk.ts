import type { IndustryRelevance, TrademarkMatch, TrademarkResult } from "./providers/types";

type IndustryProfile = {
  classes: string[];
  keywords: string[];
};

const INDUSTRY_PROFILES: Record<string, IndustryProfile> = {
  "Technology / Cybersecurity": {
    classes: ["009", "9", "042", "42"],
    keywords: ["software", "cyber", "security", "computer", "technology", "saas", "cloud", "network", "data", "application", "digital", "information technology", "it services"],
  },
  "Professional Services": {
    classes: ["035", "35", "041", "41", "045", "45"],
    keywords: ["consulting", "business services", "management", "advisory", "professional services", "training", "legal services"],
  },
  "Retail / E-commerce": {
    classes: ["035", "35"],
    keywords: ["retail", "online store", "e-commerce", "ecommerce", "marketplace", "store services", "shopping"],
  },
  "Food / Hospitality": {
    classes: ["029", "29", "030", "30", "032", "32", "033", "33", "043", "43"],
    keywords: ["restaurant", "cafe", "food", "beverage", "hotel", "hospitality", "catering", "bar", "coffee", "bakery"],
  },
  "Construction / Trades": {
    classes: ["019", "19", "037", "37", "040", "40"],
    keywords: ["construction", "contractor", "building", "installation", "repair", "plumbing", "electrical", "roofing", "hvac", "remodeling"],
  },
  "Health / Wellness": {
    classes: ["005", "5", "010", "10", "041", "41", "044", "44"],
    keywords: ["health", "medical", "wellness", "fitness", "therapy", "clinic", "nutrition", "healthcare", "exercise", "spa"],
  },
  "Real Estate": {
    classes: ["036", "36", "037", "37"],
    keywords: ["real estate", "property", "brokerage", "leasing", "rental", "mortgage", "property management", "development"],
  },
  "Finance / Insurance": {
    classes: ["036", "36"],
    keywords: ["financial", "finance", "banking", "investment", "insurance", "credit", "lending", "wealth", "payments", "mortgage"],
  },
  "Media / Creative": {
    classes: ["009", "9", "016", "16", "038", "38", "041", "41", "042", "42"],
    keywords: ["media", "entertainment", "publishing", "photography", "video", "design", "creative", "production", "music", "marketing", "advertising"],
  },
  Other: {
    classes: [],
    keywords: [],
  },
};

function normalizeClass(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return value.trim();
  return String(Number(digits));
}

function assessMatch(match: TrademarkMatch, industry: string): TrademarkMatch {
  const profile = INDUSTRY_PROFILES[industry] ?? INDUSTRY_PROFILES.Other;
  if (!profile.classes.length && !profile.keywords.length) {
    return { ...match, industryRelevance: "unknown", relevanceReasons: [] };
  }

  const desiredClasses = new Set(profile.classes.map(normalizeClass));
  const matchedClasses = match.internationalClasses
    .map(normalizeClass)
    .filter((value) => desiredClasses.has(value));

  const goods = (match.goodsAndServices ?? "").toLowerCase();
  const matchedKeywords = profile.keywords.filter((keyword) => goods.includes(keyword));

  let industryRelevance: IndustryRelevance = "low";
  if (matchedClasses.length && matchedKeywords.length) industryRelevance = "high";
  else if (matchedClasses.length || matchedKeywords.length >= 2) industryRelevance = "high";
  else if (matchedKeywords.length === 1) industryRelevance = "medium";
  else if (!match.internationalClasses.length && !match.goodsAndServices) industryRelevance = "unknown";

  const relevanceReasons: string[] = [];
  if (matchedClasses.length) relevanceReasons.push(`overlapping class${matchedClasses.length > 1 ? "es" : ""} ${matchedClasses.join(", ")}`);
  if (matchedKeywords.length) relevanceReasons.push(`related goods/services: ${matchedKeywords.slice(0, 3).join(", ")}`);
  if (!relevanceReasons.length && industryRelevance === "low") relevanceReasons.push("no obvious class or goods/services overlap in returned data");

  return { ...match, industryRelevance, relevanceReasons };
}

export function applyIndustryRelevance(trademarks: TrademarkResult, industry: string): TrademarkResult {
  const exactMatches = trademarks.exactMatches.map((match) => assessMatch(match, industry));
  const similarMatches = trademarks.similarMatches.map((match) => assessMatch(match, industry));

  if (trademarks.state !== "ok") return { ...trademarks, exactMatches, similarMatches };

  const all = [...exactMatches, ...similarMatches];
  const high = all.filter((match) => match.industryRelevance === "high").length;
  const medium = all.filter((match) => match.industryRelevance === "medium").length;

  const context = high
    ? `${high} returned live mark${high === 1 ? "" : "s"} show strong industry overlap for ${industry}.`
    : medium
      ? `${medium} returned live mark${medium === 1 ? "" : "s"} show some industry overlap for ${industry}.`
      : all.length
        ? `Returned marks appear to have limited obvious industry overlap for ${industry}, based on classes and goods/services in the returned records.`
        : trademarks.message;

  return {
    ...trademarks,
    exactMatches,
    similarMatches,
    message: all.length ? `${trademarks.message} ${context}` : trademarks.message,
  };
}

export function trademarkRiskPenalty(trademarks: TrademarkResult) {
  let penalty = 0;
  const all = [...trademarks.exactMatches, ...trademarks.similarMatches];

  for (const match of all) {
    const relevance = match.industryRelevance ?? "unknown";
    if (match.strength === "exact") {
      penalty += relevance === "high" ? 32 : relevance === "medium" ? 22 : relevance === "low" ? 10 : 18;
    } else {
      penalty += relevance === "high" ? 8 : relevance === "medium" ? 5 : relevance === "low" ? 2 : 4;
    }
  }

  return Math.min(42, penalty);
}

export function hasHighRelevanceTrademark(trademarks: TrademarkResult) {
  return [...trademarks.exactMatches, ...trademarks.similarMatches].some((match) => match.industryRelevance === "high");
}
