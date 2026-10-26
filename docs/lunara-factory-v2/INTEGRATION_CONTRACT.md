# LUNARA FACTORY V2 | Shopify-free Migration (2026-10-26)

Status: **STAGING DESIGN / TESTED ADAPTER SOURCE AVAILABLE AS CONVERSATION ARTIFACT**. The original Make scenario **LUNARA ENDPRODUKT AKTUELL** stays INACTIVE and unchanged. NO Stripe charges, Make runs, real email, Cloudflare production deployment or DNS modifications executed.

## Verified evidence from uploaded Make blueprint

- 80 modules with routers across the existing production flow.
- Old Shopify entry: IDs 1 (watch orders), 19 (fetch order), 22 (Shopify REST order fetch), with PAID filter and Shopify product ID.
- Historical dedupe: Shopify order tag `lunara_processed`; tagging at 230 and 235.
- Personalization from Shopify `line_items[].properties` via Make feeder 32 and router 38. Exact legacy property keys: `kind_name`, `kind_alter`, `kuscheltier`, `kuscheltier_name`, `hobby`, `beruhigt_kind`, `traumwelt_wunsch`.
- Keep story generation and QA: 291 → 82 → 83 → 84 → 179; repair via 187 → 192. Preserve Slides/Apps Script PDF branches.
- Customer delivery currently references Shopify customer email in IDs 191/311 and fallback mail branches. These MUST be remapped to the verified order email.
- No dedicated, evidenced audio-generation step in this blueprint; **audio SKU stays disabled until separately verified**.

## V2 architecture

```
New custom Lunara frontend → Cloudflare Worker (private/test)
                              ↓ Stripe Checkout (test)
                         signed Stripe paid webhook
                              ↓ D1 order state & dedup
                     server-to-server Make custom webhook
                              ↓
                   copied/modified Lunara Make story factory
                              ↓
                         PDF + QA + delivery
```

**Never** trigger the Make story factory from an unauthenticated browser request or from the Stripe success landing page.

### Worker environment (all defaults OFF)

- `CHECKOUT_ENABLED=false`
- `MAKE_DISPATCH_ENABLED=false`
- `AUDIO_ENABLED=false`
- `ALLOW_LIVE_PAYMENT=false`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PDF`, `STRIPE_PRICE_AUDIO`
- `PUBLIC_SITE_URL` HTTPS exact frontend origin
- `MAKE_WEBHOOK_URL` HTTPS restricted to hook.<zone>.make.com
- `MAKE_WEBHOOK_API_KEY`
- `ADMIN_TOKEN`
- Isolated D1 `DB` binding

### Make v2 event

```json
{
  "schema": "lunara.order.paid.v2",
  "order_id": "UUID",
  "product": "story_pdf",
  "email": "synthetic@example.invalid",
  "customer_first_name": "Muster",
  "child_name": "Testkind",
  "child_age": 5,
  "plush_toy": "Bär",
  "plush_toy_name": "Stern",
  "hobby": "Malen",
  "calming": "leise Musik",
  "dreamworld": "Mond"
}
```

Stripe signed payment must be checked and recorded server-side *before* this payload is emitted.

### Safeguards

1. Clone the old Make scenario and keep the original inactive.
2. Rebuild trigger and personalization mapping in the new Make clone only.
3. Add unique order ID and atomic states pending_payment → paid → dispatching → dispatched or manual_review.
4. Unknown Make HTTP outcomes require operator review; never automatically retry blindly.
5. Do not send actual child names to marketing analytics or logs. Store no credentials in GitHub, chat or committed blueprints.
6. Install privacy controls, deletion/retention process, refund handling, legal/tax checks, and authenticated production-completion callback before public selling.
7. No live Stripe keys or paid deployment without explicit separate approval.

## Verified local acceptance tests

12 / 12 Node tests PASS on the standalone Lunara Worker adapter, including:
- Stripe signature/freshness, rejection of spoofed callbacks;
- Unpaid, duplicate, and wrong-session payment cases;
- One Make dispatch per verified order;
- Make timeout → manual_review;
- Protected status endpoint with no child data;
- Test-only Checkout, origin validation, and audio gate.

Local artifact: `lunara-factory-v2-staging-kit.zip` delivered in the same ChatGPT conversation. Its SHA-256:
`a44246dfdee4825e753a0d039dc9ee4f3244eeeb62ae5a9e25d1297e5f786231`.

## Next real-world execution blockers

1. No active Make connector/API access in this ChatGPT session; can't edit or duplicate the real Make scenario automatically.
2. No verified Lunara Stripe test account, prices, private domain, dedicated D1/Worker secrets.
3. Can't claim E2E generation/PDF delivery or deployed preview before real integration tests.
4. The standalone adapter source is in the conversation ZIP, not yet reviewed/merged into the repo's shared runtime.

No changes to other sites, JARVIS workers, existing Buffer automations or unrelated projects.
