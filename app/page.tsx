"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  ArrowRight,
  AtSign,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Globe2,
  Layers3,
  Radar,
  Search,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";

type DomainResult = {
  domain: string;
  status: "available" | "registered" | "unknown";
};

type RegistryMatch = {
  name: string;
  entityId?: string;
  entityType?: string;
  status?: string;
  strength: "exact" | "similar";
};

type RegistryResult = {
  state: "ok" | "partial" | "unconfigured" | "unavailable";
  provider: string;
  exactMatches: RegistryMatch[];
  similarMatches: RegistryMatch[];
  message: string;
};

type TrademarkMatch = {
  wordmark: string;
  serialNumber?: string;
  registrationNumber?: string;
  ownerName?: string;
  internationalClasses: string[];
  strength: "exact" | "similar";
  detailUrl?: string;
};

type TrademarkResult = {
  state: "ok" | "partial" | "unconfigured" | "unavailable";
  totalLiveMatches: number;
  exactMatches: TrademarkMatch[];
  similarMatches: TrademarkMatch[];
  message: string;
};

type SocialResult = {
  network: "Instagram" | "X" | "LinkedIn";
  handle: string;
  url: string;
  status: "available" | "registered" | "unknown";
  confidence: "high" | "medium" | "low";
  note?: string;
};

type ScreeningResult = {
  name: string;
  industry: string;
  state: string;
  score: number;
  risk: string;
  recommendation: string;
  domains: DomainResult[];
  registry: RegistryResult;
  trademarks: TrademarkResult;
  social: SocialResult[];
  checkedAt: string;
  sources: {
    virginiaScc: string;
    uspto: string;
    linkedin: string;
    instagram: string;
    x: string;
  };
  notes: {
    registry: string;
    trademark: string;
    social: string;
    score: string;
  };
};

const industries = [
  "Technology / Cybersecurity",
  "Professional Services",
  "Retail / E-commerce",
  "Food / Hospitality",
  "Construction / Trades",
  "Health / Wellness",
  "Real Estate",
  "Finance / Insurance",
  "Media / Creative",
  "Other",
];

function Brand() {
  return (
    <a className="brand" href="#top" aria-label="BizNameLens home">
      <span className="brand-mark" aria-hidden="true"><span className="brand-mark-dot" /></span>
      <span>BizNameLens</span>
    </a>
  );
}

function DomainPill({ item }: { item: DomainResult }) {
  const label = item.status === "registered" ? "Taken" : item.status === "available" ? "Available" : "Unknown";
  return (
    <div className={`domain-row domain-${item.status}`}>
      <span>{item.domain}</span>
      <span className="status-pill">{label}</span>
    </div>
  );
}

function ResultRow({ label, status, tone = "unknown", href }: { label: string; status: string; tone?: "available" | "registered" | "unknown"; href?: string }) {
  const content = (
    <>
      <span>{label}</span>
      <span className="status-pill">{status}</span>
    </>
  );
  return href ? (
    <a className={`domain-row domain-${tone}`} href={href} target="_blank" rel="noreferrer">{content}</a>
  ) : (
    <div className={`domain-row domain-${tone}`}>{content}</div>
  );
}

function CheckCard({ icon, title, eyebrow, status, statusTone, children }: {
  icon: React.ReactNode;
  title: string;
  eyebrow: string;
  status: string;
  statusTone: "good" | "warn" | "manual";
  children: React.ReactNode;
}) {
  return (
    <article className="check-card">
      <div className="check-card-top">
        <span className="check-icon">{icon}</span>
        <span className={`check-status status-${statusTone}`}>{status}</span>
      </div>
      <p className="card-eyebrow">{eyebrow}</p>
      <h3>{title}</h3>
      {children}
    </article>
  );
}

function ScoreRing({ score }: { score: number }) {
  const degree = Math.round((score / 100) * 360);
  return (
    <div className="score-ring" style={{ "--score": `${degree}deg` } as React.CSSProperties}>
      <div className="score-ring-inner"><strong>{score}</strong><span>/ 100</span></div>
    </div>
  );
}

