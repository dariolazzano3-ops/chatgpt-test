# Gelato Donatello | Premium Quality & Conversion V124

Private QA baseline (15 October 2026). Source baseline: **V123 e5519852af994af4456b641b1e381716dc3c18bb**; private Worker was **version 125**, 100% traffic on identical SHA at inspection. No live production, DNS, payment or email operations were conducted. GitHub working branch is the authoritative source.

## 1. Scope and measured results

- Inspected **10 routes × 2 viewports** (`390×844` iPhone-like Chromium; `1440×900` desktop), plus targeted 360, 390, 412, 1440 responsive interaction runs and browser simulations with JavaScript disabled. Routes: `/`, `/eisbecher/`, `/eissorten/`, `/eistorten/`, `/eistorten-eisbomben/` (legacy alias), `/eisvitrine/`, `/getraenke/`, `/events/`, `/kontakt/`, `/sortiment/`.
- **125 distinct same-origin resource and link paths** checked by local HTTP; 0 returned HTTP errors. Across 20 routes: 0 uncaught JavaScript errors, console errors or horizontal overflow. The homepage contains a deliberately source-less transition `<img>` frame (not an HTTP failure). No broken fetched photo observed.
- Existing assets, original premium location map and brand visuals preserved. Desktop and mobile screenshots reside in the private QA review branch.
- Browser tests additionally verified tab/keyboard switch for Eisbecher, category image resolution, cake request preset, request summary, callable `tel:` link, untouched disabled Events form, no-JS telephone fallback and navigation links.
- Historical CSS complexity: shared `style.css` was **212,274 bytes** before this patch, with ~59 historic version markers. Refactoring broad selectors is deliberately deferred to avoid breaking approved design.

### Local-browser timing and network observations

This is a *single-run, unthrottled, local-server laboratory comparison* using Chromium performance entries and a local Python web server. Values **are not real-user Core Web Vitals or actual Cloudflare production timings**. Network-cache effects and script timing can distort individual LCP/load numbers; the data are useful for prioritization, not SLA or conversion claims.

| Page / viewport | Before transfer | After transfer | Observed difference |
| --- | ---: | ---: | ---: |
| / iphone | 2353 KiB | 1602 KiB | -751 KiB |
| / desktop | 2353 KiB | 1602 KiB | -751 KiB |
| /eisbecher/ iphone | 4986 KiB | 4986 KiB | +0 KiB |
| /eisbecher/ desktop | 5560 KiB | 5560 KiB | +0 KiB |

The initial homepage request transferred **769,052 fewer bytes (~31.9%)** in this local test after deferring the original location-map JPEG and below-fold cake preview. The original image files and one-time map reveal are unchanged; scrolling to the map was verified to still load it sharply. On Eisbecher the initial transferred byte count **did not measurably improve** despite adding `loading=lazy` to four previously eager product photos: the category/hydration strategy needs separate evidence-driven work.

Homepage mobile example: observed LCP 304 ms → 252 ms. These isolated values should **not** be used as a general speed promise. Native iPhone Safari and throttled field measurements remain untested.

## 2. Implemented low-risk changes

1. Below-the-fold map JPEG (`gelato-donatello-original-location-v105.jpg`), first cake thumbnail, and four first Eisbecher product thumbnails now use native lazy loading; visible hero visuals remain eager. Original file bytes untouched.
2. The existing Eistorten and Eisvitrine local-only request-builder shows **“Lieber direkt anrufen”** as an immediate honest secondary path. Submission remains client-side only and results in a local summary, never automatic transmission or a false “request sent” confirmation.
3. Both request sections now have visible `noscript` telephone links so clients without JavaScript can still contact the store. No extra form endpoint, logging, tracking, CRM, database, storage, email or payment call introduced.
4. Restored comprehensive regression trust: corrected two **outdated assertions**, one for pre-optimization cup loading expectations and another for the color palette superseded by V72; the original production color scheme remains unchanged. New V124 gate runs **all project tests** instead of the older selective subset.

