import { NextRequest, NextResponse } from "next/server";
import { checkDomains } from "../../../lib/providers/domains";
import { checkSocialHandles } from "../../../lib/providers/social";
import { searchTrademarks } from "../../../lib/providers/trademarks";
import { searchVirginiaRegistry } from "../../../lib/providers/virginia";
import type { DomainResult, RegistryResult, SocialResult, TrademarkResult } from "../../../lib/providers/types";

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

  if (trademarks.exactMatches.length) score -= 32;
  score -= Math.min(22, trademarks.similarMatches.length * 5);

  const registeredSocials = social.filter((item) => item.status === "registered").length;
  score -= Math.min(5, registeredSocials * 2);

  const genericTerms = ["solutions", "services", "company", "group", "consulting", "technology", "technologies"];
  if (genericTerms.some((term) => name.toLowerCase().includes(term))) score -= 4;

  return Math.max(10, Math.min(96, score));
}

function riskLabel(score: number, registry: RegistryResult, trademarks: TrademarkResult) {
  if (registry.exactMatches.length || trademarks.exactMatches.length) return "Higher screening risk";
  if (score >= 85) return "Promising early screen";
  if (score >= 68) return "Moderate screening risk";
  return "Higher screening risk";
}

function buildRecommendation(name: string, registry: RegistryResult, trademarks: TrademarkResult, domains: DomainResult[]) {
  const com = domains.find((item) => item.domain.endsWith(".com"));
  if (trademarks.exactMatches.length) {
    return `${name} has one or more live federal trademark results with the same normalized wording. Review the owners, classes, and goods/services before investing in this name.`;
  }
  if (registry.exactMatches.length) {
    return `${name} has one or more Virginia entity-name matches in the connected registry dataset. Confirm the current record in Virginia SCC and consider a more distinctive variation.`;
  }
  if (trademarks.similarMatches.length || registry.similarMatches.length) {
    return `${name} has no exact conflict in the returned automated results, but similar business or trademark uses deserve review before filing or branding.`;
  }
  if (com?.status === "registered") {
    return `${name} has a relatively clean returned legal-data screen, but the primary .com is already registered. Consider a strong domain variation and still verify the official registries before filing.`;
  }
  return `${name} has a promising early screening profile from the currently connected sources. Confirm the official Virginia SCC result and review the underlying USPTO records before committing money to the brand.`;
}

export async function POST(request: NextRequest) {
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

  const candidateDomains = [
    `${stem}.com`,
    `get${stem}.com`,
    `${stem}hq.com`,
    `build${stem}.com`,
    `${stem}.net`,
  ];

  const [domains, registry, trademarks, social] = await Promise.all([
    checkDomains(candidateDomains),
    searchVirginiaRegistry(name),
    searchTrademarks(name),
    checkSocialHandles(name),
  ]);

  const score = scoreName(name, domains, registry, trademarks, social);
  const risk = riskLabel(score, registry, trademarks);

  return NextResponse.json({
    name,
    industry,
    state,
    score,
    risk,
    recommendation: buildRecommendation(name, registry, trademarks, domains),
    domains,
    registry,
    trademarks,
    social,
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
        ? "Federal trademark candidates are pulled from the public backend used by the official USPTO Trademark Search application. The interface is undocumented and can change; final clearance requires reviewing the records, goods/services, and similarity."
        : "The live USPTO search connector was unavailable for this request. Use the official Trademark Search link for confirmation.",
      social: "Social checks are deliberately conservative because major networks frequently return login or anti-bot pages. Unknown means BizNameLens could not verify the handle safely, not that it is available.",
      score: "The BizName Score is a preliminary screening indicator, not a legal opinion or a percentage chance of trademark approval.",
    },
  });
}
