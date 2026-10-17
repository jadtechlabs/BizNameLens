import type { TrademarkMatch, TrademarkResult } from "./types";

type TmConfig = { serviceUrlSearchElastic?: string };
type TmHit = { id?: string; source?: Record<string, unknown> };
type TmResponse = {
  hits?: {
    totalValue?: number;
    total?: number | { value?: number };
    hits?: TmHit[];
  };
};

let cachedBase: { url: string; expiresAt: number } | null = null;

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function escapeQueryPhrase(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function safeOfficialUrl(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.hostname !== "tmsearch.uspto.gov") {
    throw new Error("Unexpected USPTO Trademark Search host");
  }
  return url;
}

async function discoverBaseUrl() {
  if (cachedBase && cachedBase.expiresAt > Date.now()) return cachedBase.url;

  const configUrl = process.env.TMSEARCH_CONFIG_URL || "https://tmsearch.uspto.gov/configuration.json";
  const response = await fetch(configUrl, {
    cache: "no-store",
    signal: AbortSignal.timeout(6000),
    headers: {
      Accept: "application/json",
      "User-Agent": "BizNameLens/0.1",
    },
  });
  if (!response.ok) throw new Error(`USPTO configuration returned ${response.status}`);
  const config = (await response.json()) as TmConfig;
  if (!config.serviceUrlSearchElastic) throw new Error("USPTO configuration did not include the search service URL");
  const url = safeOfficialUrl(config.serviceUrlSearchElastic).toString().replace(/\/?$/, "/");
  cachedBase = { url, expiresAt: Date.now() + 6 * 60 * 60 * 1000 };
  return url;
}

function stringValue(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return undefined;
}

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(stringValue).filter((item): item is string => Boolean(item));
  const single = stringValue(value);
  return single ? [single] : [];
}

function mapHit(hit: TmHit, query: string): TrademarkMatch | null {
  const source = hit.source ?? {};
  const wordmark = stringValue(source.wordmark) || stringValue(source.wordmarkPseudoText);
  if (!wordmark) return null;
  const serialNumber = stringValue(source.id) || stringValue(source.serialNumber) || hit.id;
  const alive = source.alive !== false;
  return {
    wordmark,
    serialNumber,
    registrationNumber: stringValue(source.registrationId) || stringValue(source.registrationNumber),
    ownerName: stringValue(source.ownerName),
    alive,
    internationalClasses: stringArray(source.internationalClass),
    goodsAndServices: stringValue(source.goodsAndServices),
    strength: normalizeText(wordmark) === normalizeText(query) ? "exact" : "similar",
    detailUrl: serialNumber ? `https://tsdr.uspto.gov/#caseNumber=${encodeURIComponent(serialNumber)}&caseSearchType=US_APPLICATION&caseType=DEFAULT&searchType=statusSearch` : undefined,
  };
}

function totalValue(response: TmResponse) {
  const total = response.hits?.total;
  if (typeof response.hits?.totalValue === "number") return response.hits.totalValue;
  if (typeof total === "number") return total;
  if (total && typeof total === "object" && typeof total.value === "number") return total.value;
  return response.hits?.hits?.length ?? 0;
}

export async function searchTrademarks(name: string): Promise<TrademarkResult> {
  const checkedAt = new Date().toISOString();
  const sourceUrl = "https://tmsearch.uspto.gov/";
  try {
    const base = await discoverBaseUrl();
    const endpoint = new URL("tmsearch", base).toString();
    const phrase = escapeQueryPhrase(name);
    const body = {
      query: {
        query_string: {
          query: `CM:\"${phrase}\" AND LD:true`,
          default_operator: "AND",
        },
      },
      from: 0,
      size: 12,
      track_total_hits: true,
      _source: [
        "id",
        "serialNumber",
        "wordmark",
        "wordmarkPseudoText",
        "ownerName",
        "alive",
        "registrationId",
        "registrationNumber",
        "internationalClass",
        "goodsAndServices",
        "filingDate",
        "registrationDate"
      ],
    };

    const response = await fetch(endpoint, {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(9000),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "BizNameLens/0.1",
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`USPTO Trademark Search returned ${response.status}`);
    const data = (await response.json()) as TmResponse;
    const matches = (data.hits?.hits ?? []).map((hit) => mapHit(hit, name)).filter((item): item is TrademarkMatch => Boolean(item && item.alive));
    const exactMatches = matches.filter((item) => item.strength === "exact");
    const similarMatches = matches.filter((item) => item.strength === "similar");

    return {
      state: "ok",
      provider: "USPTO Trademark Search",
      sourceUrl,
      checkedAt,
      totalLiveMatches: totalValue(data),
      exactMatches,
      similarMatches,
      message: exactMatches.length
        ? `${exactMatches.length} live exact-wording federal mark${exactMatches.length === 1 ? "" : "s"} found in the first results.`
        : similarMatches.length
          ? `No exact wording in the returned live results; ${similarMatches.length} similar live mark${similarMatches.length === 1 ? "" : "s"} shown.`
          : "No live phrase matches were returned by the USPTO search backend.",
    };
  } catch (error) {
    return {
      state: "unavailable",
      provider: "USPTO Trademark Search",
      sourceUrl,
      checkedAt,
      totalLiveMatches: 0,
      exactMatches: [],
      similarMatches: [],
      message: error instanceof Error ? `Live USPTO search unavailable: ${error.message}` : "Live USPTO search unavailable.",
    };
  }
}
