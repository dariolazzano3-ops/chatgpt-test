# Gelato Eistorten-Anfrage V127 | PRIVATE SYNTHETIC DEMO ONLY

## Current state
- Reuses original 24 creations and original images, original style and 41 existing flavor labels, existing private Cloudflare Access Worker.
- Clicking a creation automatically sets the form selection and appropriate product type. Types and sizes are bound: Eistorte/Spaghetti-Eistorte 18/20/24/26 cm; Eisbombe 40/60 Kugeln.
- Two *different* flavors required for Eistorten, one to six for Eisbomben, with sample decoration and optional example wishes.
- Wunschtermin is a request, *not* a confirmation. Lead times are **recommendations** only, and no new prices, dates, guarantees or payment paths are introduced.
- The private form first verifies /api/cakes-interest/status and remains fully disabled without an explicit synthetic-only response.
- Server enforces same-origin JSON, 4096-byte limit, strict creation/type/size/flavor/date validity, honeypot, synthetic name and reserved example.test address, plus allowlisted non-personal sample decoration texts.
- No database, retention, email, CRM, logs of submissions or bookings. Success confirms only a synthetic validation and ephemeral receipt.
- The original Events endpoint remains delegated to its V126 Worker.
- No form data is persisted client-side either; no localStorage, cookies, tracking, email API.
- No-JS fallback is the existing contact telephone and private demo remains inaccessible without Cloudflare Access.

## Human approval required before real customers
1. Confirm legal controller name/address/contact and provide complete privacy notice covering purpose, legal basis (often Art. 6(1)(b) pre-contractual enquiry), retention/deletion policy and processors. No blanket marketing opt-in. Review consent only where legally necessary.
2. Approve separate Cloudflare D1/other limited-access storage, data minimization, encryption/security and retention rules, admin access and audit, deletion and access-request procedures.
3. Approve notification channel and transactional sender, credentials and scope; notification delivery monitoring/retries/idempotency; anti-abuse limits/Turnstile and privacy.
4. Replace fixed synthetic-only validation with production validation only under explicit owner GO after privacy review; do not carry test fake names into real mode.
5. Complete secure E2E review including abuse cases, delivery, expiry/deletion, owner-verified sample enquiries, rollback.
6. Production deployment, DNS, paid calls and real-data collection remain expressly forbidden until separate GO.

The private test can be completed without customers telephoning. Actual real submissions cannot happen by design.
