# LUNARA FACTORY V2 | Stripe Sandbox Integration (27.10.2026)

## VERIFIED ACTIONS

- Stripe OAuth account: **YSRIO Sandbox** (test mode only; no live access used).
- Stripe PDF test product: `prod_VW8m8Ooc7b54Az`. Name: Lunara Original | Personalisierte Gute-Nacht-Geschichte PDF (TEST).
- Stripe one-time test price: `price_1UV6UqB93JLuapUufjyEWPld`, EUR 12.90, not recurring.
- Test webhook endpoint: `we_1UV6YhB93JLuapUur7B9GSpN`, events `checkout.session.completed`, `checkout.session.async_payment_succeeded`.
- Webhook: `https://lunara-factory-v2-stripe-test-hook.gelato-donatello-dario-a5a5376c.workers.dev/stripe`
- Isolated Cloudflare Worker `lunara-factory-v2-stripe-test-hook` deployed, no Cloudflare Access on the _webhook only_, handler solely trusts signed Stripe payloads and checks `livemode === false`.
- Source `src/lunara-factory-v2/stripe-test-ingress.mjs` committed; local 8/8 Node tests passed.
- Health endpoint returned JSON `test-only`, `fulfillment:false`. Wrong URL/method returns 404.
- EU D1 `lunara-factory-v2-staging-eu` retained as a separate store. **0 orders** after test cleanup.
- No live charges, no actual Checkout paid sessions, no production Make execution or customer emails.
- Existing Lunara shop preview & API remain behind Owner Only Cloudflare Access, checkout and Make dispatch disabled.
- Real Stripe webhook signing secret **NOT bound** to the public webhook worker; adding via automated cross-connector path was blocked. Any temporary **synthetic** secret and synthetic D1 row were removed and removal verified. Avoid any attempts to pass real secret through a chat.

## REQUIRED USER ACTIONS TO FINISH TEST-ONLY WIRING

1. In the STRIPE SANDBOX dashboard (not live mode): **Developers > Webhooks / Event destinations**. Open endpoint ID `we_1UV6YhB93JLuapUur7B9GSpN`, reveal **Signing secret**. This should begin `whsec_`.
2. In the CLOUDFLARE dashboard: Workers & Pages → `lunara-factory-v2-stripe-test-hook` → Settings → Variables and Secrets → Add Secret. Name **exactly** `STRIPE_WEBHOOK_SECRET`, paste the Stripe webhook signing secret into the *Cloudflare dashboard only*, save/deploy. Never share secret in chat, Github or Make.
3. For the *separate, owner-only* API Worker `lunara-factory-v2-api-private`, provision a **test-only restricted Stripe API key** with necessary Checkout Session permissions directly via Cloudflare's Secret UI named `STRIPE_SECRET_KEY`; set plain var `STRIPE_PRICE_PDF=price_1UV6UqB93JLuapUufjyEWPld`. This requires explicit test setup and review before `CHECKOUT_ENABLED` can be set true; do **not** turn it on automatically.
4. Critical: the private API currently uses Owner-only Access, and the frontend checkout is disabled. The webhook enters through the narrow public, signed test-only Worker. This route should be treated as the Stripe callback exclusively.
5. After secrets configured, test end-to-end with synthetic child data and card data from Stripe's published test-card catalog. Confirm no live keys, verify payments with a matching stored D1 Checkout Session, no duplicate dispatches.
6. After payment recording, work on Make test production branch: QA and PDF must be separately proven. Only then consider controlled artificial deliveries, testing legal/retention implications.

## SAFETY GATES / PRODUCTION BLOCKERS

- The public webhook Worker *only records verified test payments* in D1; it does not trigger Make, send emails, or mark PDFs delivered.
- It rejects unsigned requests, stale signatures, live-mode events, wrong Checkout Session, nonmatching amount (1290 EUR cents), unknown order IDs, and wrong price types.
- It cannot process any event until the actual signing secret is installed, so Stripe will record failed delivery until then. **Do not start a paid test until the secret is installed.**
- No Stripe API secret exists in either code or GitHub. No child data appears in Stripe metadata.
- A public launch also needs a separate production checkout design, Make completion callback, tax and privacy implementation, legal terms, cancellation/widerruf control, secure artifact delivery, user consent, and monitoring.

## CODE & ARTIFACTS

- Branch: `factory/lunara-factory-v2-stripe-make-v1-20261026`.
- Main adapter: `src/lunara-factory-v2/worker.mjs`.
- Signature ingress: `src/lunara-factory-v2/stripe-test-ingress.mjs`.
- Frontend: `src/lunara-factory-v2/private-preview-worker.js`.
- Technical baseline: `docs/lunara-factory-v2/PRIVATE_STAGING_ACCEPTANCE_2026-10-27.md`.
