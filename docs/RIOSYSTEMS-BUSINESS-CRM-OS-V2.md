# RIOSYSTEMS Business / CRM Factory V2

## Purpose

Business / CRM Factory V2 extends the existing V1 CRM backend into a provider-neutral Business Operating System. V1 remains the safe persistence and CRM foundation. V2 owns business semantics, business state, intelligence, quality, governance and delivery above provider adapters.

Flow:

`BUSINESS INTENT -> BUSINESS MODEL -> CRM ARCHITECTURE -> DATA MODEL -> PIPELINES -> INTELLIGENCE -> ACTIVITY GRAPH -> AUTOMATION / AI CONTRACTS -> ANALYTICS -> QUALITY -> GOVERNANCE -> DELIVERY`

Supabase remains the primary backend engine. PostHog remains the analytics engine. AI tasks are delegated through AI Factory. Technical workflow execution is delegated through Automation Factory. Web Factory remains a digital touchpoint and lead-source producer.

No new provider-specific database schema is required by this extension block.

## Architecture

V2 is isolated under `src/business-crm-v2/` and reuses V1 concepts instead of replacing them.

- `core.js`: canonical entities, relationship graph, Customer 360 aggregation, data policy, retention, consent, field access, custom fields, search and document references.
- `compiler.js`: natural-language CRM compiler, business-model discovery, seven reusable recipes, industry intelligence and business-process graphs.
- `identity.js`: canonical normalization, lead deduplication, contact/company resolution and CRM data-quality checks.
- `lifecycle.js`: lead/deal/task state machines, multi-pipeline validation, pipeline health, stale detection, next-best-action, activity/timeline, tasks, SLA, rules, assignment and scoring.
- `events.js`: canonical event contracts, outbox, dead-letter events, webhook ingestion, command/query separation, command validation, optimistic concurrency, audit, archival, idempotency and correlation traces.
- `analytics.js`: measured KPIs, funnels, attribution, business-health signals, deterministic anomaly detection, dynamic segments, operator view, alerts and value/retention signals.
- `migration.js`: CSV/JSON import mapping and dry-runs, export contract, provider-neutral migration plans, schema versioning/drift, safe migration planning, integrity, reconciliation, change impact and blast radius.
- `integrations.js`: Web -> CRM, CRM -> AI, CRM -> Automation and CRM -> PostHog contracts with privacy and ownership boundaries.
- `synthetic.js`: zero-cost synthetic data generator plus simulated repository and PostHog adapters.
- `factory.js`: complete Business OS compilation and Delivery Manifest V2.

## Natural-language compiler and recipes

The compiler turns a business requirement into a structured CRM specification without embedding Supabase table logic. It produces project, business type, goal, entities, relationships, pipelines, lead sources, activities, custom fields, automation needs, AI needs, analytics, permissions, retention requirements and data classification.

Reusable V2 recipes:

- `local_service`
- `consulting`
- `agency`
- `restaurant`
- `real_estate`
- `SaaS`
- `professional_services`

Recipes provide business patterns, not provider-specific schemas. They include entities, pipeline patterns, lead types, KPIs, automation hooks, AI hooks and trust signals.

## Canonical business model

Provider-neutral core entities are project, company, contact, lead, deal, pipeline, pipeline stage, activity, task, note, tag, source, owner, custom field and event. All customer-owned state is project-scoped.

The machine-readable relationship graph covers project ownership plus company/contact/lead/deal/activity/task relationships. Customer 360 is an aggregation contract and does not require one physical mega-table.

## Identity and data quality

Normalization supports names, email, phone, company names, domains, country, language, currency, dates and timezones while preserving the original value when appropriate.

Deduplication and identity resolution use deterministic matching evidence. Weak or medium confidence always routes to manual review. V2 never automatically merges uncertain records.

Data quality returns `PASS`, `WARN` or `BLOCK` for required fields, invalid contact formats, duplicates, orphan relations, invalid enums, stale records and project-boundary violations.

## State and pipeline engine

Explicit state machines exist for leads, deals and tasks. Impossible transitions fail closed. Multiple pipelines per project are supported and project scope is validated.

Pipeline health uses only supplied measurements. It can calculate stage counts, transition counts, observed time in stage, win/loss rates, pipeline value and weighted value. No market benchmark is invented.

