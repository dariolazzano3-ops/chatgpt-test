# Lunara Stripe Test Webhook diagnostics (27 Oct 2026)

The Stripe test Checkout is verified paid in YSRIO Sandbox, but Cloudflare D1 order `00000000-0000-4000-8000-000000000028` remains `pending_payment`. Stripe event `evt_1UV7MvB93JLuapUuivWMhl9I` has `pending_webhooks=1`; exact delivery HTTP response is unavailable through the connected Stripe REST interface.

Cloudflare GraphQL `workersInvocationsAdaptive` shows successful **Worker executions** at `2026-10-27T10:12:38Z` and `10:12:52Z`, near Stripe event creation `10:12:37Z`. This is temporal evidence only: source IP and HTTP response are not provided, and `status=success` is not an HTTP 2xx guarantee.

The test-only Worker `lunara-factory-v2-stripe-test-hook` was upgraded from the GitHub version using strict inherited bindings (`bindings_inherit=strict`) to retain `DB` and `STRIPE_WEBHOOK_SECRET` without copying secret values. The Worker now updates a minimal D1 diagnostic counter per Stripe-Signature-bearing POST to `/stripe` with predefined reason names. No event bodies, card data, IPs, signatures or personal details are stored.

Database (EU staging):

```sql
CREATE TABLE IF NOT EXISTS lunara_webhook_diagnostic (
  reason TEXT PRIMARY KEY NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  last_seen TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

A deliberate invalid-signature POST returned HTTP 400 and added one `invalid_signature` diagnostic row; this is *our own negative test*, not proof of the Stripe delivery's failure category.

Read-only diagnosis query:
```sql
SELECT reason, count, last_seen FROM lunara_webhook_diagnostic ORDER BY reason;
```

On a future Stripe retry, inspect the table and event `pending_webhooks`; if a failure is identified, fix only that cause. Do not claim the transaction webhook is fixed until the Stripe delivery succeeds and D1 order transitions to `paid` from a signed event. Make scenario `8203564` stays inactive, live checkout and dispatch remain disabled.
