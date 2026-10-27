# LUNARA V2 | Test payment verification: webhook delivery pending
Date: 2026-10-27

## Independently verified
- Stripe connected account: `YSRIO Sandbox`, test mode, no live charge.
- Hosted checkout session: `cs_test_a1Ewwg1g7rXgvJjFz6RnplcvkNJ3sSzsvZeWswm13ZZ1i49TXcFgQD6kk9`.
- Session `status=complete`, `payment_status=paid`, `amount_total=1290`, `currency=eur`, `livemode=false`.
- Stripe test event: `evt_1UV7MvB93JLuapUuivWMhl9I`, type `checkout.session.completed`; nested Checkout Session maps to our expected order ID, amount, currency, paid status. `pending_webhooks=1` on first and repeat read.
- Cloudflare D1 `lunara-factory-v2-staging-eu`: matching synthetic order `00000000-0000-4000-8000-000000000028` remains `pending_payment`, `paid_at=null`. No automatic update.
- Stripe webhook endpoint `we_1UV6YhB93JLuapUur7B9GSpN` is enabled and its `STRIPE_WEBHOOK_SECRET` Cloudflare binding exists (without revealing value).
- Cloudflare ingress rejects unsigned HTTP POST with status `400 invalid_signature`; **a correctly signed event has not been proven delivered**.
- Make scenario `8203564` is inactive. No production was launched or customer messages sent.

## Status
**Checkout sandbox payment succeeded. Stripe → Cloudflare automatic payment status synchronization not yet proven and currently non-working for the observed order. DO NOT mark E2E test as passed.**

Potential causes include webhook delivery failure, secret mismatch or filtering at edge; **not established** without endpoint's Event deliveries HTTP response.

## Minimal next diagnostic
Stripe Sandbox → Workbench → Webhooks → endpoint `we_1UV6YhB93JLuapUur7B9GSpN` → Event deliveries → select event `evt_1UV7MvB93JLuapUuivWMhl9I`. Read **HTTP response status + response body**. No sensitive signing secret or test card details are needed.

- If HTTP 400 `invalid_signature`: check sandbox webhook endpoint signing secret matches Cloudflare `STRIPE_WEBHOOK_SECRET`, then safe retry.
- If HTTP 403/1010: Cloudflare edge security challenge/block; diagnose exact rule for this host before any narrowly scoped exception.
- If HTTP 503 `not_configured`: check Cloudflare deployed worker has secret binding on current version.
- If HTTP 409 `unknown_checkout` / `payment_mismatch`: inspect D1 order id/session/price matching; do not blindly edit.
- If HTTP 200: inspect where D1 write/DB binding failed or webhook routed to another environment.
- Re-attempt event delivery **only** after identifying and fixing cause, using Stripe's dashboard retry feature; keep Make dispatch OFF.

No manual DB `paid` override was performed: this preserves the failing event to diagnose webhook idempotency honestly.
