# Lunara V2 | Signed Stripe Webhook Checkout Acceptance

Date: 2026-10-27. Sandbox only, no live payments.

## Current confirmed configuration

- Stripe account `YSRIO Sandbox`, `livemode=false`.
- Stripe product `prod_VW8m8Ooc7b54Az`, price `price_1UV6UqB93JLuapUufjyEWPld` (€12.90, EUR).
- Stripe webhook `we_1UV6YhB93JLuapUur7B9GSpN` is enabled for `checkout.session.completed` and `checkout.session.async_payment_succeeded`.
- On Cloudflare Worker `lunara-factory-v2-stripe-test-hook`, secret binding `STRIPE_WEBHOOK_SECRET` confirmed to exist. Value unreadable; exact matching to Stripe is **not yet verified**.
- Unsigned POST `/stripe` rejects with HTTP 400 `invalid_signature`.
- Created one hosted checkout **test session** `cs_test_a1Ewwg1g7rXgvJjFz6RnplcvkNJ3sSzsvZeWswm13ZZ1i49TXcFgQD6kk9`; `status=open`, `payment_status=unpaid`, `livemode=false`, `amount_total=1290`, `currency=eur`.
- D1 synthetic order `00000000-0000-4000-8000-000000000028` stored with matching `stripe_session_id`; currently `pending_payment`.
- Original Make scenario stays inactive. Public narrow webhook records legitimate Stripe **test** payment only and deliberately does NOT dispatch Make or send email.

## Next integration test

Open the existing Stripe hosted test session (the user has its link in the conversation). Use Stripe documented test card numbers only, no personal/real card details. Confirm the checkout remains in test mode. The user must complete the hosted form; the connector cannot emulate that UI without unsafe assumptions.

After test card payment, independently verify:
- Stripe session: `payment_status=paid`, `livemode=false`.
- Make sure a **real signed Stripe event** reaches the endpoint (secret match); webhook delivery status in Stripe.
- D1 row status changes atomically from `pending_payment` to `paid`.
- Duplicate webhook events do not produce extra dispatches.
- **Make must remain inactive**, no stories or emails sent.

The private storefront and API still have checkout disabled; the temporary hosted Stripe Checkout proves event ingestion, not production readiness. To enable on-site dynamically created Checkout Sessions later, add a restricted `sk_test_...` API key to the owner-only API Worker via the Cloudflare Secrets UI only and use configured test price; never put the secret in GitHub/chat.

Product creation, Webhook registration and D1 row insertion are explicitly confined to sandbox; no public shop launch.
