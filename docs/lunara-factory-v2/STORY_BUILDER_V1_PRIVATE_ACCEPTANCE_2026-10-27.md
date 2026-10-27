# LUNARA STORY BUILDER V1 | PRIVATE STAGING ACCEPTANCE
Date: 2026-10-27. Project: Lunara Factory V2. All sales and fulfillment disabled.

## Reuse-first implementation
- Updated **the existing** Cloudflare Worker `lunara-factory-v2-private` rather than create a new shop or alter unrelated websites.
- GitHub source: `src/lunara-factory-v2/private-preview-worker.js`, branch `factory/lunara-factory-v2-stripe-make-v1-20261026`.
- Final verified commit: `9dbe9f0675522485a4826f08062ffb277468f8db`.
- Protected URL: `https://lunara-factory-v2-private.gelato-donatello-dario-a5a5376c.workers.dev/story-builder/`.
- Existing Cloudflare Access application `90770e3f-afcd-4b50-8e96-8a21e90596f1` retains a **single owner email allow policy** and no everyone allow.
- Unauthenticated live probes for `/`, `/story-builder/`, `/health`, `/api/checkout` returned HTTP 302 to Cloudflare Access sign-in.

## Scope implemented
- Original Lunara color and moon/star design cues reconstructed in lightweight CSS and accessible HTML. These visuals evoke the original Mia book but do **not** yet embed its original background JPEG assets; premium PDF renderer integration remains a separate task.
- Responsive front end: `/` intro and dedicated `/story-builder/` wizard, built mobile-first without external assets, remote fonts or third-party analytics.
- Step 1: child first name (required, maxlength 40), age 2–7 (required; original Make story prompt age range).
- Step 2: optional plush toy, plush name, interest chips/free text, and calming preference. Unknown optional details are never forced.
- Step 3: six child-friendly, calming dreamworld choices and custom dreamworld prompt, respecting original Lunara's gentle bedtime tone.
- Step 4: secure on-device summary, live personal cover title `Schlaf gut, <child>`, and explicit checkout unavailable state.
- All content is displayed via `textContent` rather than inserting user-supplied text into HTML.

## Safety and integration contract
- Browser-only data, no database writes, no fetch/XHR, no sessionStorage/localStorage, no customer-email field and no signup requirement.
- The client-only draft is `schema=lunara.story.draft.v1`, `mode=preview`. This must never be fed directly into `lunara.order.paid.v2` Make flows.
- Existing API/checkout/orders routes return HTTP 423 in the Worker, with Cloudflare Access gate outside.
- `/health` confirms `checkout_enabled:false`, `make_dispatch_enabled:false`, `audio_enabled:false`, `customer_data_storage:false`.
- CSP: `default-src 'none'`, inline scripts/styles only, `form-action 'none'`, `frame-ancestors 'none'`; robots noindex and referrer policy no-referrer.
- No Stripe keys, webhook URLs, Make credentials or service tokens in the browser Worker.
- Make scenarios `5464576` (original 90-module) and `8209196` (29-module sandbox) independently verified **inactive** after release.

## Verification actually performed
- Two scripts (Cloudflare Worker and inline frontend JS) passed `node --check`.
- Cloudflare API uploaded Worker with HTTP 200; deployed source re-read and checked for latest draft schema, route handler and locked APIs.
- Automated Chromium-backed browser test via Cloudflare Browser Rendering **passed**: nav opens builder, live cover name updates, ages and steps advance, toy and dreamworld appear in summary, all six theme cards render, checkout button is disabled, no external image URLs, no forms.
- Nine local Worker HTTP route assertions passed with Node's `Request/Response` and isolated fetch handler: GET `/`, `/story-builder`, `/story-builder/`, `/health`; POST `/api/checkout`, GET `/api/orders`, POST `/checkout` all 423; invalid path and wrong method 404.
- Actual anonymous HTTPS requests to Cloudflare Worker were redirected HTTP 302 to Access login.
- **Visual browser layout QA at 375px/390px and desktop 1440px was attempted but Cloudflare Browser Rendering returned HTTP 429 rate limited; mark unverified, do not claim mobile screenshot QA.**

## Gates before launch
1. Visually review on iPhone Safari and desktop, including keyboard, field focus, cross-step spacing, back navigation and content wrapping.
2. Connect original brand JPEG to a new secure premium **book/PDF rendering** path; no promise that CSS-only cover is exact asset.
3. Complete signed Stripe test webhook → D1 paid reconciliation; previous test remains pending.
4. Server-side validate and sanitize the original Lunara input, create uniquely paid order ID, dispatch **only after** verified Stripe test mode event and D1 claim.
5. Preserve original 90-module Dreamworld, story creation, editing, final polish, QA + one repair and second QA; do not replace with simplified prompts.
6. Connect post-QA premium PDF with one-time private R2 upload and controlled test email; enforce 30-day media retention and real order data deletion obligations.
7. Impressum, Datenschutz, digital-goods checkout/withdrawal and separate live launch authorization required.

## Scope exclusions
- No customer accounts, live checkout, price charge, live Make dispatch, Google Workspace dependency changes, external sends, DNS changes or public deployment.
