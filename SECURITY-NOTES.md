# Security rollout checklist

Before production launch:

- Set a long random `USAGE_SIGNING_SECRET` in Vercel Production.
- Create a Cloudflare Turnstile widget for the production BizNameLens hostname.
- Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` in Vercel Production.
- Enable Vercel BotID for the project.
- Add a Vercel Firewall rate-limit rule for `POST /api/check` keyed by IP. Start around 6 requests per 60 seconds and tune from real traffic.
- Consider a second wider rate-limit rule around 30 requests per hour per IP.
- Confirm `OPENDATA_API_KEY` is present if automated Virginia entity matching is expected.
- Test search 1-3 without a Turnstile prompt, search 4+ with Turnstile, and search 11 returning the pricing/paywall flow.
- Test a repeated/replayed Turnstile token and confirm it fails.
- Test a burst of requests and confirm 429 responses occur before provider calls.

The in-process rate limiter is only defense in depth; Vercel edge rate limiting should remain the primary burst-control layer in production.