export default function Home() {
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState(industries[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ScreeningResult | null>(null);

  const recommendation = useMemo(() => result?.recommendation ?? "A strong name should survive more than one check. BizNameLens brings the important signals together before you file, buy a domain, or invest in a brand.", [result]);

  async function runCheck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, industry, state: "Virginia" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Unable to run the check.");
      setResult(data);
      setTimeout(() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to run the check.");
    } finally {
      setLoading(false);
    }
  }

  const registryRows = result ? [...result.registry.exactMatches, ...result.registry.similarMatches].slice(0, 3) : [];
  const trademarkRows = result ? [...result.trademarks.exactMatches, ...result.trademarks.similarMatches].slice(0, 3) : [];

  return (
    <main id="top">
      <div className="page-noise" aria-hidden="true" />
      <header className="site-header">
        <div className="shell header-inner">
          <Brand />
          <nav className="desktop-nav" aria-label="Primary navigation">
            <a href="#how-it-works">How it works</a>
            <a href="#checks">What we check</a>
            <a href="#faq">FAQ</a>
          </nav>
          <a className="nav-cta" href="#search">Check a name <ArrowRight size={16} /></a>
        </div>
      </header>

      <section className="hero shell">
        <div className="hero-glow hero-glow-one" aria-hidden="true" />
        <div className="hero-glow hero-glow-two" aria-hidden="true" />
        <div className="hero-copy">
          <div className="eyebrow-badge"><Radar size={15} /> Virginia-first business name intelligence</div>
          <h1>Know before you <span>name it.</span></h1>
          <p className="hero-subtitle">One search screens a business name across Virginia entity data, federal trademarks, domains, social handles, and overall naming risk.</p>
          <div className="hero-proof">
            <span><CheckCircle2 size={16} /> Live USPTO data</span>
            <span><CheckCircle2 size={16} /> Live domain checks</span>
            <span><CheckCircle2 size={16} /> Founder-friendly results</span>
          </div>
        </div>

        <form className="search-panel" id="search" onSubmit={runCheck}>
          <div className="panel-accent" />
          <div className="search-heading">
            <span className="search-icon-wrap"><Search size={20} /></span>
            <div><p>Start with a name</p><span>We&apos;ll pull the important signals into one view.</span></div>
          </div>
          <label className="field-label" htmlFor="business-name">Business name</label>
          <div className="name-field">
            <input id="business-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Elara" autoComplete="organization" required />
            <Sparkles size={18} />
          </div>
          <div className="field-grid">
            <label className="field-group">
              <span className="field-label">Industry</span>
              <span className="select-wrap">
                <select value={industry} onChange={(event) => setIndustry(event.target.value)}>{industries.map((item) => <option key={item}>{item}</option>)}</select>
                <ChevronDown size={16} />
              </span>
            </label>
            <label className="field-group">
              <span className="field-label">State</span>
              <span className="select-wrap locked-select"><select value="Virginia" disabled><option>Virginia</option></select><span className="beta-tag">MVP</span></span>
            </label>
          </div>
          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? <span className="spinner" /> : <Search size={18} />}
            {loading ? "Pulling live sources..." : "Analyze my business name"}
            {!loading && <ArrowRight size={18} />}
          </button>
          {error && <p className="form-error">{error}</p>}
          <p className="search-disclaimer">Screening tool only. Not legal advice or a guarantee of availability.</p>
        </form>
      </section>

      <section className="signal-strip">
        <div className="shell signal-grid">
          <div><Building2 size={19} /><span><strong>Virginia SCC</strong><small>Registry data</small></span></div>
          <div><ShieldCheck size={19} /><span><strong>USPTO</strong><small>Live federal marks</small></span></div>
          <div><Globe2 size={19} /><span><strong>Domains</strong><small>Live RDAP</small></span></div>
          <div><AtSign size={19} /><span><strong>Social</strong><small>Best-effort handles</small></span></div>
          <div><Sparkles size={19} /><span><strong>Name score</strong><small>Combined screening</small></span></div>
        </div>
      </section>

      <section className="results-section shell" id="results">
        <div className="section-kicker">Your naming dashboard</div>
        <div className="section-heading-row">
          <div>
            <h2>{result ? `A clearer view of “${result.name}”` : "See the whole picture, not one green check."}</h2>
            <p>{result ? `Live screening for ${result.industry} in Virginia.` : "A state filing can be available while the trademark, domain, or market is crowded. BizNameLens shows those tradeoffs together."}</p>
          </div>
          {result && <span className="live-badge"><span /> Live sources checked</span>}
        </div>

        <div className="result-dashboard">
          <aside className="score-card">
            <div><p className="card-eyebrow">BizName Score</p><h3>{result ? result.risk : "Screening confidence"}</h3></div>
            <ScoreRing score={result?.score ?? 78} />
            <p className="score-copy">{recommendation}</p>
            <div className="score-rule" />
            <p className="score-note"><TriangleAlert size={15} /> Preliminary screening indicator only — not a legal-clearance percentage.</p>
          </aside>

          <div className="check-grid" id="checks">
            <CheckCard
              icon={<Building2 size={21} />}
              title="Virginia business registry"
              eyebrow="State registration"
              status={result?.registry.state === "ok" ? "Data connected" : result?.registry.state === "partial" ? "Partial data" : "Needs API key"}
              statusTone={result?.registry.state === "ok" ? "good" : "manual"}
            >
              <p>{result?.registry.message ?? "Automated Virginia entity matching can use an SCC-derived dataset provider, with the official SCC search kept as the final source of record."}</p>
              {registryRows.length > 0 && <div className="domain-list">{registryRows.map((item, index) => <ResultRow key={`${item.name}-${index}`} label={item.name} status={item.strength === "exact" ? "Exact" : item.status || "Similar"} tone={item.strength === "exact" ? "registered" : "unknown"} />)}</div>}
              <a href={result?.sources.virginiaScc ?? "https://cis.scc.virginia.gov/EntitySearch/Index"} target="_blank" rel="noreferrer">Confirm in Virginia SCC <ExternalLink size={14} /></a>
            </CheckCard>

            <CheckCard
              icon={<ShieldCheck size={21} />}
              title="Federal trademarks"
              eyebrow="USPTO screening"
              status={result?.trademarks.state === "ok" ? "Live data" : "Check manually"}
              statusTone={result?.trademarks.exactMatches.length ? "warn" : result?.trademarks.state === "ok" ? "good" : "manual"}
            >
              <p>{result?.trademarks.message ?? "BizNameLens queries the public backend used by USPTO Trademark Search and surfaces live candidate marks."}</p>
              {trademarkRows.length > 0 && <div className="domain-list">{trademarkRows.map((item, index) => <ResultRow key={`${item.wordmark}-${index}`} label={item.wordmark} status={item.strength === "exact" ? "Exact live mark" : "Similar live mark"} tone={item.strength === "exact" ? "registered" : "unknown"} href={item.detailUrl} />)}</div>}
              <a href={result?.sources.uspto ?? "https://tmsearch.uspto.gov/"} target="_blank" rel="noreferrer">Open USPTO Trademark Search <ExternalLink size={14} /></a>
            </CheckCard>

            <CheckCard
              icon={<Globe2 size={21} />}
              title="Domain availability"
              eyebrow="Digital presence"
              status={result?.domains?.[0]?.status === "available" ? "Primary .com open" : "Live RDAP"}
              statusTone={result?.domains?.[0]?.status === "available" ? "good" : "manual"}
            >
              <div className="domain-list">{(result?.domains ?? [
                { domain: "yourname.com", status: "registered" as const },
                { domain: "getyourname.com", status: "available" as const },
                { domain: "yournamehq.com", status: "available" as const },
              ]).slice(0, 4).map((item) => <DomainPill key={item.domain} item={item} />)}</div>
            </CheckCard>

            <CheckCard
              icon={<AtSign size={21} />}
              title="Social & company presence"
              eyebrow="Identity consistency"
              status="Live probes"
              statusTone="manual"
            >
              <p>Networks frequently block automated checks, so BizNameLens only labels a handle when the public response is clear.</p>
              <div className="domain-list">
                {(result?.social ?? []).map((item) => <ResultRow key={item.network} label={`${item.network} @${item.handle}`} status={item.status === "registered" ? "Taken" : item.status === "available" ? "Looks open" : "Unknown"} tone={item.status} href={item.url} />)}
              </div>
              {!result && <div className="mini-links"><a href="https://www.linkedin.com/" target="_blank" rel="noreferrer">LinkedIn</a><a href="https://www.instagram.com/" target="_blank" rel="noreferrer">Instagram</a><a href="https://x.com/" target="_blank" rel="noreferrer">X</a></div>}
            </CheckCard>
          </div>
        </div>
      </section>

      <section className="how-section" id="how-it-works">
        <div className="shell">
          <div className="center-heading"><span className="section-kicker">From idea to informed decision</span><h2>One name. Four lenses. One recommendation.</h2><p>Designed for founders who want a fast first pass without pretending naming risk is black and white.</p></div>
          <div className="steps-grid">
            {[
              ["01", "Enter the name", "Tell us the business name, industry, and where you plan to form."],
              ["02", "Pull the sources", "We query the connected registry, trademark, domain, and social providers."],
              ["03", "Understand the risk", "See exact matches, similar uses, digital constraints, and unavailable sources."],
              ["04", "Choose your next move", "Keep the name, test a variation, or go deeper before you spend money."],
            ].map(([number, title, copy]) => <article className="step-card" key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></article>)}
          </div>
        </div>
      </section>

      <section className="promise-section shell">
        <div className="promise-card">
          <div className="promise-copy">
            <span className="section-kicker light">Built around the real founder question</span>
            <h2>“Can I realistically build a business around this name?”</h2>
            <p>Availability is only the first layer. BizNameLens combines legal-data signals, digital ownership, naming strength, and practical brand risk in one place.</p>
            <div className="promise-list"><span><Check size={16} /> State-registry first</span><span><Check size={16} /> Live federal trademark candidates</span><span><Check size={16} /> No fake “legally safe” percentages</span></div>
          </div>
          <div className="lens-visual" aria-hidden="true"><div className="orbit orbit-one"><span /></div><div className="orbit orbit-two"><span /></div><div className="lens-core"><Layers3 size={36} /></div></div>
        </div>
      </section>

      <section className="faq-section shell" id="faq">
        <div className="center-heading"><span className="section-kicker">FAQ</span><h2>Useful screening, with honest limits.</h2></div>
        <div className="faq-grid">
          <article><h3>Is the USPTO result live?</h3><p>Yes when the provider reports “Live data.” BizNameLens uses the public search backend used by the official USPTO Trademark Search application, which is undocumented and may change.</p></article>
          <article><h3>Why can Virginia SCC still need confirmation?</h3><p>The official CIS name search is protected by reCAPTCHA and does not publish a simple documented public API. Automated matches can come from SCC-derived open-data mirrors, while CIS remains the source to confirm before filing.</p></article>
          <article><h3>Is a high score legal clearance?</h3><p>No. Trademark conflicts depend on similarity, goods and services, geography, and other legal factors. The score is a founder-friendly screening signal, not legal advice.</p></article>
        </div>
      </section>

      <section className="closing-section shell">
        <div className="closing-card"><span className="section-kicker">Ready to test a name?</span><h2>Find the weak spots before they get expensive.</h2><a className="primary-button" href="#search">Analyze a business name <ArrowRight size={18} /></a></div>
      </section>

      <footer className="site-footer"><div className="shell"><Brand /><p>Business-name screening for founders. Always verify official records before filing or relying on a result.</p></div></footer>
    </main>
  );
}
