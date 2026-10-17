import type { SocialResult } from "./types";

function makeHandle(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 30);
}

type Probe = {
  network: SocialResult["network"];
  url: string;
  missingMarkers: string[];
  presentMarkers: string[];
};

async function probeSocial(handle: string, probe: Probe): Promise<SocialResult> {
  try {
    const response = await fetch(probe.url, {
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(6000),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BizNameLens/0.1; +https://github.com/jadtechlabs/BizNameLens)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (response.status === 404) {
      return { network: probe.network, handle, url: probe.url, status: "available", confidence: "high", note: "The public profile URL returned 404." };
    }
    if ([401, 403, 429, 999].includes(response.status)) {
      return { network: probe.network, handle, url: probe.url, status: "unknown", confidence: "low", note: `The network blocked automated verification (${response.status}).` };
    }
    if (!response.ok) {
      return { network: probe.network, handle, url: probe.url, status: "unknown", confidence: "low", note: `Unexpected response ${response.status}.` };
    }

    const html = (await response.text()).slice(0, 400_000).toLowerCase();
    if (probe.missingMarkers.some((marker) => html.includes(marker.toLowerCase()))) {
      return { network: probe.network, handle, url: probe.url, status: "available", confidence: "medium", note: "The public page returned a not-found marker." };
    }
    if (probe.presentMarkers.some((marker) => html.includes(marker.toLowerCase()))) {
      return { network: probe.network, handle, url: probe.url, status: "registered", confidence: "medium", note: "A public profile marker was detected." };
    }

    return { network: probe.network, handle, url: probe.url, status: "unknown", confidence: "low", note: "The network returned a generic page, so availability could not be confirmed safely." };
  } catch {
    return { network: probe.network, handle, url: probe.url, status: "unknown", confidence: "low", note: "The network could not be reached reliably." };
  }
}

export async function checkSocialHandles(name: string): Promise<SocialResult[]> {
  const handle = makeHandle(name);
  if (!handle) return [];

  const probes: Probe[] = [
    {
      network: "Instagram",
      url: `https://www.instagram.com/${encodeURIComponent(handle)}/`,
      missingMarkers: ["sorry, this page isn't available", "page isn't available"],
      presentMarkers: ["instagram profile", `@${handle}`],
    },
    {
      network: "X",
      url: `https://x.com/${encodeURIComponent(handle)}`,
      missingMarkers: ["this account doesn’t exist", "this account doesn't exist", "page doesn’t exist"],
      presentMarkers: [`@${handle}`, "followers"],
    },
    {
      network: "LinkedIn",
      url: `https://www.linkedin.com/company/${encodeURIComponent(handle)}/`,
      missingMarkers: ["page not found", "this page doesn’t exist", "this page doesn't exist"],
      presentMarkers: ["linkedin", "company"],
    },
  ];

  return Promise.all(probes.map((probe) => probeSocial(handle, probe)));
}
