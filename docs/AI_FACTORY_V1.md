# RIOSYSTEMS AI Factory V1

AI Factory V1 is a provider-abstracted, schema-first AI production pipeline.

Flow:

`AI task contract -> logical model route -> provider route -> prompt contract -> inference -> validation -> repair/retry -> quality gate -> cost gate -> redacted delivery`

## Hard safety

- Production: `false`
- Real customer data: `false`
- Automatic paid overflow: `false`
- Variable cost ceiling: `0 EUR`
- Secrets in repository: `false`

OpenAI is implemented as a gated adapter but cannot be selected while the global variable-cost ceiling is zero. It additionally requires a credential and explicit paid-execution approval. No credential value is stored in the repository.

Cloudflare Workers AI is implemented as a staging adapter. It is routeable only for `synthetic` data when the runtime explicitly marks zero-cost usage as verified. The adapter hard-fails when that verification is absent and does not permit paid overflow.

The deterministic provider is the default V1 test route. It has no external calls and makes the complete pipeline testable at zero provider cost.

## Contracts

The required task fields are `project`, `task_type`, `input`, `expected_output_schema`, `quality_level`, `latency_class`, `cost_limit`, `data_sensitivity`, `preferred_provider`, and `fallback_allowed`.

Supported task types: classification, extraction, summarization, generation, analysis, decision support, rewriting, and structured planning.

Prompt contracts contain a versioned system intent, task, context, constraints, output schema, quality rules, change history, and test fixtures. Repair requests are structured objects rather than ad-hoc string concatenation.

## Routing

The provider-neutral logical model ladder is `Luna -> Terra -> Sol`. Complexity can raise the minimum logical tier, while the provider adapter resolves that logical tier to its own configured model identifier. Provider selection also checks capability, latency, privacy class, credential state, cost policy, and explicit fallback permission.

## Validation and quality

JSON/schema-first delivery is mandatory. The built-in validator covers required fields, types, enum/const, additional properties, array/string limits, numeric limits, and bounded schema depth. Semantic checks include required non-empty fields and forbidden terms. A task-specific quality gate is applied after structural validation.

Invalid output enters a bounded repair loop. Exhausted attempts fail closed. Provider fallback is separate from repair and is used only when `fallback_allowed=true` and the next provider satisfies privacy, capability, and cost policy.

## Cost and observability

Each run records estimated tokens, estimated cost when the adapter can price the request, actual provider cost when reported, consumed budget, and remaining budget. Any paid route is blocked by the V1 zero-euro ceiling.

Observability records only metadata such as `ai_run_id`, provider, logical model, prompt version, attempts, validation/quality outcome, latency, cost, and fallback events. Inputs, prompt content, secrets, and sensitive data are not placed in the trace.

## Evaluation and reference tasks

The evaluation harness measures correctness, schema compliance, consistency, cost, latency, and repair rate. V1 ships with two synthetic reference classes:

1. Business lead classification.
2. Web Factory site-architecture planning.

The smoke suite additionally verifies repair, fallback, privacy blocking, OpenAI cost gating, Cloudflare zero-cost gating, redacted traces, and zero-cost deterministic end-to-end execution.

## Factory support

Web Factory capabilities: site architecture, copy, SEO metadata, FAQ, service descriptions, and content refinement.

Business Factory capabilities: lead classification, CRM enrichment, summaries, and next-action suggestions.

Automation Factory capability: `automation.ai_step`, a standardized AI step that returns machine-consumable output but never executes the downstream side effect itself.
