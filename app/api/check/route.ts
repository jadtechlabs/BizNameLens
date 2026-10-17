import { NextRequest, NextResponse } from "next/server";

type DomainResult = {
  domain: string;
  status: "available" | "registered" | "unknown";
};

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 80);
}

function domainStem(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40);
}

async function checkComDomain(domain: string): Promise<DomainResult> {
  try {
    const response = await fetch(`https://rdap.verisign.com/com/v1/domain/${encodeURIComponent(domain)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
      headers: { Accept: "application/rdap+json, application/json" },
    });

    if (response.status === 404) return { domain, status: "available" };
    if (response.ok) return { domain, status: "registered" };
    return { domain, status: "unknown" };
  } catch {
    return { domain, status: "unknown" };
  }
}

function scoreName(name: string, primaryDomain: DomainResult) {
  const lettersOnly = name.replace(/[^a-zA-Z0-9]/g, "");
  const words = name.split(/\s+/).filter(Boolean);
  let score = 68;

  if (lettersOnly.length >= 4 && lettersOnly.length <= 12) score += 12;
  else if (lettersOnly.length <= 18) score += 6;
  else score -= 5;

  if (words.length <= 2) score += 5;
  if (/^[a-zA-Z][a-zA-Z0-9 ]+$/.test(name)) score += 3;

  if (primaryDomain.status === "available") score += 8;
  if (primaryDomain.status === "registered") score -= 8;

  const genericTerms = ["solutions", "services", "company", "group", "consulting", "technology", "technologies"];
  if (genericTerms.some((term) => name.toLowerCase().includes(term))) score -= 4;

  return Math.max(35, Math.min(94, score));
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

  const candidates = [
    `${stem}.com`,
    `get${stem}.com`,
    `${stem}hq.com`,
    `build${stem}.com`,
  ];

  const domains = await Promise.all(candidates.map(checkComDomain));
  const score = scoreName(name, domains[0]);
  const risk = score >= 82 ? "Low screening risk" : score >= 65 ? "Moderate screening risk" : "Higher screening risk";

  return NextResponse.json({
    name,
    industry,
    state,
    score,
    risk,
    domains,
    checkedAt: new Date().toISOString(),
    sources: {
      virginiaScc: "https://cis.scc.virginia.gov/EntitySearch/Index",
      uspto: "https://tmsearch.uspto.gov/search/search-information",
      linkedin: `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(name)}`,
      instagram: `https://www.instagram.com/${encodeURIComponent(stem)}/`,
      x: `https://x.com/${encodeURIComponent(stem)}`,
    },
    notes: {
      registry: "Virginia SCC does not currently expose a simple public name-search API for this prototype, so BizNameLens links you to the official registry for confirmation.",
      trademark: "Trademark screening requires similarity and goods/services analysis. This prototype links to the official USPTO search while the automated screening connector is being built.",
      score: "The BizName Score is a preliminary naming and availability screening indicator, not a legal clearance opinion.",
    },
  });
}
