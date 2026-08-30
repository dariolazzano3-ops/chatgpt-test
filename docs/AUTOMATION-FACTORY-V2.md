# RIOSYSTEMS Automation Factory V2

Automation Factory V2 extends V1. It does not replace the V1 safe execution engine or its Make staging bridge. V2 owns the intelligence layer above execution providers: intent compilation, discovery, canonical graphs, event/schema contracts, provider-neutral mappings, migration, policy, recovery, observability, optimization and delivery.

## Runtime model

Business intent → structured automation spec → canonical graph → event/data contracts → provider capability routing → dry run / synthetic test → policy gate → simulated execution → trace / recovery → delivery manifest.

External provider execution is intentionally disabled in this extension acceptance path. Development is fixture/mock/synthetic only with a variable development cost ceiling of 0 EUR.

## Provider hierarchy

- Make: primary standard business automation runtime.
- Activepieces: secondary / self-host capable runtime.
- n8n: specialist runtime on a customer-owned instance.
- Cloudflare Workers: small-code and webhook runtime.
- RIOSYSTEMS native: deterministic graph operations only.

The machine-readable capability matrix models capabilities, auth reference types, webhook/schedule/branch/retry support, code execution, database/API connectivity, runtime cost class, hosting model and lock-in. Routing never claims measured reliability where no measured data exists.

## Canonical contracts

The canonical graph supports trigger, action, condition, router, transform, delay, approval, ai_task, webhook, database, notification, validation, retry, recovery, subflow and termination nodes. Edge types are success, failure, condition_true, condition_false, retry and fallback.

Events carry event_id, event_type, project_id, source, timestamp, payload schema/version, correlation_id, idempotency_key and sensitivity class. Credentials never live in graph payloads. Only credential_ref values are routable.

## Safety and governance

Production, real customer data, real money movement, mass email, automatic production deployment, automatic paid overflow, unapproved external writes, cross-project access, secrets in repo, infinite retry and unknown automatic repair are locked out. Policies are evaluated for execution, retry, fallback, replay and deployment.

The system does not claim global exactly-once delivery. It uses idempotency, deduplication, transaction boundaries and reconciliation to pursue effectively-once processing where possible.

## Recovery

Failure classes include transient provider errors, rate limits, authentication failures, schema changes, mapping failures, missing/invalid data, timeouts, dependency/logic failures and external service outages. Safe repair is bounded. Credential changes, permission escalation, money movement, production routing, destructive unknown schema changes and mass communication are never auto-repaired.

DLQ entries keep payload references rather than duplicating sensitive payloads. Recovery inbox states include failed, waiting_for_retry, needs_approval, repair_available, blocked and recovered. Replay is simulate-only in V2 acceptance and requires an idempotency check.

## Portability

Provider workflows can be reverse engineered from normalized Make, Activepieces, n8n or Workers fixtures into a canonical graph without extracting secrets. Migration performs source extraction, target capability comparison, synthetic translation planning and a migration report. Unsupported capabilities are reported explicitly.

## Reference acceptance

The V2 smoke suite covers natural-language compilation, discovery, canonical graph/event contracts, data mapping, schema drift, dependency/blast-radius analysis, reverse engineering, provider migration/routing, dry-run, synthetic execution, shadow mode, immutable versioning, rollback, retry/self-healing/fallback, DLQ/replay/idempotency, approval/policy/credential isolation, optimizer/linter, reliability/SLA/tracing, cross-factory contracts, recipes, webhook security, circuit breaking, rate/concurrency/timeout controls, saga contracts, cost governance and delivery manifests.

Five different recipe flows are executed end-to-end with synthetic data. Dedicated reference assertions also cover lead flow, failure/recovery, provider migration, schema drift and blast radius.
