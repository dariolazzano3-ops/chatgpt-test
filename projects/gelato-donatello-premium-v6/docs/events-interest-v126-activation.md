# Gelato Donatello · Event Interest V126 (Private Test Only)

**NO REAL CUSTOMER DATA / NO BOOKINGS / NO STORAGE / NO EMAIL SENDS**

## Current functionality

- The original Events page, V125 image and design remain.
- Event form sends only synthetic examples to the same-origin Cloudflare Worker API at /api/events-interest. It performs real server-side validation and returns a DEMO receipt.
- HTML form is disabled unless the Worker status endpoint explicitly confirms synthetic-only mode, no storage and no notifications. JavaScript-disabled visitors cannot submit.
- Allowed fields: synthetic names Test Gast, Test Person or Test Kunde; reserved test@example.test address (or test-* at example.test); no phone or 000000; 1–8 seats; optionally a plain sample note beginning TEST:. The server rejects actual-looking contact details, even if the client is bypassed.
- Server requires same Origin, JSON request, <=2KB, allowlisted keys, test confirmation. It does not log, persist, email, notify or book anyone. Response uses no-store with an ephemeral receipt.
- Accessible German success view explicitly states no storage or notification. Marketing consent is disabled in preview. The event has no released price, date, quota or booking.

## Owner-approved activation checklist (all still blocked)

1. Legal and privacy: approve controller/contact details, specific legitimate basis under GDPR Article 6, privacy notice version, recipients, purpose, retention and deletion. No real details collected until then. Marketing opt-in must be separately voluntary and revocable.
2. Isolated secure persistent store: review separate Cloudflare D1 table/database only after explicit GO, restricted access, server-side validation, retention/deletion audit and idempotency. Do not reuse unrelated shared data without approval.
3. Notifications: review and authorize a transactional mailbox/provider and sender, verify scoped secrets and domain, server-side spam protection / Turnstile validation, rate limiting, abuse handling, retries and idempotency. Do not send real messages yet.
4. End-to-end acceptance with synthetic data: valid create/read/notify/delete test, expiry and privacy policy, operational owner signoff, then a separate explicit production GO to permit real people.
5. Ticketing: no event dates, prices, availability or payments. Compare pretix only when actual bookable events are approved.

## Safety and QA

Private Cloudflare Access remains mandatory. Wrangler private-preview config routes only /api/* through Worker and serves all other static assets unchanged. No production deployment, new DNS, payments, or paid APIs.

Node unit tests cover validation, origin/JSON/content-length guards, absence of storage/email and preservation of V125 image. Chromium browser QA covers mobile 360/390/412, desktop 1440, reduced motion and no-JS. Real native iPhone Safari cannot be verified on the VPS.
