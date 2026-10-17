# BizNameLens

**Know before you name it.**

BizNameLens is a Virginia-first business-name screening experience designed to answer a more useful founder question than “is this LLC name available?”

> **Can I realistically build a business around this name?**

The MVP brings together the signals that matter before a founder files, buys a domain, or invests in branding:

- Virginia SCC entity-registration pathway
- Federal trademark screening pathway (USPTO)
- Live `.com` RDAP availability signal
- Alternate domain ideas
- Social/company-presence pathways
- A founder-friendly BizName Score and recommendation

## Current MVP

The site is built with Next.js, React, TypeScript, and custom responsive CSS. The homepage includes a complete interactive search experience and a results dashboard.

The `.com` domain check is live through Verisign RDAP. Virginia SCC and USPTO results currently link to the official source while reliable automated connectors are developed. BizNameLens deliberately does **not** invent a green/red legal verdict when a source cannot be checked reliably.

The **BizName Score is a preliminary screening indicator, not a legal-clearance percentage or legal opinion.**

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

## Product roadmap

1. Automated Virginia SCC name matching and similarity screening
2. Automated USPTO live/pending trademark screening
3. More domain extensions and better alternative-name generation
4. Social-handle checks where reliable APIs/signals exist
5. Similar-company and broader web-presence screening
6. State-by-state expansion after the Virginia workflow is strong
7. Saved reports, shareable results, and founder decision history

## Design principle

BizNameLens should feel simple enough for a first-time founder while staying honest about uncertainty. When a check cannot be completed reliably, the product should say so and point to the official source instead of fabricating certainty.
