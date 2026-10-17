import { checkBotId } from "botid/server";
import { NextRequest, NextResponse } from "next/server";
import { applyIndustryRelevance, hasHighRelevanceTrademark, trademarkRiskPenalty } from "../../../lib/industry-risk";
import { checkDomains } from "../../../lib/providers/domains";
import { checkSocialHandles } from "../../../lib/providers/social";
import { searchTrademarks } from "../../../lib/providers/trademarks";
import { searchVirginiaRegistry } from "../../../lib/providers/virginia";
import type { DomainResult, RegistryResult, SocialResult, TrademarkResult } from "../../../lib/providers/types";
import { clearTurnstileCookie, readTurnstileToken, verifyTurnstileToken } from "../../../lib/turnstile";
import { applyUsageCookies, consumeSearch, getUsageStatus } from "../../../lib/usage";

export const runtime = "nodejs";

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 80);
}

function domainStem(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40);
}

function scoreName(
  name: string,
  domains: DomainResult[],
  registry: RegistryResult,
  trademarks: TrademarkResult,
  social: SocialResult[],
) {
  const lettersOnly = name.replace(/[^a-zA-Z0-9]/g, "");
  const words = name.split(/\s+/).filter(Boolean);
  let score = 76;

  if (lettersOnly.length >= 4 && lettersOnly.length <= 12) score += 8;
  else if (lettersOnly.length <= 18) score += 4;
  else score -= 4;

  if (words.length <= 2) score += 4;
  if (/^[a-zA-Z][a-zA-Z0-9 '&.-]+$/.test(name)) score += 2;

  const primaryDomain = domains.find((item) => item.domain.endsWith(".com"));
  if (primaryDomain?.status === "available") score += 5;
  if (primaryDomain?.status === "registered") score -= 7;

  const activeRegistryExact = registry.exactMatches.filter((item) => !item.status || !/inactive|terminated|cancelled|canceled|withdrawn/i.test(item.status));
  if (activeRegistryExact.length) score -= 26;
  score -= Math.min(14, registry.similarMatches.length * 3);

  score -= trademarkRiskPenalty(trademarks);

  const registeredSocials = social.filter((item) => item.status === "registered").length;
  score -= Math.min(5, registeredSocials * 2);

  const genericTerms = ["solutions", "services", "company", "group", "consulting", "technology", "technologies"];
  if (genericTerms.some((term) => name.toLowerCase().includes(term))) score -= 4;

  return Math.max(10, Math.min(96, score));
}

function materialTrademarkExact(trademarks: TrademarkResult) {
  return trademarks.exactMatches.some((item) => item.industryRelevance === "high" || item.industryRelevance === "medium" || item.industryRelevance === "unknown");
}

function riskLabel(score: number, registry: RegistryResult, trademarks: TrademarkResult) {
  if (registry.exactMatches.length || materialTrademarkExact(trademarks)) return "Higher screening risk";
  if (hasHighRelevanceTrademark(trademarks) || score < 68) return "Higher screening risk";
  if (score >= 85) return "Promising early screen";
  return "Moderate screening risk";
}

function buildRecommendation(name: string, industry: string, registry: RegistryResult, trademarks: TrademarkResult, domains: DomainResult[]) {
  const com = domains.find((item) => item.domain.endsWith(".com"));
  const highExact = trademarks.exactMatches.filter((item) => item.industryRelevance === "high");
  const mediumExact = trademarks.exactMatches.filter((item) => item.industryRelevance === "medium" || item.industryRelevance === "unknown");
  const highSimilar = trademarks.similarMatches.filter((item) => item.industryRelevance === "high");

  if (highExact.length) {
    return `${name} has live federal trademark results with the same normalized wording and strong overlap with ${industry}. Treat this as a significant screening flag and review the owners, classes, and goods/services before investing in the name.`;
  }
  if (mediumExact.length) {
    return `${name} has live exact-wording federal marks that may overlap with ${industry}. The industry connection is not as strong as the highest-risk matches, but these records deserve careful review before filing or branding.`;
  }
  if (registry.exactMatches.length) {
    return `${name} has one or more Virginia entity-name matches in the connected registry dataset. Confirm the current record in Virginia SCC and consider a more distinctive variation.`;
  }
  if (highSimilar.length) {
    return `${name} has similar live federal marks with meaningful ${industry} overlap. Even without an exact wording match, related goods/services can matter, so review these candidates before committing to the brand.`;
  }
  if (trademarks.exactMatches.length) {
    return `${name} has exact-wording federal marks, but their returned classes and goods/services show limited obvious overlap with ${industry}. That lowers the screening weight, not the need for review.`;
  }
  if (trademarks.similarMatches.length || registry.similarMatches.length) {
    return `${name} has no high-priority exact conflict in the returned automated results, but similar business or trademark uses deserve review before filing or branding.`;
  }
  if (com?.status === "registered") {
    return `${name} has a relatively clean returned legal-data screen for ${industry}, but the primary .com is already registered. Consider a strong domain variation and still verify the official registries before filing.`;
  }
  return `${name} has a promising early screening profile for ${industry} from the currently connected sources. Confirm the official Virginia SCC result and review the underlying USPTO records before committing money to the brand.`;
}

function jsonWithClearedTurnstile(body: object, status: number) {
  const response = NextResponse.json(body, { status });
  clearTurnstileCookie(response);
  return response;
}

export async function POST(request: NextRequest) {
  try {
    const bot = await checkBotId();
    if (bot.isBot) {
      return NextResponse.json(
        { error: "Automated traffic is not allowed on the name-check endpoint.", code: "BOT_DETECTED" },
        { status: 403 },
      );
    }
  } catch {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Bot protection is temporarily unavailable. Please try again.", code: "BOT_PROTECTION_UNAVAILABLE" },
        { status: 503 },
      );
    }
  }

  const body = await request.json().catch(() => ({}));
  const name = normalizeName(String(body?.name ?? ""));
  const industry = normalizeName(String(body?.industry ?? "Other"));
  const state = normalizeName(String(body?.state ?? "Virginia"));

  if (!name || name.length < 2) {
    return NextResponse.json({ error: "Enter a business name with at least 2 characters." }, { status: 400 });
  }

  const stem = domainStem(name);
  if (!stem) {
    return NextResponse.json({ error: "Enter a business name using letters or numbers." }, { status: 400 });
  }

  let currentUsage;
  try {
    currentUsage = getUsageStatus(request);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Usage tracking is unavailable." },
      { status: 500 },
    );
  }

  if (currentUsage.status.paywall) {
    return NextResponse.json(
      {
        error: "You have used all 10 free business-name searches.",
        code: "FREE_LIMIT_REACHED",
        usage: currentUsage.status,
      },
      { status: 402 },
    );
  }

  if (currentUsage.status.challengeRequired) {
    const turnstileToken = readTurnstileToken(request);
    if (!turnstileToken) {
      return NextResponse.json(
        {
          error: "Complete the human verification to continue.",
          code: "HUMAN_VERIFICATION_REQUIRED",
          usage: currentUsage.status,
        },
        { status: 428 },
      );
    }

    const human = await verifyTurnstileToken(request, turnstileToken);
    if (!human.ok) {
      return jsonWithClearedTurnstile(
        {
          error: human.reason,
          code: "HUMAN_VERIFICATION_FAILED",
          usage: currentUsage.status,
        },
        403,
      );
    }
  }

  let usage;
  try {
    usage = consumeSearch(request);
  } catch (error) {
    return jsonWithClearedTurnstile(
      { error: error instanceof Error ? error.message : "Usage tracking is unavailable." },
      500,
    );
  }

  if (!usage.allowed) {
    return jsonWithClearedTurnstile(
      {
        error: "You have used all 10 free business-name searches.",
        code: "FREE_LIMIT_REACHED",
        usage: usage.status,
      },
      402,
    );
  }

  const candidateDomains = [
    `${stem}.com`,
    `get${stem}.com`,
    `${stem}hq.com`,
    `build${stem}.com`,
    `${stem}.net`,
  ];

  const [domains, registry, rawTrademarks, social] = await Promise.all([
    checkDomains(candidateDomains),
    searchVirginiaRegistry(name),
    searchTrademarks(name),
    checkSocialHandles(name),
  ]);

  const trademarks = applyIndustryRelevance(rawTrademarks, industry);
  const score = scoreName(name, domains, registry, trademarks, social);
  const risk = riskLabel(score, registry, trademarks);

  const response = NextResponse.json({
    name,
    industry,
    state,
    score,
    risk,
    recommendation: buildRecommendation(name, industry, registry, trademarks, domains),
    domains,
    registry,
    trademarks,
    social,
    usage: usage.status,
    checkedAt: new Date().toISOString(),
    sources: {
      virginiaScc: "https://cis.scc.virginia.gov/EntitySearch/Index",
      uspto: "https://tmsearch.uspto.gov/",
      linkedin: `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(name)}`,
      instagram: `https://www.instagram.com/${encodeURIComponent(stem)}/`,
      x: `https://x.com/${encodeURIComponent(stem)}`,
    },
    notes: {
      registry: registry.state === "unconfigured"
        ? "Virginia SCC's live search is protected by reCAPTCHA and has no documented public JSON API. BizNameLens supports a weekly Virginia SCC-derived dataset provider when OPENDATA_API_KEY is configured, and always links to the official SCC source for final confirmation."
        : "Virginia entity matches come from an SCC-derived dataset provider. Always confirm the current official record in CIS before filing.",
      trademark: trademarks.state === "ok"
        ? `Federal trademark candidates are pulled from the public backend used by the official USPTO Trademark Search application. BizNameLens now weights returned classes and goods/services against ${industry}; this is screening context, not a legal conclusion.`
        : "The live USPTO search connector was unavailable for this request. Use the official Trademark Search link for confirmation.",
      social: "Social checks are deliberately conservative because major networks frequently return login or anti-bot pages. Unknown means BizNameLens could not verify the handle safely, not that it is available.",
      score: "The BizName Score is a preliminary screening indicator. Industry relevance can change the weight of trademark candidates, but the score is not a legal opinion or a percentage chance of trademark approval.",
    },
  });

  applyUsageCookies(response, usage);
  if (currentUsage.status.challengeRequired) clearTurnstileCookie(response);
  return response;
}
