# AURENTARA PERSONAL BUSINESS AI — FOUNDATION, TENANT & MEMORY CONTRACT V1

Status: Build Block 01 implementation. Customer-facing Production is not provisioned or changed by this block. No paid AI/provider call is required.

## Purpose

This block establishes the trustworthy data and domain foundation for AURENTARA Personal Business AI, internally treated as Personal Business Operating Intelligence. The product foundation is the longitudinal business state, not the chat surface.

The implemented loop foundation is:

`CUSTOMER → TENANT → BUSINESS → STRUCTURED STATE → MEMORY → GOALS → DECISIONS → CONTEXT → COST ATTRIBUTION`

The core architectural rule is **SHARE THE ENGINE, NOT THE COCKPIT**. Existing RIOSYSTEMS engines remain reusable underneath. The private AURENTARA Operator Control Plane is not a customer surface and is not imported as customer authority.

## Reused existing core

This block deliberately reuses existing repository primitives instead of duplicating them:

- `src/durable-runtime-store.js` supplies the local/synthetic storage adapter pattern used for zero-cost tests.
- `src/runtime-cost-ledger.js` remains the canonical reserve/settle/release cost engine. Customer AI adds tenant/business attribution around it rather than introducing a second cost engine.
- `src/business-crm-model.js` already establishes project-scoped foreign-key, audit-log and Row Level Security conventions. The Customer AI database contract follows those patterns.
- Existing AI Factory, provider routing, mission/execution and operator systems are not copied into this domain.

## Customer Data Plane vs Operator Control Plane

`src/customer-ai/contracts-v1.js` declares the Customer AI data plane as separate from Operator Control. Customer code does not reuse operator sessions, credentials, privileged UI state or operator-only controls.

Production direction is a separate customer-facing database/Supabase project from the private Operator Control database. The SQL in `migrations/20260901_aurentara_customer_ai_foundation_v1.sql` is a **non-applied schema contract**. It opens a transaction and intentionally ends with `ROLLBACK`; Build Block 01 does not run a Production migration.

Future server code that uses elevated database credentials must still perform explicit tenant/business authorization. Service-role credentials are server-side only and are not an implicit customer bypass.

## Tenant and authorization contract

The V1 identity relationship is:

`USER → MEMBERSHIP → TENANT → BUSINESS`

A user can later hold multiple memberships and a tenant can later contain multiple businesses. V1 does not implement enterprise RBAC. Roles are intentionally lean: owner/member/viewer at the contract level.

Authentication and authorization are separate concerns. Every customer-owned operation in `createCustomerAiFoundation()` requires an explicit `{ tenant_id, user_id }` context, resolves an active membership, and then verifies that the requested business exists inside that tenant. Missing or mismatched scope fails closed.

Important customer records carry explicit `tenant_id` and `business_id`; the application does not rely on implicit tenant inference.

## Database and RLS contract

The non-applied PostgreSQL/Supabase schema defines tenant-aware composite relationships for businesses, memory, candidates, goals, decisions, snapshots, usage attribution and audit/deletion records. Customer-owned child objects reference `(tenant_id, business_id)`, preventing a foreign-tenant business relation at the database level.

Row Level Security is enabled on all customer-plane tables. Membership is resolved through a narrow, fixed-search-path boolean helper. Customer DELETE policies are intentionally absent in V1; hard deletion is a later explicit audited server-side operation.

This is defense in depth: application authorization is required now, and the production storage design also carries the tenant boundary. Application-only filtering is not the intended Production security model.

## Memory model

A memory is a scoped business fact, not a raw chat transcript. Supported categories include business profile, owner preference, products/services, finance, customers, employees, operations, marketing, systems, goal-related and decision-related information plus a flexible OTHER bucket.

Epistemic statuses are:

- `CONFIRMED_FACT`
- `INFERRED_INFORMATION`
- `TEMPORARY_CONTEXT`
- `HISTORICAL_FACT`
- `OUTDATED_INFORMATION`

A confirmed fact requires explicit user confirmation or an explicitly allowed trusted structured-input confirmation mechanism. `INFERRED_INFORMATION` never silently promotes itself to confirmed truth.

Memory provenance carries source type/reference, confidence, validity dates, confirmation time, sensitivity, origin, supersession links and timestamps. This makes the question “Why does the AI believe this?” answerable without treating the model as the source of truth.

## Candidates, correction and supersession

Conversation/event extraction can create `MEMORY CANDIDATE` records with pending/accepted/rejected/needs-confirmation lifecycle. Accepting a candidate without user confirmation yields inferred information, not confirmed truth.

Correction does not erase historical meaning. A confirmed correction creates a new current fact, sets `supersedes` on the new fact, marks the previous fact `HISTORICAL_FACT`, sets `superseded_by` and closes its validity interval. Normal current retrieval excludes the historical version; explicit historical retrieval can still access it.

Visible memory deletion marks the fact deleted and immediately removes it from normal search/context. A separate deletion plan enumerates the scoped records, cache prefix and retrieval-index scope that a future hard-purge executor must remove.

## Truth precedence

V1 uses deterministic precedence, not “latest timestamp always wins”. In broad terms:

1. active user/trusted confirmed current facts
2. other active confirmed facts according to provenance/freshness
3. inferred information
4. temporary context
5. historical/outdated facts only when explicitly requested
6. deleted facts never enter normal context

