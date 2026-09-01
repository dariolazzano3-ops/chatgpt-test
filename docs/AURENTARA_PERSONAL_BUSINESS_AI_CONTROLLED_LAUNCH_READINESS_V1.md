# AURENTARA PERSONAL BUSINESS AI — CONTROLLED PUBLIC LAUNCH READINESS V1

Status: Build Block 07 implementation.

## Purpose

Block 07 converts launch readiness from an opinion into a machine-readable gate matrix.

It does not deploy Production. It answers:

1. What is already proven?
2. What can still be built safely before Production?
3. What genuinely requires operator action?

The state machine is:

`CONTINUE_PREPRODUCTION_BUILD → OPERATOR_ACTIVATION_REQUIRED → CONTROLLED_LAUNCH_READY`

The evaluator never skips the middle state merely because Product code exists.

## Launch profiles

### FREE_CONTROLLED_PILOT

A controlled Free launch does not require Stripe/payment activation. It still requires real identity, durable data, real-customer AI processing approval, trusted retrieval, distributed abuse controls, deletion, observability, legal/privacy review and deliberate public activation.

### PAID_FOUNDER_LAUNCH

The paid profile includes every Free Pilot requirement plus:

- a tested payment/subscription adapter contract,
- real payment provider activation,
- the €19.90/month Founder plan lifecycle.

The €24.90/month price remains only the previously defined long-term candidate.

## PASS gates already established by the product stack

The evaluator reads the actual product manifests and confirms the contracts for:

- tenant/business memory foundation,
- bounded Customer Chat context,
- Trusted Research fail-closed policy,
- Customer / Operator Control separation,
- bounded fair-use economics using the canonical RIOSYSTEMS Cost Ledger,
- mandatory Red Team evidence,
- local Customer abuse guard.

Red Team must still be passed on the actual launch candidate. The dedicated launch workflow therefore re-runs the complete 22-case Red Team before evaluating readiness.

## PREPROD_REQUIRED

Block 07 deliberately identifies six technical contracts that can and should be built before any Operator Gate is accepted:

1. **Identity adapter contract**
   - authenticated principal/session → tenant membership → customer context
   - deterministic tests first
   - no provider activation yet

2. **Durable store contract**
   - Foundation/Chat/Economics runtime-store behavior against a Production-capable adapter boundary
   - synthetic durability tests before migrations

3. **Trusted retrieval adapter contract**
   - external retrieval → normalized Block 03 source records
   - no bypass of source-quality/freshness/citation policy
   - deterministic retrieval fixtures first

4. **Distributed rate-limit adapter contract**
   - common decision interface for an edge/runtime enforcement provider
   - no external activation yet

5. **Deletion executor contract**
   - auditable purge plan/execution interface
   - synthetic tenant/business deletion proof first

6. **Observability contract**
   - redacted Customer Product events and alert signals
   - no external telemetry sink activation yet

As long as one of these is missing, the evaluator returns:

`CONTINUE_PREPRODUCTION_BUILD`

That prevents an early stop at a gate that is not genuinely operator-dependent.

## OPERATOR_GATE

After the preproduction contracts exist, a Free Controlled Pilot still requires real activation decisions/actions for:

- Production customer identity/authentication,
- durable Production Customer Data Plane and migrations,
- approval/configuration for real customer AI processing,
- live Trusted Retrieval activation,
- distributed rate-limit activation,
- Production deletion executor activation,
- Production observability/alerts,
- legal/privacy review of the actual data flows,
- deliberate public Customer Surface activation and any domain/DNS/access changes.

Paid Founder launch adds payment provider activation.

These are true Operator Gates because they change Production, credentials/provider data handling, public traffic, payments, external legal posture or irreversible customer-data behavior.

## Why Production readiness is not inferred from code

The product already has a strong functional core, but the following statements are intentionally not treated as equivalent:

- “an SQL migration contract exists” ≠ “Production storage is active”,
- “an AI adapter exists” ≠ “real customer data processing is approved”,
- “Trusted Research policy exists” ≠ “live retrieval is active”,
- “local burst control exists” ≠ “distributed public abuse protection is active”,
- “deletion plan exists” ≠ “Production purge was verified”,
- “plans exist” ≠ “Stripe is activated”.

This distinction is the central trust property of Block 07.

## Workflow

The launch-readiness CI performs:

1. syntax checks,
2. full mandatory Customer Red Team again,
3. launch-state evaluation.

The evaluator is also reusable later as an activation checklist: passing each real operator gate changes a boolean evidence input, not the underlying definition of readiness.

## Safety

- no Production deployment,
- no Production migration,
- no real customer data,
- no live research calls,
- no paid API calls,
- no Stripe/payment calls,
- no public Customer Surface activation,
- no Operator Control exposure.

## Next logical block

**Production Activation Contracts V1**

This next block should implement the six remaining `PREPROD_REQUIRED` contracts with deterministic/synthetic tests. Only when those become PASS should the roadmap stop at the genuine Production/operator activation gates.
