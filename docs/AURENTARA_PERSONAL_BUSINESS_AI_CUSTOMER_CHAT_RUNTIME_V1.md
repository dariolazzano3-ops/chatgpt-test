# AURENTARA PERSONAL BUSINESS AI — CUSTOMER CHAT INTELLIGENCE & CONTEXT RUNTIME V1

Status: Build Block 02 implementation. This block adds the customer conversation/runtime layer on top of Foundation V1. It does not provision Production customer auth, activate paid AI, enable real-customer provider inference, perform trusted web research or expose the private Operator Control Plane.

## Mission

The runtime turns a customer message into a bounded, tenant-safe reasoning request:

`CUSTOMER MESSAGE → AUTHORIZED TENANT/BUSINESS → INTENT → CONTEXT REQUIREMENT → BOUNDED CONTEXT ENVELOPE → EXISTING AI FACTORY → VALIDATED RESPONSE → MEMORY/GOAL/DECISION PROPOSALS → EXPLICIT CONFIRMATION`

The chat surface remains a client of the business intelligence foundation. Conversation history is not the source of truth for the business.

## Reused core

Block 02 deliberately reuses:

- Foundation V1 for tenant/business authorization, Business State, memory, goals, decisions and context retrieval.
- `src/ai-factory-v1.js` for model abstraction, prompt compilation, structured-output validation, repair/retry, quality gates and zero-cost execution safety.
- `src/ai-provider-adapters-v1.js` for the deterministic local test provider. No new provider router or AI engine is introduced.
- Foundation V1 cost attribution, which itself reuses the canonical runtime cost ledger.
- `src/durable-runtime-store.js` as the local/synthetic storage adapter pattern.

## Conversation boundary

A conversation carries explicit `tenant_id`, `business_id`, `owner_user_id`, data sensitivity and its own cost state. Messages are stored under a scope containing tenant, business and conversation identifiers. Cross-tenant and cross-business operations first pass through Foundation V1 authorization.

The deployment-direction SQL contract additionally makes V1 conversations personal to the authenticated user. Team/shared conversations are intentionally deferred rather than implicitly exposing one member's chat history to another member.

## Bounded context instead of lifetime replay

`planTurn()` classifies the message and chooses a deterministic context requirement. It requests only a bounded number of relevant facts, goals and decisions from Foundation V1 and adds only a recent conversation window.

The Chat Context Envelope intentionally does **not** forward the complete `business_state.current_facts` collection. It includes a small Business State digest plus the selected relevant facts. This closes an important cost/scale gap between Foundation V1 snapshots and actual prompt construction.

A character budget is enforced. The runtime trims oldest recent messages, then lower-priority decisions/goals/facts. If the context still cannot fit, the turn fails closed instead of silently sending an unbounded prompt.

## Intent and context planning

V1 uses deterministic intent categories:

- BUSINESS_ADVICE
- FACT_QUERY
- GOAL_SUPPORT
- DECISION_SUPPORT
- PLANNING
- MEMORY_UPDATE
- ACTION_REQUEST

This classifier is deliberately transparent and replaceable later. It exists to select context shape, not to become a second AI system.

## Prompt-injection boundary

Customer messages, recent messages, memory, goals and decisions are all treated as **data**. They cannot become system/runtime instructions merely because their text contains instruction-like language.

The compiled AI task explicitly forbids access to other tenants, other businesses, Operator Control, secrets, credentials, hidden prompts and chain-of-thought. It also forbids claiming that external research, tools or AURENTARA execution ran without supplied evidence.

This complements the existing AI Prompt Registry rule that supplied context is data unless explicitly marked as an instruction by the factory contract.

## Evidence contract

Every AI response has an `evidence_refs` array. The Chat Context Envelope creates an allowlist from the actually retrieved business profile, memory facts, goals and decisions.

After AI Factory validation, the chat runtime performs an additional evidence post-flight. Any evidence reference outside that allowlist causes `CHAT_EVIDENCE_REFERENCE_INVALID` and the assistant response is not accepted as a successful turn.

This is not a guarantee that a model's prose can never be wrong. It is a deterministic guard preventing the structured response from citing foreign or nonexistent business records as evidence.

## Memory behavior

The AI cannot write long-term truth directly.