Stale detection finds inactivity, missing owners, missing next actions and overdue follow-ups. The result is an attention signal and recommendation, never automatic customer communication.

## Business rules, tasks and SLA

Business rules are project-scoped, versioned and deterministic. Assignment contracts support manual, round-robin, region, source, deal value and specialization patterns without executing external side effects.

SLA contracts define event, deadline, priority and escalation semantics. Notifications remain Automation Factory responsibility.

## Events, commands and reliability

Canonical events use dot notation, including `lead.created`, `lead.qualified`, `deal.stage_changed`, `deal.won`, `activity.created` and `task.completed`.

Business mutation and event delivery can be coupled through an outbox contract. Failed events can become dead-letter records. Synthetic outbox consumption proves correlation and idempotent replay.

Commands and queries are separate. A command must pass project, actor, schema, business-rule, state-transition, idempotency and policy validation before mutation. Optimistic concurrency uses expected versions and surfaces conflicts instead of silently overwriting state.

Audit entries reference old/new state rather than logging sensitive raw state. Archival is soft by default.

## Privacy, retention and access

Field classifications: public, internal, confidential, customer data and sensitive. Classification affects logs, analytics, AI routing and exports.

Retention, consent and field-level access are configurable contracts. V2 does not claim legal compliance and does not invent a legal retention policy.

Notes and documents are treated conservatively. Documents are linked by reference; content duplication is not required. Sensitive note content is not placed in observability metadata.

## Cross-factory ownership

Web Factory may produce form and website events. Business Factory validates, normalizes, deduplicates, resolves identity and produces a persist plan plus business event.

AI Factory receives structured advisory tasks such as lead qualification, company/deal summaries, next-best-action suggestions and activity summaries. AI does not mutate CRM state. AI provenance records task ID, model/provider reference, generated time, confidence/quality state and human verification separately.

Automation Factory consumes business events and performs technical execution. Business-domain rules remain owned by Business Factory.

PostHog mappings are project-level and PII-minimized. Person profiles are disabled in the V2 mapping contract and external analytics writes remain unauthorized by default.

## Analytics and health

The KPI registry is independent of dashboard code. V2 defines lead volume, qualified leads, conversion, deal value, win/loss rates, pipeline velocity, first-contact time, stage duration and source performance.

Funnels are configurable. Attribution supports first touch and last touch, with optional multi-touch only when touch data exists. Business-health and anomaly signals are evidence-based and rule-driven in V2. They are recommendations for investigation, not absolute truths.

Dynamic segments are query contracts rather than mandatory materialized copies.

## Import, migration and schema evolution

Import pipeline:

`parse -> map -> validate -> deduplicate -> dry-run -> activation gate -> controlled import -> verify`

CSV, JSON and structured exports are supported at the contract layer. Unknown field mappings require review. Dry-runs report total, valid, invalid, duplicate, new, update and conflict counts without mutation.

Schema drift compares expected vs actual provider schema for columns, types, constraints and indexes. Safe migration planning uses `expand -> migrate -> validate -> contract` and never authorizes destructive external changes automatically.

Change-impact and blast-radius analysis exposes affected rules, automations, AI hooks, analytics, reports, imports and integrations before configuration changes are activated.

## Zero-cost test system

`business-crm-os-v2-smoke.mjs` contains 15 synthetic scenarios, including all requested reference scenarios A-J and broader coverage for concurrency, privacy, rules, Customer 360, SLA, analytics, segmentation, imports, schema drift, integrity, reconciliation and observability.

The dedicated CI workflow also runs the existing `business-crm-factory-v1-smoke.mjs` so V2 cannot be considered green while V1 regresses.

## Hard safety

- Production: false
- Real customer data: false
- Automatic paid provider usage: false
- Automatic paid overflow: false
- Mass email: false
- Money movement: false
- Destructive delete by default: false
- Cross-project data access: false
- Unapproved external writes: false
- Secrets in repository: false
- Blind AI mutation: false
- Unsafe automatic merge: false
- Unvalidated import: false
- Variable development cost ceiling: 0 EUR

This block performs no Supabase migration, PostHog capture, paid AI request, production deployment or customer-data processing.
