# RIOSYSTEMS Autonomous AI Intelligence V2

AI Intelligence V2 is an additive intelligence layer above AI Factory V1. It does **not** rebuild or replace V1. V1 remains the safe provider-abstraction, schema-validation, repair, fallback, cost and observability foundation. V2 adds the operating-system logic that decides what AI work exists, which context and capabilities are needed, which route is sufficient, when to repair or escalate, and when to stop or request a human review.

## Hard development safety

- Production: `false`
- Real customer data: `false`
- Automatic paid AI calls: `false`
- Automatic paid overflow: `false`
- Unapproved tool side effects: `false`
- Cross-project context leakage: `false`
- Secrets in repo: `false`
- Infinite retries / infinite agents: `false`
- Blind model trust: `false`
- Unvalidated structured output: `false`
- Unbounded context / cost: `false`
- Variable development cost ceiling: `0 EUR`

All V2 acceptance tests use deterministic fixtures, mock providers, simulated tools and synthetic data only. No OpenAI or Workers AI call is required by V2 tests.

## Intelligence flow

`BUSINESS INTENT → TASK DISCOVERY / COMPILATION → TASK GRAPH → CONTEXT ASSEMBLY → CAPABILITY ROUTING → PROMPT/TOOL PLAN → INFERENCE → STRUCTURED + SEMANTIC VALIDATION → REPAIR / RETRY → QUALITY GATE → MODEL ESCALATION / PROVIDER FALLBACK → EVALUATION → OBSERVABILITY → DELIVERY`

The model is an interchangeable compute engine. Business logic never hard-codes a provider model name.

## Implemented subsystems

### Intent, task and graph layer

- deterministic natural-language AI task compiler
- AI opportunity discovery with `automatic_activation=false`
- provider-neutral graph with input, retrieval, transform/classify/extract/summarize/generate/reason/rank/compare, validation, repair, tool, review, aggregate, route, fallback and terminate node types
- extensible registry with 16 base task types
- reusable recipe compiler with lead qualification, support classification/summary, document extraction, business summary, website/SEO content, email draft, proposals, review/feedback analysis, product descriptions, meeting summary and decision support

### Model intelligence

- machine-readable model capability matrix
- routing by task type, quality, latency, context size, tools, vision, structured output, data class, availability and cost policy
- logical quality ladder `Luna → Terra → Sol`
- cheapest sufficient route selection
- dynamic escalation only after quality failure
- compatible provider fallback only
- model-performance history and controlled learning-router proposal flow (`propose → evaluate → approve → activate`)

### Context and grounding

- project-isolated context assembly
- required/optional context priorities, token budgets and bounded summarization requests
- missing, stale, conflicting, duplicate, unsupported and oversized context checks
- untrusted-input / prompt-injection defense
- PII allowlist, masking and field dropping
- provider-neutral retrieval contract, synthetic ranking and source contract
- grounding / hallucination-risk gate with source references and unsupported-claim checks
- scoped, traceable and revocable memory contract
- knowledge distillation with provenance

### Prompt and output quality

- structured V2 prompt compiler with system instructions, task instructions, context blocks, examples, schema and validation criteria
- immutable prompt version history with SHA-256 hash and evaluation status
- schema-first JSON / typed object / list validation, including unknown fields and format checks
- semantic business rules, required evidence, forbidden claims and cross-field constraints
- bounded repair preserving the original goal
- task-specific evaluators for classification, extraction, summarization, generation/content and ranking
- transparent heuristic confidence from validation/evaluator/agreement/known-data signals
- optional self-critique without storing or requesting chain-of-thought
- quality-dependent multi-pass plans
- ensemble and rubric-based AI judge contracts that are explicitly not treated as truth

### Evaluation and cost governance

- golden test sets and regression comparison
- A/B evaluation contract without production traffic splitting
- token/cost estimator that preserves `unknown` when pricing is unavailable
- task, mission, project, daily and monthly budget gates
- no invented external actual cost: external provider results without actual cost are blocked
- zero-cost optimizer principle: minimum cost **for required quality**
- bounded batch processing and project-isolated cache keys
- prompt-variant evaluation and non-production promotion policy
- high-quality-to-cheaper-model distillation contract guarded by quality gates

### Tools, agents and resilience

- tool contract with schemas, side-effect class, approval, project/provider/data/cost permission gates
- tool result validation for schema, completeness, staleness and failure state
- bounded agent contract with max steps, cost, duration, allowed tools and side effects
- planner / executor / validator split with interchangeable models
- human-review states `waiting / approved / rejected / edited`
- failure classification and bounded recovery planner
- circuit breaker `CLOSED / OPEN / HALF_OPEN`
- rate-limit backoff/queue/batch-resize/concurrency-reduction policy
- bounded concurrency and timeout policies
- provider inference timeout wrapper in the V2 runtime

### Multimodal, business and delivery contracts

- PDF/DOCX/TXT/CSV/HTML/JSON document-understanding contract
- provider-neutral vision tasks and multimodal text + image + structured-data context
- brand voice, consistency and localization contracts (`DE`, `EN`, `FR`, `IT` baseline)
- structured decision support with evidence, assumptions, risks, alternatives, confidence and missing information
- Web / Automation / Business cross-factory request contracts
- AI → Automation event proposals never execute side effects
- AI → Business update proposals never mutate CRM/business data
- AI → Web content delivery never owns the build
- complete AI delivery manifest and project manifest
- audit summary stores decision summary, inputs/rules/sources/route, never private chain-of-thought

## Reference acceptance scenarios

The deterministic V2 smoke suite proves all nine required scenarios:

A. synthetic lead qualification → structured score → safe automation event proposal, no write
B. malformed JSON → detect → bounded repair → validate → pass
C. Luna quality fail → Terra pass → Sol not called
D. primary provider timeout → compatible fallback → pass
E. paid/expensive route blocked by 0-EUR policy → zero-cost route selected
F. prompt-injection phrase in external content remains untrusted data with no instruction authority
G. synthetic retrieval → source selection → grounded result → unsupported-claim gate
H. synthetic image + text + structured data → provider-neutral structured design analysis
I. Automation Factory synthetic lead request → AI result → proposed event, no CRM mutation

The same workflow also runs the existing AI Factory V1 major smoke and V1 readiness scripts to guard backwards compatibility.