## 3. UX design and accessibility review

- Header, brand logo, Event letter/badge (badge describes a private draft, not available seats), location hero, map pin, coffee cup animation and footer retained. No unapproved design rework or added text-heavy block.
- Four Eisbecher categories and their product counts retained; active panel is keyboard-switchable, hidden panels remain reachable without JS. Cakes remain labeled in source data; the request generator preserves selected creation and variant.
- Motion-reduction fallbacks remain in CSS/JS; no perpetual new animations added. Tested desktop Chromium and mobile Chromium emulation; **not native physical iPhone Safari**, nor a full WCAG audit.
- Local href targets were HTTP-checked; outbound Apple/Google booking/service URLs were not independently verified in real apps.

## 4. Conversion and safe activation architecture (design only)

**Current truth:** Existing Eistorten/Eisvitrine forms assemble a local draft and direct the visitor to phone/in-person confirmation; they do not send a business inquiry. The Events UI is intentionally disabled and collects nothing. Do not describe these as operational booking systems or publish event availability based on the preview badge.

**Proposed reusable V1 interest pipeline (NOT activated):** one narrowly scoped form endpoint on an existing Cloudflare Worker; server-side schema validation, HTTPS origin checks, CSRF/idempotency controls, spam/rate limiting, Turnstile token verification by the Worker before storage, D1 or an approved existing database with restricted access, documented retention/deletion, explicit administrative routing to an approved business mailbox and receipt/testing with synthetic data only. Defer any production endpoint and all actual personal-data processing until the controller approves privacy policy (purpose/legal basis/recipients/retention), subprocessor terms, access and logging controls, the email route and a test-to-delete lifecycle. Marketing opt-in must be optional, separate and auditable. No secrets in browser JavaScript.

**Possible request model:** `type (cake|rental|event_interest)`, `selected_product`, `preferred_date`, `variant`, `quantity`, `details`, `contact`, `privacy_notice_version`, separate optional `marketing_consent`; strict per-type validation and retention. Cake/rental enquiry is **not a confirmed order**, date or price commitment. Events must have approved capacity/date/terms before bookings.

**Reuse-first for real event tickets:** evaluate **pretix** Hosted or self-hosted once the owner approves dates, price, quotas, waiting-list policy and payment/legal terms. Pretix has REST resources for events, subevents, quotas, orders, waitlists and webhooks; avoid custom checkout until necessary. No installation or paid accounts created. Relevant docs: https://docs.pretix.eu/dev/api/ and https://developers.cloudflare.com/turnstile/get-started/server-side-validation/ .

## 5. Three largest next improvements, ranked

1. **Turn telephone intent into approved, traceable online enquiries:** implement one privacy-checked shared endpoint for Eistorten/Eisvitrine, and only then Events. Biggest potential conversion unlock, but requires explicit legal/security/send GO; no processing has begun.
2. **Reduce Eisbecher category image transfer:** observed ~4.9 MiB per first mobile visit locally despite native lazy flags. Design a no-JS-friendly progressive image loading strategy (and appropriately sized responsive source files), benchmark 3–5 cold runs before launch.
3. **CSS/real-device launch hygiene:** prune obsolete override layers carefully in isolated increments, add source-of-truth CSS bundles per route and run actual iPhone Safari + throttled Lighthouse/Web Vitals checks before any production proposal. Audit external navigation deep links on physical iOS/Android.

## Safety / release gates

- Preview branch only, deployed exclusively by existing allowlisted private Cloudflare workflow with exact SHA, dry-run, automated tests, no public main modification. Verify Cloudflare Access redirect and actual active Worker deployment after run; do not infer deployment success from CI alone.
- **No real customer data, payments, DNS, production publication or paid calls.** This document is an internal private QA baseline, not public marketing text.
