import type { RegistryMatch, RegistryResult } from "./types";

const OFFICIAL_URL = "https://cis.scc.virginia.gov/EntitySearch/Index";
const PRODUCTS = [
  { id: "us_business_va_llc", source: "virginia-llc" as const },
  { id: "us_business_va_corp", source: "virginia-corp" as const },
];

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\b(llc|l l c|inc|incorporated|corp|corporation|co|company|ltd|limited)\b/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
}

function stringValue(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return undefined;
}

function arrayFromPayload(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"));
  if (!payload || typeof payload !== "object") return [];
  const obj = payload as Record<string, unknown>;
  for (const key of ["data", "results", "records", "items", "rows"]) {
    const value = obj[key];
    if (Array.isArray(value)) return value.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"));
  }
  return [];
}

function mapRow(row: Record<string, unknown>, source: RegistryMatch["source"], query: string): RegistryMatch | null {
  const name = stringValue(row.business_name) || stringValue(row.entity_name) || stringValue(row.name) || stringValue(row.BusinessName) || stringValue(row.EntityName);
  if (!name) return null;
  const normalizedName = normalizeText(name);
  const normalizedQuery = normalizeText(query);
  return {
    name,
    entityId: stringValue(row.entity_id) || stringValue(row.scc_id) || stringValue(row.id) || stringValue(row.EntityID),
    entityType: stringValue(row.entity_type) || stringValue(row.business_type) || stringValue(row.license_type) || stringValue(row.EntityType),
    status: stringValue(row.status) || stringValue(row.entity_status) || stringValue(row.Status),
    formationDate: stringValue(row.formation_date) || stringValue(row.creation_date) || stringValue(row.date_formed) || stringValue(row.FormationDate),
    address: stringValue(row.principal_address) || stringValue(row.address) || stringValue(row.principal_location) || stringValue(row.PrincipalOfficeAddress),
    strength: normalizedName === normalizedQuery ? "exact" : "similar",
    source,
  };
}

async function searchProduct(productId: string, source: RegistryMatch["source"], name: string, apiKey: string) {
  const url = new URL(`https://opendata.best/api/v1/data/products/${productId}/search`);
  url.searchParams.set("q", name);
  url.searchParams.set("limit", "12");
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
    headers: { Accept: "application/json", "X-API-Key": apiKey },
  });
  if (!response.ok) throw new Error(`${productId} returned ${response.status}`);
  const payload = await response.json();
  return arrayFromPayload(payload).map((row) => mapRow(row, source, name)).filter((item): item is RegistryMatch => Boolean(item));
}

export async function searchVirginiaRegistry(name: string): Promise<RegistryResult> {
  const checkedAt = new Date().toISOString();
  const apiKey = process.env.OPENDATA_API_KEY?.trim();
  if (!apiKey) {
    return {
      state: "unconfigured",
      provider: "Virginia SCC data mirror",
      sourceUrl: OFFICIAL_URL,
      checkedAt,
      exactMatches: [],
      similarMatches: [],
      message: "Add OPENDATA_API_KEY to enable automated Virginia LLC and corporation matching. The official SCC search remains the final source of record.",
    };
  }

  try {
    const settled = await Promise.allSettled(PRODUCTS.map((item) => searchProduct(item.id, item.source, name, apiKey)));
    const matches = settled.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
    const exactMatches = matches.filter((item) => item.strength === "exact").slice(0, 8);
    const similarMatches = matches.filter((item) => item.strength === "similar").slice(0, 12);
    const failed = settled.filter((result) => result.status === "rejected").length;

    return {
      state: failed === PRODUCTS.length ? "unavailable" : failed ? "partial" : "ok",
      provider: "Virginia SCC data via opendata.best",
      sourceUrl: OFFICIAL_URL,
      checkedAt,
      exactMatches,
      similarMatches,
      message: exactMatches.length
        ? `${exactMatches.length} exact normalized Virginia entity name match${exactMatches.length === 1 ? "" : "es"} found.`
        : similarMatches.length
          ? `No exact normalized match; ${similarMatches.length} similar Virginia entit${similarMatches.length === 1 ? "y" : "ies"} returned.`
          : "No matching Virginia LLC or corporation was returned by the configured dataset provider.",
    };
  } catch (error) {
    return {
      state: "unavailable",
      provider: "Virginia SCC data mirror",
      sourceUrl: OFFICIAL_URL,
      checkedAt,
      exactMatches: [],
      similarMatches: [],
      message: error instanceof Error ? `Virginia registry lookup unavailable: ${error.message}` : "Virginia registry lookup unavailable.",
    };
  }
}
