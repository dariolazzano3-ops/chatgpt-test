# AURENTARA PERSONAL BUSINESS AI — PAYMENT LIFECYCLE ADAPTER CONTRACT V1

Status: Build Block 09 implementation.

## Mission

Close the final safely buildable preproduction requirement for the Paid Founder launch without activating Stripe, checkout, webhooks, billing collection or real money movement.

This block does not create a second Economics engine. The existing Customer Economics V1 remains the source of truth for plan IDs, prices, features and fair-use compute. Payment Lifecycle V1 only converts a verified provider event stream into a tenant-scoped billing state and effective entitlement projection.

## Founder V1 commercial contract

- plan: `personal-business-ai-founder-v1`
- reference price: €19.90 / month
- currency: EUR
- long-term €24.90 plan remains a candidate and is not accepted by this V1 payment adapter
- unlimited compute remains false

## Trust boundary

`raw provider event -> provider verifier -> normalized verified event -> tenant/plan/price validation -> idempotency/order gate -> subscription state -> entitlement projection`

A configured verifier is not enough to execute. It requires:
- real provider activation, or
- explicit `synthetic_fixture=true` in deterministic tests.

Paid access can never be projected from an unverified customer request or arbitrary plan assignment.

## Accepted V1 event types

- `CHECKOUT_STARTED`
- `SUBSCRIPTION_ACTIVE`
- `INVOICE_PAID`
- `PAYMENT_FAILED`
- `SUBSCRIPTION_CANCELED`

## Subscription states

- `PENDING`
- `ACTIVE`
- `PAST_DUE`
- `CANCELED`

Transitions are deliberately conservative:
- no subscription may begin directly as failed/canceled,
- canceled is terminal for the same subscription ID,
- a new subscription ID is allowed only after the tenant's prior subscription is canceled,
- V1 permits only one live subscription per tenant.

## Entitlement projection

The Payment adapter does not silently mutate the active Customer Surface entitlement before the payment provider is activated.

Instead it emits:

`aurentara.customer.billing-entitlement-projection.v1`

Rules:
- `ACTIVE` -> effective Founder plan, `payment_verified=true`
- `PENDING` -> effective Free plan
- `PAST_DUE` -> effective Free plan, restricted for payment failure
- `CANCELED` -> effective Free plan
- no verified subscription -> effective Free plan

This projection becomes the safe hand-off into the existing Economics entitlement layer when the real payment provider is activated at the operator gate.

## Idempotency and ordering

Provider event IDs are persisted per tenant.

- exact replay -> idempotent duplicate
- same event ID with changed normalized content -> hard replay conflict
- lower sequence than current subscription -> recorded but ignored
- equal sequence with a different event -> sequence conflict

Events first enter `RECEIVED`, then become `APPLIED`. If the process fails after the subscription write but before the entitlement projection/event finalization, replaying the same verified event resumes and finalizes the operation. This avoids double entitlement or permanent half-applied billing state.

## Tenant isolation

Tenant identity comes from the verified provider event, not from raw customer input.

An optional expected tenant can be supplied by the internal caller; mismatch fails closed.

Subscription records, event records and current projections are stored under a tenant-specific payment lifecycle scope. Synthetic acceptance verifies separate tenants cannot overwrite one another.

## Price and plan safety

`SUBSCRIPTION_ACTIVE` and `INVOICE_PAID` require:
- Founder plan ID exactly,
- EUR currency,
- exact €19.90 amount.

The €24.90 candidate is intentionally rejected by V1.

## Raw data minimization

The runtime stores only normalized billing fields needed for lifecycle enforcement. The raw provider payload is not persisted by the contract.

## Launch Readiness integration

Controlled Launch Readiness now reads `paymentLifecycleManifest()`.

After this block and a passing mandatory Red Team:
- FREE Controlled Pilot: no `PREPROD_REQUIRED` gates remain.
- PAID Founder Launch: no `PREPROD_REQUIRED` gates remain.
- both profiles therefore advance to `OPERATOR_ACTIVATION_REQUIRED`.

Paid Founder still has the genuine `payment_provider` operator gate.

## Explicit non-goals

This block does not:
- create a Stripe account,
- activate Stripe,
- create checkout sessions,
- register real webhooks,
- charge cards,
- send invoices,
- collect VAT/tax data,
- move money,
- turn on Production billing,
- expose payment callbacks publicly.

## Safety

- synthetic events only,
- 0 € variable cost,
- no customer payment data,
- no payment credentials,
- no Production,
- no new provider activation,
- no Customer/Operator boundary change.

## Roadmap consequence

With Block 09 complete, there should be no remaining software-only preproduction contract required by the current V1 launch blueprint. The next state is the genuine operator activation phase: Production identity/storage/AI/retrieval/rate/deletion/observability/legal/public-surface activation, plus Stripe/payment activation for a Paid Founder launch.
