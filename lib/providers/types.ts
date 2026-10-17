export type ProviderState = "ok" | "partial" | "unconfigured" | "unavailable";

export type MatchStrength = "exact" | "similar";
export type IndustryRelevance = "high" | "medium" | "low" | "unknown";

export type RegistryMatch = {
  name: string;
  entityId?: string;
  entityType?: string;
  status?: string;
  formationDate?: string;
  address?: string;
  strength: MatchStrength;
  source: "virginia-llc" | "virginia-corp";
};

export type RegistryResult = {
  state: ProviderState;
  provider: string;
  sourceUrl: string;
  checkedAt: string;
  exactMatches: RegistryMatch[];
  similarMatches: RegistryMatch[];
  message: string;
};

export type TrademarkMatch = {
  wordmark: string;
  serialNumber?: string;
  registrationNumber?: string;
  ownerName?: string;
  alive: boolean;
  internationalClasses: string[];
  goodsAndServices?: string;
  strength: MatchStrength;
  detailUrl?: string;
  industryRelevance?: IndustryRelevance;
  relevanceReasons?: string[];
};

export type TrademarkResult = {
  state: ProviderState;
  provider: string;
  sourceUrl: string;
  checkedAt: string;
  totalLiveMatches: number;
  exactMatches: TrademarkMatch[];
  similarMatches: TrademarkMatch[];
  message: string;
};

export type DomainStatus = "available" | "registered" | "unknown";

export type DomainResult = {
  domain: string;
  status: DomainStatus;
  rdapUrl?: string;
};

export type SocialStatus = "available" | "registered" | "unknown";

export type SocialResult = {
  network: "Instagram" | "X" | "LinkedIn";
  handle: string;
  url: string;
  status: SocialStatus;
  confidence: "high" | "medium" | "low";
  note?: string;
};
