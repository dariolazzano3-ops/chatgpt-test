# HAMYREN × AURENTARA Customer Journey & Commercial Service Routing V1

## Purpose

This layer turns the canonical HAMYREN Capability Policy into one continuous customer journey without creating another capability router, mission engine, approval system, cost system, execution engine, or memory store.

HAMYREN remains the long-term customer interface. AURENTARA SYSTEMS is recommended only when the canonical Capability Policy classifies implementation as `AURENTARA_REQUIRED`.

## Reused contracts

- `src/capability-router.js`: canonical `AUTONOMOUS` / `SELF_SERVICE` / `AURENTARA_REQUIRED` classification and truthful customer availability.
- `src/customer-ai/capability-policy-v1.js`: canonical customer capability path plus AURENTARA implementation handoff.
- `src/project-blueprint.js`: professional handoff blueprint.
- `src/mission-compiler.js`: existing mission preparation.
- `src/mission-delivery-aggregator.js`: existing structured delivery evidence.
- Existing HAMYREN tenant/business context remains the source of business context. This block does not create a second memory store.

## Journey outcomes

- `HAMYREN_DIRECT`: advice, analysis, planning, architecture and prioritization remain with HAMYREN. No commercial action.
- `HAMYREN_SELF_SERVICE`: only when the canonical policy says Self-Service and `CUSTOMER_ENABLED`.
- `SELF_SERVICE_NOT_AVAILABLE`: policy says Self-Service eligible, but customer execution is not enabled. Scope may be prepared, but execution is not represented as available.
- `AURENTARA_PROFESSIONAL`: canonical policy says `AURENTARA_REQUIRED`. HAMYREN prepares the scope and context rather than sending the customer to a disconnected lead form.

The journey states are presentation/coordination states only. They are not a second persisted orchestration state machine.

## Commercial routing

The layer can represent:

- `NO_COMMERCIAL_ACTION`
- `SELF_SERVICE_ACTION`
- `AURENTARA_ESTIMATE_REQUIRED`
- `AURENTARA_SCOPE_REVIEW_REQUIRED`
- `CUSTOM_QUOTE_REQUIRED`
- `MANAGED_SERVICE_CANDIDATE`

No amount, discount, payment term, quote or binding offer is generated. Billing and payment remain disabled.

## Professional implementation gate

`prepareAurentaraMissionHandoffV1()` requires all relevant explicit approvals before mission preparation:

1. customer scope approval
2. commercial/operator review approval where commercial review is required
3. operator implementation approval

Even after these are present, the existing mission package keeps its own per-engine approvals and activation requirements. The adapter never authorizes factory execution, external writes or Production.

## Post-delivery continuity

`prepareHamyrenPostDeliveryContinuationV1()` consumes the existing `mission.delivery.v1` report, or creates one through the existing delivery aggregator, and prepares a HAMYREN context-update candidate containing:

- what was implemented
- why it was implemented
- success criteria
- unresolved work
- monitoring targets

There is intentionally no new HAMYREN memory writer in this block. The repository currently has no canonical mission-delivery-to-HAMYREN-memory persistence interface. The adapter therefore prepares a payload for the existing HAMYREN business/memory layer and truthfully reports `memory_write_performed: false`.

## Safety

This block:

- performs no Production deployment
- performs no real customer interaction
- performs no paid inference
- creates no credentials
- performs no external writes
- activates no billing or payments
- creates no binding quote
- bypasses no approval or cost gate
