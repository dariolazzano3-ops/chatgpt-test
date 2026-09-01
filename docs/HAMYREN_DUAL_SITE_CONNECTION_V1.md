# HAMYREN Dual-Site Connection V1

Status: private-preview architecture only. No public activation.

## Canonical path

AURENTARA SYSTEMS presentation
→ HAMYREN overview
→ HAMYREN Test Experience bridge
→ `/customer`
→ existing HAMYREN Customer Product Surface
→ existing five-successful-question Guest Trial
→ existing Account / Persistent Context handoff
→ existing Account Core when separately activated.

The return path is:

HAMYREN Customer Product Surface
→ AURENTARA SYSTEMS.

## One-engine rule

The static HAMYREN pages are presentation and navigation only.
They must not own or duplicate:

- AI answers,
- the five-question counter,
- Account/Auth,
- Pricing,
- Entitlements,
- fair-use compute,
- Memory,
- Goals,
- Decisions.

Runtime truth remains in the existing `src/customer-product` and `src/customer-ai` architecture.

## Trial vs entitlement

The HAMYREN Guest Trial is exactly five successfully answered business questions and is enforced in the existing guest-session/chat runtime.

`free-starter-v1` remains a separate entitlement/fair-use plan with its existing compute budget. The trial limit must not be implemented by reducing or reinterpreting that compute budget.

Failed, blocked, non-executed, or internally failed chat turns do not consume a Guest Trial question.

## Pricing and upgrade

Plan names, prices, compute limits, features and upgrade state are sourced only from the existing customer Economics / Entitlement Core.

The static HAMYREN overview is not a pricing source of truth.
The canonical Product Surface reads the plan catalog via the existing `/customer/api/plans` route.
Upgrade uses the existing `/customer/api/upgrade` path, which remains fail-closed while Payment Provider / Billing / Checkout are inactive.

## Account handoff

After the fifth successful Guest Trial answer, the runtime transitions to:

`ACCOUNT_OR_PERSISTENT_CONTEXT_HANDOFF`

The handoff references the existing Account Core. No synthetic Auth engine is introduced. Under the current private-preview gates, real account creation is not activated and no real customer data is required for QA.

## AURENTARA_CUSTOMER_INCLUDED future connection point

Product direction is confirmed: an eligible AURENTARA customer may later receive HAMYREN as an included customer benefit.

No runtime entitlement is created in this block because the following commercial policy is intentionally unresolved:

- included compute units,
- feature/plan equivalence,
- eligible AURENTARA products,
- benefit duration,
- upgrade/downgrade behavior.

When those policies are approved, `AURENTARA_CUSTOMER_INCLUDED` must be represented inside the existing customer Economics / Entitlement architecture. It must not become a parallel plan engine or a second entitlement service.

## Safety state

- Public Deploy: OFF
- DNS: unchanged
- Billing / Stripe / Checkout: OFF
- Real Customer Data: NONE
- Paid Provider Calls: NONE
- Additional Variable Cost: EUR 0
