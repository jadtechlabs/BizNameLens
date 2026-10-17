import type { DomainResult } from "./types";

type Bootstrap = {
  services?: [string[], string[]][];
};

let cachedBootstrap: { data: Bootstrap; expiresAt: number } | null = null;

async function getBootstrap(): Promise<Bootstrap> {
  if (cachedBootstrap && cachedBootstrap.expiresAt > Date.now()) return cachedBootstrap.data;

  const response = await fetch("https://data.iana.org/rdap/dns.json", {
    next: { revalidate: 60 * 60 * 24 },
    signal: AbortSignal.timeout(5000),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`IANA RDAP bootstrap returned ${response.status}`);
  const data = (await response.json()) as Bootstrap;
  cachedBootstrap = { data, expiresAt: Date.now() + 24 * 60 * 60 * 1000 };
  return data;
}

function rdapBaseForTld(bootstrap: Bootstrap, tld: string) {
  const needle = tld.toLowerCase();
  for (const service of bootstrap.services ?? []) {
    const [tlds, urls] = service;
    if (tlds.some((item) => item.toLowerCase() === needle) && urls?.[0]) return urls[0];
  }
  return null;
}

export async function checkDomain(domain: string): Promise<DomainResult> {
  try {
    const tld = domain.split(".").pop()?.toLowerCase();
    if (!tld) return { domain, status: "unknown" };
    const bootstrap = await getBootstrap();
    const base = rdapBaseForTld(bootstrap, tld);
    if (!base) return { domain, status: "unknown" };
    const rdapUrl = new URL(`domain/${encodeURIComponent(domain)}`, base.endsWith("/") ? base : `${base}/`).toString();
    const response = await fetch(rdapUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
      headers: { Accept: "application/rdap+json, application/json" },
    });
    if (response.status === 404) return { domain, status: "available", rdapUrl };
    if (response.ok) return { domain, status: "registered", rdapUrl };
    return { domain, status: "unknown", rdapUrl };
  } catch {
    return { domain, status: "unknown" };
  }
}

export async function checkDomains(domains: string[]) {
  return Promise.all(domains.map(checkDomain));
}
