# Gelato Donatello Events | architecture and activation gate V117

This is a private-only design draft. There is no published bookable event; interest form intentionally disabled. No personal data, payments, public offers, or emails.

## Source of truth and safe activation

Read data/events-v117.json. Draft values for start, end, capacity, available places, prices are null. Header badge count is 0. A future numeric badge must derive ONLY from verified backend state of a published, bookable event with real capacity, not manually configured. Until proven, never show a numeric badge.

## Staged activation

1. Design (now): static concept, real shop photograph (not represented as an actual lab image), disabled interest UI, no submission.
2. Interest MVP (requires explicit GO): approved privacy notice (purpose, controller, legal basis, retention, data subject rights); approved HTTPS endpoint; origin/CSRF defense, validation, rate limiting; access-controlled storage with retention and deletion; proven delivery and deletion using test identities; marketing consent recorded separately, optional. Never place private service tokens in the browser.
3. Ticketing (requires separate GO): evaluate and reuse pretix Hosted or self-hosted before bespoke checkout. Model event -> dated sessions -> price tiers -> quotas -> orders/payment -> tickets/check-in and waiting lists. Use pretix API, verified webhooks, idempotency, retries, and secrets management. Do not activate payments, confirmations, integrations or live domains without authorization.
4. Operational approvals: dates, capacity, pricing, tax, age/health/hygiene, lab safety, ice amount, cancellation/refunds, accessibility and consent language before publication.

## Reuse-first research

Official: https://docs.pretix.eu/de/ and https://docs.pretix.eu/dev/api/
Self-host pricing: https://pretix.eu/about/de/pricing/selfhosted
No pretix installation or service charge performed. Compare hosted cost, maintenance, payment fees and GDPR/DPA before GO.

## Security boundaries

Only private Cloudflare Access preview through allowlisted GitHub Actions, no DNS or production. Route /events/ is noindex. Disabled fieldset and button are intentionally nonfunctional. Events top shortcut and menu entry work on all routes. Existing brand logo, contact and navigation continue unchanged.