A response may return `memory_candidates`. The runtime converts them only into Foundation V1 `MEMORY CANDIDATE` records with `needs_confirmation`. They do not enter current memory context as confirmed facts.

`confirmTurnProposal(..., { type: 'memory', user_confirmed: true })` is the explicit promotion path. Foundation V1 then performs its existing confirmation logic and audit event.

## Goals and decisions

AI-generated goal and decision content is proposal-only. A successful normal chat turn reports zero goal changes and zero decisions recorded.

Explicit confirmation can apply a selected goal or decision proposal through Foundation V1. This preserves the rule that the AI cannot silently rewrite what the owner wants or silently record a business decision as final.

## AI Factory boundary

The runtime compiles a normal `riosystems.ai-task.v1` and calls `runAIFactoryTask()`. It does not create a second prompt engine, provider router, retry engine or quality system.

The response schema includes:

- answer
- recommendations
- follow-up questions
- memory candidates
- goal proposals
- decision proposals
- evidence references
- external-research requirement
- confidence

No hidden chain-of-thought field exists.

## Real customer data gate

The default conversation data class is `customer`, which is intentionally fail-closed in this build. Block 02 can fully exercise the runtime using synthetic/internal data and the deterministic local provider, but it does not send real customer context to any inference provider.

For `customer` or `sensitive` conversations, `submitTurn()` returns `CUSTOMER_DATA_AI_EXECUTION_NOT_ACTIVATED` **before provider inference**.

This is a deployment/provider privacy gate, not a missing architectural foundation. Later activation must deliberately align customer-data handling, provider terms/configuration, privacy policy, cost policy and Production authorization.

## Current external research

The runtime deterministically detects common currentness signals such as "latest", "today", "aktuell", regulation or current market-price questions. It marks the turn as requiring trusted external research.

Block 02 does not perform that research. The accepted response metadata records `executed: false` and `TRUSTED_RESEARCH_BLOCK_NOT_ACTIVE`. This prevents generic model knowledge from masquerading as current research.

Trusted Research & Safety is the next major layer.

## AURENTARA execution boundary

An ACTION_REQUEST can be understood and answered, but this runtime does not execute a mission, modify a customer system or hand unrestricted customer memory to Operator Control.

The runtime returns `action_executed: false` and `operator_plane_shared: false`. A later AURENTARA service handoff must be an explicit scoped customer-approved package.

## Cost attribution

Each conversation owns a tenant/business-scoped Customer Cost Attribution state. Every executable synthetic/internal turn creates a conversation/turn reservation and settles it through the existing cost ledger adapter.

Block 02 has a hard zero-variable-cost boundary. The acceptance suite uses only the deterministic local provider and verifies actual cost is `0`.

## Storage / Production direction

`migrations/20260901_aurentara_customer_chat_runtime_v1.sql` is a non-applied deployment-direction contract for:

- conversations
- conversation messages
- conversation turns
- tenant/business composite relationships
- owner-aware RLS

It intentionally ends in `ROLLBACK`. No Production migration occurs in this build.

## Acceptance evidence

The synthetic acceptance suite proves:

- two tenant-scoped conversations,
- cross-tenant conversation denial,
- bounded Context Envelope,
- no full Business State fact dump in prompts,
- prompt-injection text remains data,
- no foreign-tenant marker enters Tenant A context,
- deterministic zero-cost AI Factory execution,
- tenant/business/conversation cost attribution,
- memory candidate creation without silent fact promotion,
- explicit memory confirmation,
- explicit goal confirmation,
- explicit decision confirmation,
- trusted-research requirement without research execution,
- action request without mission execution,
- real-customer-data provider execution blocked before inference,
- invalid evidence references rejected,
- recent conversation window bounded.

## Limitations by design

Not included in Block 02:

- public/customer UI,
- Production auth/session rollout,
- real customer provider inference,
- paid AI execution,
- live trusted web research,
- document RAG,
- autonomous actions,
- Operator Control handoff,
- notifications,
- billing/subscriptions,
- shared/team conversations,
- applied Production database migration.

## Next recommended block

**AURENTARA PERSONAL BUSINESS AI — TRUSTED RESEARCH & SAFETY RUNTIME V1**

That block can add controlled current external knowledge, source/evidence policy, freshness, risk classification and safe answer boundaries while continuing to consume the tenant-safe Context Envelope and existing AI Factory.
