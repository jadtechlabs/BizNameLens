# BizNameLens

**Know before you name it.**

BizNameLens is a Virginia-first business-name screening experience designed to answer a more useful founder question than “is this LLC name available?”

> **Can I realistically build a business around this name?**

The MVP brings together the signals that matter before a founder files, buys a domain, or invests in branding:

- Virginia entity-name matching
- Live federal trademark candidate screening
- Live domain availability through RDAP
- Alternate domain ideas
- Conservative social/company-presence probes
- A founder-friendly BizName Score and recommendation

## Live data integrations

### USPTO Trademark Search

BizNameLens discovers and queries the public search service used by the official USPTO Trademark Search web application. It returns live candidate marks, distinguishes exact wording from similar results, and links serial numbers to TSDR for record review.

No USPTO API key is required for the Trademark Search connector. Because the web application's search service is undocumented and versioned, BizNameLens discovers its current service URL at runtime and fails safely to the official search page if the interface changes.

### Domains

Domain checks use the IANA RDAP bootstrap registry to locate the authoritative RDAP service for each top-level domain. A 404 from the authoritative RDAP service is treated as an availability signal; a successful domain record is treated as registered.

The MVP currently checks the primary `.com`, several `.com` variations, and `.net`.

### Virginia business entities

Virginia's official CIS entity/name search remains the source of record. Its live public search is protected by reCAPTCHA and does not expose a documented public name-search API suitable for this app.

BizNameLens therefore includes an adapter for Virginia SCC-derived LLC and corporation datasets exposed by `opendata.best`. To enable it, obtain an API key from that provider and configure:

```bash
OPENDATA_API_KEY=your_key_here
```

Without this key the rest of BizNameLens still works; the Virginia card reports that automated state data is not configured and links directly to the official SCC search for confirmation.

### Social handles

Instagram, X, and LinkedIn do not provide a simple dependable public handle-availability API for this use case. BizNameLens uses conservative public-page probes: only clear not-found/profile signals are classified, and blocked/login/generic responses are reported as **Unknown** rather than guessed.

## Environment variables

Copy `.env.example` to `.env.local` for local development:

```bash
cp .env.example .env.local
```

Available variables:

```bash
# Optional; enables automated Virginia entity matching
OPENDATA_API_KEY=

# Optional override; normally leave at the official USPTO config URL
TMSEARCH_CONFIG_URL=https://tmsearch.uspto.gov/configuration.json
```

For Vercel, add `OPENDATA_API_KEY` under Project Settings → Environment Variables and redeploy.

## BizName Score

The score combines name length/distinctiveness, domain availability, returned Virginia entity matches, live federal trademark candidates, and conservative social signals.

The **BizName Score is a preliminary screening indicator, not a legal-clearance percentage or legal opinion.** A high score does not replace a proper trademark clearance analysis or official state filing check.

## Run locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Production build

```bash
npm run build
npm start
```

GitHub Actions runs TypeScript validation and a production Next.js build on pushes to `main`.

## Product roadmap

1. Improve Virginia registry freshness and add a direct official integration if Virginia publishes a supported API
2. Add industry/class-aware trademark similarity scoring
3. Expand domain extensions and alternative-name generation
4. Improve social verification through supported APIs where available
5. Add broader web/company-presence screening
6. Expand state-by-state after the Virginia workflow is strong
7. Add saved reports, shareable results, and founder decision history

## Design principle

BizNameLens should feel simple enough for a first-time founder while staying honest about uncertainty. When a source cannot be checked reliably, the product should say so and point to the official source instead of fabricating certainty.
