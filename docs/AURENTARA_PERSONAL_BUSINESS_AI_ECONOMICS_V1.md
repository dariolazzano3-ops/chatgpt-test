# AURENTARA PERSONAL BUSINESS AI — SUBSCRIPTIONS / ENTITLEMENTS / ECONOMICS V1

Status: Build Block 05 implementation.

## Purpose

Block 05 adds software-only product plans, feature entitlements and bounded fair-use compute to the Customer Product Surface.

It does **not** activate Stripe, checkout, subscriptions, invoices, real payments or paid provider usage.

## Plan catalog

V1 defines three product contracts:

### FREE · Starter

- €0
- initial starter experience
- 20 fair-use compute units per calendar month
- Business AI chat
- conversation history
- memory view/correction
- goals and decisions views

### Personal Business AI · Founder

- launch reference: **€19.90/month**
- planned launch plan, not currently sold
- 400 fair-use compute units per calendar month
- core customer features
- longitudinal-memory entitlement
- trusted-research eligibility
- priority-context entitlement

### Personal Business AI · Standard Candidate

- long-term candidate: **€24.90/month**
- not a public launch plan yet
- 500 fair-use compute units per calendar month
- same initial premium feature family

No plan is represented as unlimited compute.

## Reuse of the existing Cost Engine

The economics layer does not build another cost/budget engine.

Fair-use metering wraps the canonical `riosystems.cost-ledger.v1`:

`ENTITLEMENT → MONTHLY COMPUTE BUDGET → RESERVE → AI TURN → SETTLE / RELEASE`

The Product layer calls the ledger units `compute units`. They are product fair-use units, not Euro amounts.

This gives the Customer Product the existing ledger's bounded budget, reservation, settlement, release and idempotency behavior without coupling customer-facing pricing directly to provider costs.

## Turn economics

A normal Customer Business AI turn reserves one compute unit before provider inference.

- successful turn → settle the unit,
- Trusted Research / Safety block → release it,
- provider/runtime failure → release it,
- budget exhausted → block before provider inference.

This prevents failed or safety-blocked requests from consuming the customer's fair-use allowance and prevents requests beyond the plan budget from causing provider work.

## Feature entitlements

Features are checked through the current tenant entitlement. The Customer Surface gates:

- Business AI chat,
- history,
- memory view,
- memory correction,
- goals view,
- decisions view.

The Free plan does not include `trusted_research_eligibility`; Founder and Standard Candidate do. Live Trusted Retrieval is still inactive, so this entitlement does not activate a provider by itself.

## Tenant scope

Entitlements and monthly usage are tenant-scoped. The Customer Surface never accepts a tenant ID from an upgrade, usage or chat request. It supplies the tenant context from the server-side Customer Session created in Block 04.

Usage for one tenant cannot reduce another tenant's fair-use budget.

## Payment boundary

Paid plan assignments can only be created by explicit synthetic/manual preview operations inside tests or internal preview code.

A source such as `payment_confirmed` is rejected because no payment provider is active.

`/customer/api/upgrade` returns:

`PAYMENT_PROVIDER_NOT_ACTIVATED`

with:

- `stripe_active: false`
- `checkout_active: false`
- `operator_gate_required: true`

This keeps plan/economics architecture testable without pretending that payment occurred.

## Customer Product integration

Each synthetic Guest Session receives the Free entitlement automatically.

The Customer Product now exposes:

- `/customer/api/plans`
- `/customer/api/entitlement`
- enriched `/customer/api/usage`
- gated `/customer/api/upgrade`

Usage includes AI turns/messages, monthly compute budget, spent/reserved/remaining compute units and variable provider cost attribution.

## Cost separation

Two different concepts remain separate:

1. **Fair-use compute units**: customer product allowance.
2. **Provider / execution cost attribution**: existing internal RIOSYSTEMS cost accounting.

V1 synthetic execution still has a hard variable-cost ceiling of €0.

## Storage

The runtime uses the existing runtime-store adapter boundary and the memory adapter for synthetic tests. Production entitlement/subscription persistence is intentionally deferred until Production identity/storage activation.

## Acceptance

Synthetic acceptance proves:

- plan prices €0 / €19.90 / €24.90,
- no unlimited-compute contract,
- Free default entitlement,
- Free vs Founder feature gating,
- unauthorized paid activation rejected,
- manual preview plan assignment without payment claim,
- canonical Cost Ledger reuse,
- compute reserve/settle/release,
- failed/safety-blocked turn release,
- idempotent settlement,
- Free budget exhaustion at its bounded allowance,
- budget block before provider inference,
- tenant-isolated usage,
- Customer Surface usage integration,
- plans endpoint,
- payment/checkout gate,
- 0 EUR variable cost,
- 0 paid API calls,
- 0 Production changes.

## Deferred

- Stripe/payment provider integration,
- checkout sessions,
- webhooks,
- invoices/tax/VAT collection,
- refunds,
- trials/coupons,
- Production subscription lifecycle,
- durable Production entitlement storage,
- automated paid-plan activation.

Real payment activation is an Operator Gate.

## Next logical block

**QA / Red Team / Abuse Resistance V1**

The next block should attack the complete customer stack with synthetic adversarial cases: tenant leakage, memory poisoning, stale/conflicting facts, provenance attacks, prompt/source injection, high-risk certainty, usage abuse, deletion, session boundaries, customer/operator isolation and cross-tenant contamination.
