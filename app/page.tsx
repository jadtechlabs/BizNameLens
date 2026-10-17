"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  ArrowRight,
  AtSign,
  BadgeCheck,
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

type ScreeningResult = {
  name: string;
  industry: string;
  state: string;
  score: number;
  risk: string;
  domains: DomainResult[];
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
      <span className="brand-mark" aria-hidden="true">
        <span className="brand-mark-dot" />
      </span>
      <span>BizNameLens</span>
    </a>
  );
}

function DomainPill({ item }: { item: DomainResult }) {
  const label = item.status === "registered" ? "Taken" : item.status === "available" ? "Available" : "Check manually";
  return (
    <div className={`domain-row domain-${item.status}`}>
      <span>{item.domain}</span>
      <span className="status-pill">{label}</span>
    </div>
  );
}

function CheckCard({
  icon,
  title,
  eyebrow,
  status,
  statusTone,
  children,
}: {
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
      <div className="score-ring-inner">
        <strong>{score}</strong>
        <span>/ 100</span>
      </div>
    </div>
  );
}

export default function Home() {
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState(industries[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ScreeningResult | null>(null);

  const recommendation = useMemo(() => {
    if (!result) return "A strong name should survive more than one check. BizNameLens brings the important signals together before you file, buy a domain, or invest in a brand.";
    const primary = result.domains[0];
    if (result.score >= 82) {
      return `${result.name} has a strong early screening profile. The name is concise and the digital signals are encouraging. Confirm the official Virginia SCC and USPTO searches before you commit.`;
    }
    if (primary?.status === "registered") {
      return `${result.name} is still worth evaluating, but the primary .com is already registered and the legal checks still need confirmation. Review the official registry and trademark results before spending on the brand.`;
    }
    return `${result.name} shows a mixed early profile. Before investing heavily, confirm the Virginia entity search, review similar federal marks, and consider a more distinctive variation if conflicts appear.`;
  }, [result]);

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
          <a className="nav-cta" href="#search">
            Check a name <ArrowRight size={16} />
          </a>
        </div>
      </header>

      <section className="hero shell">
        <div className="hero-glow hero-glow-one" aria-hidden="true" />
        <div className="hero-glow hero-glow-two" aria-hidden="true" />
        <div className="hero-copy">
          <div className="eyebrow-badge">
            <Radar size={15} /> Virginia-first business name intelligence
          </div>
          <h1>
            Know before you <span>name it.</span>
          </h1>
          <p className="hero-subtitle">
            One search helps you screen a business name across state registration, federal trademarks, domains, social handles, and overall brand risk.
          </p>
          <div className="hero-proof">
            <span><CheckCircle2 size={16} /> Free screening</span>
            <span><CheckCircle2 size={16} /> No account required</span>
            <span><CheckCircle2 size={16} /> Founder-friendly results</span>
          </div>
        </div>

        <form className="search-panel" id="search" onSubmit={runCheck}>
          <div className="panel-accent" />
          <div className="search-heading">
            <span className="search-icon-wrap"><Search size={20} /></span>
            <div>
              <p>Start with a name</p>
              <span>We&apos;ll put the important signals in one view.</span>
            </div>
          </div>

          <label className="field-label" htmlFor="business-name">Business name</label>
          <div className="name-field">
            <input
              id="business-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Elara"
              autoComplete="organization"
              required
            />
            <Sparkles size={18} />
          </div>

          <div className="field-grid">
            <label className="field-group">
              <span className="field-label">Industry</span>
              <span className="select-wrap">
                <select value={industry} onChange={(event) => setIndustry(event.target.value)}>
                  {industries.map((item) => <option key={item}>{item}</option>)}
                </select>
                <ChevronDown size={16} />
              </span>
            </label>
            <label className="field-group">
              <span className="field-label">State</span>
              <span className="select-wrap locked-select">
                <select value="Virginia" disabled>
                  <option>Virginia</option>
                </select>
                <span className="beta-tag">MVP</span>
              </span>
            </label>
          </div>

          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? <span className="spinner" /> : <Search size={18} />}
            {loading ? "Checking signals..." : "Analyze my business name"}
            {!loading && <ArrowRight size={18} />}
          </button>
          {error && <p className="form-error">{error}</p>}
          <p className="search-disclaimer">Screening tool only. Not legal advice or a guarantee of availability.</p>
        </form>
      </section>

      <section className="signal-strip">
        <div className="shell signal-grid">
          <div><Building2 size={19} /><span><strong>Virginia SCC</strong><small>Entity registry</small></span></div>
          <div><ShieldCheck size={19} /><span><strong>USPTO</strong><small>Federal marks</small></span></div>
          <div><Globe2 size={19} /><span><strong>Domains</strong><small>Live .com signal</small></span></div>
          <div><AtSign size={19} /><span><strong>Social</strong><small>Handle pathways</small></span></div>
          <div><Sparkles size={19} /><span><strong>Name score</strong><small>Brand screening</small></span></div>
        </div>
      </section>

      <section className="results-section shell" id="results">
        <div className="section-kicker">Your naming dashboard</div>
        <div className="section-heading-row">
          <div>
            <h2>{result ? `A clearer view of “${result.name}”` : "See the whole picture, not one green check."}</h2>
            <p>{result ? `Early screening for ${result.industry} in Virginia.` : "A state filing can be available while the trademark, domain, or market is crowded. BizNameLens is designed to show the tradeoffs together."}</p>
          </div>
          {result && <span className="live-badge"><span /> Checked just now</span>}
        </div>

        <div className="result-dashboard">
          <aside className="score-card">
            <div>
              <p className="card-eyebrow">BizName Score</p>
              <h3>{result ? result.risk : "Screening confidence"}</h3>
            </div>
            <ScoreRing score={result?.score ?? 78} />
            <p className="score-copy">{recommendation}</p>
            <div className="score-rule" />
            <p className="score-note"><TriangleAlert size={15} /> This score is a preliminary indicator, never a legal-clearance percentage.</p>
          </aside>

          <div className="check-grid" id="checks">
            <CheckCard icon={<Building2 size={21} />} title="Virginia business registry" eyebrow="State registration" status="Official check" statusTone="manual">
              <p>Search the Virginia SCC source of record before filing. Automated registry matching is the next connector on the roadmap.</p>
              <a href={result?.sources.virginiaScc ?? "https://cis.scc.virginia.gov/EntitySearch/Index"} target="_blank" rel="noreferrer">Open Virginia SCC <ExternalLink size={14} /></a>
            </CheckCard>

            <CheckCard icon={<ShieldCheck size={21} />} title="Federal trademarks" eyebrow="USPTO screening" status="Review required" statusTone="warn">
              <p>Look for similar live and pending marks, especially in related goods and services. Similarity matters more than exact spelling.</p>
              <a href={result?.sources.uspto ?? "https://tmsearch.uspto.gov/search/search-information"} target="_blank" rel="noreferrer">Search USPTO <ExternalLink size={14} /></a>
            </CheckCard>

            <CheckCard icon={<Globe2 size={21} />} title="Domain availability" eyebrow="Digital presence" status={result?.domains?.[0]?.status === "available" ? "Live signal" : "Domain scan"} statusTone={result?.domains?.[0]?.status === "available" ? "good" : "manual"}>
              <div className="domain-list">
                {(result?.domains ?? [
                  { domain: "yourname.com", status: "registered" as const },
                  { domain: "getyourname.com", status: "available" as const },
                  { domain: "yournamehq.com", status: "available" as const },
                ]).slice(0, 3).map((item) => <DomainPill key={item.domain} item={item} />)}
              </div>
            </CheckCard>

            <CheckCard icon={<AtSign size={21} />} title="Social & company presence" eyebrow="Identity consistency" status="Manual paths" statusTone="manual">
              <p>Check the places where customers are most likely to discover or verify your brand.</p>
              <div className="mini-links">
                <a href={result?.sources.linkedin ?? "https://www.linkedin.com/search/results/companies/"} target="_blank" rel="noreferrer">LinkedIn</a>
                <a href={result?.sources.instagram ?? "https://www.instagram.com/"} target="_blank" rel="noreferrer">Instagram</a>
                <a href={result?.sources.x ?? "https://x.com/"} target="_blank" rel="noreferrer">X</a>
              </div>
            </CheckCard>
          </div>
        </div>
      </section>

      <section className="how-section" id="how-it-works">
        <div className="shell">
          <div className="center-heading">
            <span className="section-kicker">From idea to informed decision</span>
            <h2>One name. Four lenses. One recommendation.</h2>
            <p>Designed for founders who want a fast first pass without pretending that naming risk is black and white.</p>
          </div>
          <div className="steps-grid">
            {[
              ["01", "Enter the name", "Tell us the business name, industry, and where you plan to form."],
              ["02", "Scan the signals", "We organize the registry, trademark, domain, social, and brandability checks."],
              ["03", "Understand the risk", "See what looks clear, what needs manual confirmation, and where conflicts may exist."],
              ["04", "Choose your next move", "Keep the name, test a variation, or go deeper before you spend money filing and branding."],
            ].map(([number, title, copy]) => (
              <article className="step-card" key={number}>
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="promise-section shell">
        <div className="promise-card">
          <div className="promise-copy">
            <span className="section-kicker light">Built around the real founder question</span>
            <h2>“Can I realistically build a business around this name?”</h2>
            <p>Availability is only the first layer. BizNameLens is being built to help you understand legal signals, digital ownership, naming strength, and practical brand risk in one place.</p>
            <div className="promise-list">
              <span><Check size={16} /> State-registry first</span>
              <span><Check size={16} /> Transparent about manual checks</span>
              <span><Check size={16} /> No fake “legally safe” percentages</span>
            </div>
          </div>
          <div className="lens-visual" aria-hidden="true">
            <div className="orbit orbit-one"><span /></div>
            <div className="orbit orbit-two"><span /></div>
            <div className="lens-core"><Layers3 size={36} /></div>
          </div>
        </div>
      </section>

      <section className="faq-section shell" id="faq">
        <div className="center-heading compact">
          <span className="section-kicker">Good to know</span>
          <h2>Frequently asked questions</h2>
        </div>
        <div className="faq-grid">
          {[
            ["Does a good score mean the name is legally safe?", "No. The score is a preliminary screening indicator. Trademark clearance depends on similarity, goods and services, geography, existing rights, and other facts."],
            ["Why start with Virginia?", "The MVP is intentionally Virginia-first so the state-registry experience can be excellent before expanding to more jurisdictions."],
            ["Are domain results live?", "The current MVP performs a live RDAP signal for .com candidates. A result can still require registrar confirmation before purchase."],
            ["Will SCC and USPTO become automatic?", "That is the goal. Until reliable connectors are in place, BizNameLens sends you to the official sources rather than inventing a verdict."],
          ].map(([question, answer]) => (
            <article className="faq-card" key={question}>
              <BadgeCheck size={20} />
              <div><h3>{question}</h3><p>{answer}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className="closing-cta shell">
        <div className="closing-card">
          <div>
            <span className="section-kicker light">Before you file, buy, or brand</span>
            <h2>Put your next business name through the lens.</h2>
          </div>
          <a href="#search" className="light-button">Check a business name <ArrowRight size={17} /></a>
        </div>
      </section>

      <footer className="footer">
        <div className="shell footer-grid">
          <div>
            <Brand />
            <p>Founder-friendly business name screening, starting with Virginia.</p>
          </div>
          <div className="footer-meta">
            <span>Virginia-first MVP</span>
            <span>Screening only · not legal advice</span>
            <span>© 2026 BizNameLens</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