For identical fact keys, a confirmed current fact outranks AI inference even if the inference is newer. A superseded fact cannot reappear as current truth merely because it exists in history.

## Business State

`getBusinessState()` produces `aurentara.customer-ai.business-state-snapshot.v1` from:

- the structured business profile,
- resolved current memory facts,
- active/proposed goals,
- non-superseded decisions,
- provenance references.

It intentionally excludes superseded historical facts from current state. The snapshot is a deliberate context boundary, not a dump of lifetime conversation history.

## Goals

Goals support PROPOSED, ACTIVE, PAUSED, COMPLETED and CANCELLED. An ACTIVE goal requires user confirmation. Meaningful changes to goal title/description/target/date/status/priority require explicit user confirmation and create an audit event. The AI therefore cannot silently rewrite what the owner wants.

## Decisions

Decision memory records what was decided, a concise rationale summary, optional alternatives, expected outcome, actual outcome later, dates/source and creator. It does **not** require or persist private model chain-of-thought. Decision outcomes can be recorded independently as the business evolves.

## Context retrieval

`getRelevantContext()` returns a structured `aurentara.customer-ai.context-package.v1` containing only the tenant/business, business-state snapshot, bounded relevant facts, active goals and relevant decisions.

V1 relevance is deterministic and testable: token overlap, a small set of business-intent category boosts, current/confirmed preference and hard maximums. This is intentionally simpler than ML/vector retrieval. It prevents the default anti-pattern of loading all historical memory into every AI request.

### Semantic/vector tenant security

Full vector infrastructure is **not activated** in this block. The contract is already strict:

`TENANT RESOLUTION → TENANT + BUSINESS SCOPED SEARCH SPACE → RETRIEVAL`

The forbidden pattern is:

`GLOBAL SEARCH → POST-FILTER TENANT`

The SQL contract documents the future pgvector query shape with tenant and business predicates inside the query before nearest-neighbour ordering. The automated smoke suite asserts the same pre-filter requirement at the domain contract level.

## Cost attribution

`src/customer-ai/cost-attribution-v1.js` adapts the existing RIOSYSTEMS cost ledger:

- Customer AI `tenant_id` maps to the canonical ledger `customer_id`.
- Customer AI `business_id` maps to canonical ledger `project_id`.
- Existing reserve/settle/release budget math stays untouched.
- Customer attribution adds user, conversation/operation, provider, model, usage class, estimated cost and actual cost metadata.
- Any tenant/business mismatch is rejected before touching the ledger.

No paid inference is run by the acceptance suite. Synthetic test settlement uses zero actual cost.

## Auditability

Foundation actions record tenant/business-scoped audit events for memory candidates, facts, corrections, deletion, goals and decisions. The database contract also reserves a scoped `audit_log` table, following the repository’s existing audit convention rather than inventing a parallel generic governance system.

## Privacy, export and deletion readiness

V1 implements a scoped business export and a deletion-plan contract. This makes later data access, correction, export, memory deletion, business deletion, tenant/account deletion and retention orchestration possible without redesigning the core data shape.

A hard-purge Production executor is intentionally not included. That future executor must remove legally deletable data across primary rows, derived snapshots, semantic indexes, storage and cache scopes without leaving customer orphans.

## Synthetic acceptance evidence

`fixtures/aurentara/customer-ai-foundation-v1.json` contains only two synthetic tenants: Nordlicht Café GmbH and AlpenWerk Service GmbH.

`scripts/aurentara-personal-business-ai-foundation-v1-smoke.mjs` proves, among other things:

- own-tenant memory retrieval,
- bidirectional cross-tenant denial,
- cross-tenant goal/decision denial,
- tenant-safe context packages,
- semantic retrieval pre-filter contract,
- tenant-aware cost attribution,
- supersession and historical retrieval,
- inference never silently becomes confirmed truth,
- confirmed truth outranks conflicting AI inference,
- deleted memory disappears from normal context,
- cross-business denial,
- bounded relevance selection,
- current Business State snapshot/provenance,
- explicit goal changes,
- decision outcome memory,
- tenant-scoped audit/export/deletion readiness.

The dedicated PR workflow performs JavaScript syntax checks and runs this zero-cost synthetic suite. The repository’s existing canonical PR CI continues to provide the broader regression gate.

## Current limitations by design

Build Block 01 does not provide:

- a public/customer chat UI,
- Production customer auth rollout,
- an applied Production database migration,
- live pgvector/embedding infrastructure,
- document RAG,
- live web research,
- AI inference/model evaluation,
- paid subscriptions or Stripe,
- proactive notifications,
- customer-to-operator mission sharing,
- a hard-deletion Production executor.

These omissions are intentional. The foundation establishes trustworthy identity, tenant isolation, state, memory, goals, decisions, context and economics boundaries first.

## Future integration points

Block 02 can place Customer Chat Intelligence on top of the Context Package and existing AI Factory/model routing. Block 03 can add trusted current research and safety classification. Later product surface, subscription/economics, red-team and controlled launch blocks can consume these contracts without exposing the Operator Control Plane.

Any future AURENTARA service handoff must package only customer-approved, explicitly scoped context. The Operator Control Plane must never receive unrestricted customer memory by default.
