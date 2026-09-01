# AURENTARA PERSONAL BUSINESS AI — CUSTOMER PRODUCT SURFACE V1

Status: Build Block 04 implementation.

## Purpose

Block 04 turns the customer intelligence foundation into a separate customer-facing product surface without exposing the private Operator Control Plane.

Customer path:

`/customer → GUEST SESSION → CUSTOMER BUSINESS → PERSONAL BUSINESS AI → HISTORY / MEMORY / GOALS / DECISIONS / USAGE`

Private operator path remains:

`/operator → PRIVATE OPERATOR CONTROL PLANE`

These are separate namespaces and separate runtime boundaries.

## Activation model

The Customer Surface is **dormant by default**. The integrated Worker route only activates when:

`AURENTARA_CUSTOMER_SURFACE_MODE=synthetic-staging`

or when the handler is explicitly instantiated in synthetic tests.

Without that flag `/customer` returns `CUSTOMER_SURFACE_NOT_ACTIVATED`. No Production customer surface is activated by this build.

## Guest sessions

V1 includes an ephemeral synthetic Guest Session contract for testing the customer journey without Production authentication or real customer data.

Each guest receives generated server-side identifiers for:

- session,
- tenant,
- user,
- business,
- conversation.

The browser never chooses tenant/business/conversation scope. Query/body attempts to supply another scope are ignored because all customer operations derive their context from the server-side session.

Guest state is in-memory and intentionally non-durable. This is a preview/test mechanism, not Production identity infrastructure.

## Customer capabilities

The V1 surface exposes:

- Business AI chat,
- recent conversation history,
- `What does my Business AI know?` memory view,
- explicit user-confirmed memory correction,
- goals read view,
- decisions read view,
- usage/plan view,
- account placeholder/gate.

The HTML shell is intentionally simple and calm. It is a functional product surface, not the final brand/design system.

## Customer / Operator isolation

`src/entry.js` resolves `/operator` first using the existing private Operator runtime. Customer requests are then routed only when the URL is `/customer` or `/customer/api/*`.

`src/customer-product/surface-v1.js` does not import Operator runtime/dashboard modules and does not provide Operator routes or Operator credentials.

Customer API responses explicitly report `operator_access: false` where relevant.

## Trusted Research boundary

The customer browser cannot supply `research_sources` or a `trusted_research` payload. Accepting arbitrary browser evidence would allow a customer to forge an official-looking URL/evidence record and bypass Block 03.

Current/high-stakes questions therefore remain fail-closed unless a future approved server-side Trusted Retrieval adapter supplies verified evidence.

## Memory correction

Memory corrections require an explicit `user_confirmed: true` operation. The existing Foundation V1 correction contract then creates a new confirmed fact and marks the previous fact historical.

The UI also asks for explicit confirmation before submitting the correction.

## Account/auth boundary

Production account authentication is not implemented or activated in this block.

`/customer/api/account` returns `CUSTOMER_ACCOUNT_AUTH_NOT_ACTIVATED`.

A later launch/auth block must introduce durable identity/session handling with explicit tenant membership and Production security review. Guest sessions are not silently upgraded into Production accounts.

## Economics preview

The Usage view exposes only a zero-cost starter plan placeholder and tenant/conversation usage summary. It does not activate billing, Stripe or paid compute.

Block 05 owns entitlements, plan architecture, compute budgets and economics.

## HTTP security

Customer responses use no-store headers and restrictive browser security headers. Mutation requests with an `Origin` header must be same-origin. JSON payloads are bounded. Guest cookies are HttpOnly, Secure and SameSite=Lax.

These controls are not a substitute for the later full abuse/red-team block.

## Acceptance

The synthetic suite verifies:

- customer route disabled by default,
- no Customer → `/operator` route overlap,
- no Operator module imports in the Customer Surface,
- functional Customer shell,
- two independent guest tenants/businesses,
- server-side scope binding despite forged tenant/business query parameters,
- explicit memory correction confirmation,
- chat and conversation history,
- high-risk trusted-research block before inference,
- rejection of customer-supplied research evidence,
- goals and decisions views,
- zero-cost usage view,
- Production account auth disabled,
- forged session rejection,
- cross-tenant memory isolation,
- 0 EUR variable cost,
- 0 paid API calls,
- 0 Production changes.

## Deferred by design

- Production authentication,
- durable customer sessions,
- email verification/password/passkeys/social login,
- account recovery,
- live trusted retrieval,
- real customer provider inference,
- billing/payment activation,
- Production public domain,
- multi-user/team customer workspaces,
- autonomous AURENTARA implementation handoff.

## Next logical block

**Subscriptions / Entitlements / Economics V1**

That block should create software-only plan/entitlement and fair-use compute architecture, with FREE starter and PAID Personal Business AI contracts. Real Stripe/payment activation remains an Operator Gate.
