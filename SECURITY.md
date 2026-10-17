# BizNameLens security controls

## Name-search abuse protection

`POST /api/check` uses layered controls before any Virginia, USPTO, domain, or social provider calls are made:

1. Application burst limiting: 6 requests per minute and 30 per hour per client IP on a warm application instance.
2. Vercel BotID: browser-side protection plus `checkBotId()` server verification blocks detected automated traffic.
3. Signed free-usage quota: 10 total anonymous searches per browser for the MVP.
4. Progressive Cloudflare Turnstile: the first 3 searches are frictionless; searches 4 through 10 require a fresh Turnstile token. Tokens are verified with Cloudflare Siteverify and are single-use.
5. Paywall: after 10 searches, the API returns `FREE_LIMIT_REACHED` before external providers are queried.

The application burst limiter is defense in depth only because Vercel Functions can run across multiple instances. Production should also use a Vercel Firewall rate-limit rule on `/api/check`, ideally keyed by IP, so abusive traffic is stopped at the edge before invoking application code.

## Production environment variables

- `USAGE_SIGNING_SECRET`: long random secret used to sign the anonymous usage cookie.
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`: Cloudflare Turnstile public site key for the production hostname.
- `TURNSTILE_SECRET_KEY`: corresponding private Turnstile secret.

Do not use Cloudflare's test Turnstile credentials in production. Development falls back to official always-pass test credentials only when `NODE_ENV` is not `production`.

## Recommended Vercel Firewall configuration

Create a rate-limit rule for path `/api/check` and method `POST`:

- Key: client IP
- Initial threshold: 6 requests / 60 seconds
- Action: rate limit or managed challenge

A second wider rule can be used around 30 requests / hour / IP. Tune these thresholds from production traffic so shared networks do not cause unnecessary false positives.

Enable Vercel BotID for the project. Basic BotID is sufficient for the initial launch; Deep Analysis can be evaluated later if automated abuse becomes persistent.
