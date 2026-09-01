# AURENTARA PERSONAL BUSINESS AI — TRUSTED RESEARCH & SAFETY RUNTIME V1

Status: Build Block 03 implementation.

## Purpose

Block 03 adds the trust layer between customer context and AI reasoning for current or high-stakes business questions.

Pipeline:

`MESSAGE → TENANT/BUSINESS AUTH → RISK CLASSIFICATION → RESEARCH REQUIREMENT → SOURCE QUALITY/FRESHNESS → TRUSTED RESEARCH BUNDLE → EXISTING AI FACTORY → CITATION VALIDATION → RESPONSE`

The block does not introduce a crawler, second AI engine or second provider system.

## Risk classification

Deterministic V1 risk categories cover tax, employment law, contracts, regulation, food safety, health/safety, insurance and material financing decisions. High and critical topics require current trusted evidence before provider inference. Currentness language such as latest/today/current also activates trusted retrieval requirements.

## Source policy

Sources are normalized with URL, publisher, timestamps, jurisdiction and bounded evidence text. The runtime assigns trust tiers from domain evidence rather than trusting arbitrary source labels supplied by the caller.

Official/public authority domains receive the strongest tier. Critical food/health/safety questions require at least one current official source. High-risk questions require an official source or sufficiently strong independent evidence.

Freshness uses retrieval time. Stale evidence does not satisfy a current/high-risk request.

## Source prompt-injection boundary

External source content is always untrusted data. Instruction-like text inside a source is flagged but cannot become a system/runtime instruction. The Trusted Research Bundle explicitly states that source instructions never override runtime policy.

## Citations

Research-dependent answers must cite supplied research source markers such as `[R1]`. A wrapped existing AI provider receives the Trusted Research Bundle and citation constraints. After inference, citation IDs are checked against the actual bundle. Missing or foreign research citations fail the turn.

Business-memory evidence continues to use the existing Block 02 structured `evidence_refs` contract. Research citations are a separate evidence plane so external knowledge is not silently promoted into Business Memory.

## Professional escalation

Tax, employment law, legal/contract, regulatory and insurance topics carry `professional_escalation_required=true`. The AI task is instructed to preserve material uncertainty and recommend qualified verification where appropriate. The product surface can also render this flag independently of prose.

## Runtime composition

`createTrustedBusinessAiRuntime()` reuses:

- Foundation V1 tenant/business authorization, memory, goals and decisions,
- Customer Chat Runtime V1 conversation and bounded context behavior,
- existing AI Factory V1 model/provider routing and structured-output validation,
- existing cost attribution.

The wrapper performs risk/source preflight before invoking the Customer Chat Runtime. Research-required requests without sufficient evidence are blocked before provider inference.

## Provider activation

Live retrieval remains intentionally inactive in this block.

The runtime can consume pre-retrieved source records from a future approved retrieval adapter or deterministic fixtures. No new external provider, credential, paid API or Production retrieval is activated.

## Safety invariants

- safety is never skipped because of cost,
- current/high-stakes requests fail closed without trusted evidence,
- external source text is data, never instructions,
- research sources cannot access other tenants,
- research evidence is not automatically written to Business Memory,
- Customer Product remains separate from Operator Control,
- no chain-of-thought persistence,
- no live research claim without evidence,
- real customer provider inference remains blocked by the existing Block 02 gate.

## Acceptance

Synthetic acceptance verifies:

- low-risk reasoning without research,
- high-risk missing-research block before inference,
- stale source rejection,
- critical-topic official-source requirement,
- valid official high-risk evidence,
- source prompt-injection text remains data,
- research citation validation,
- professional escalation metadata,
- current-information research requirement,
- cross-tenant denial,
- real customer data blocked before provider inference,
- 0 EUR variable cost,
- 0 paid API calls,
- 0 live research calls,
- 0 Production changes.

## Deferred

A future approved retrieval adapter may fetch current sources. Activating a live external research provider is an Operator Gate if it requires credentials, costs or a new provider. The trust policy in this block remains provider-neutral.

## Next logical product block

Customer Product Surface V1: a separate customer-facing application/API surface using the trusted runtime, without exposing `/operator` or the private Operator Control Plane.
