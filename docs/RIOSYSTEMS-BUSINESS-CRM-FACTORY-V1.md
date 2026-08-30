# RIOSYSTEMS Business / CRM Factory V1

## Status

Business / CRM Factory V1 is implemented as a provider-abstractions-first CRM backend layer. Supabase remains the primary persistence provider and PostHog the product analytics provider. V1 does not add a CRM SaaS.

The existing verified Supabase staging foundation is preserved. `customer_projects` remains the physical project registry for backwards compatibility, while the V1 logical model exposes `projects` as the CRM project entity. The V1 migration extends, rather than replaces, the existing project-scoped contacts/leads/audit foundation.

## Business project contract

Every build starts with `riosystems.business-project-contract.v1`:

- `project_id`
- `business`
- `industry`
- `country`
- `language`
- `crm_requirements`
- `lead_sources`
- `sales_pipeline`
- `custom_fields`
- `analytics_requirements`

The contract hard-locks staging-only, synthetic-only, production false, zero variable cost, no payments, no mass email, no paid overflow and no destructive database operations.

## CRM model

Logical core entities:

- projects
- companies
- contacts
- leads
- deals
- pipelines
- pipeline stages and transitions
- activities
- notes
- tasks
- events

Supporting entities provide custom fields, idempotency registry, audit, observability and role-ready project access grants.

All customer-owned records carry `project_id`. Relational customer references use project-scoped composite foreign keys where applicable. RLS is enabled and forced for every new table, anonymous access is revoked, and authenticated policies require the matching `project_id` JWT claim. Missing or malformed project scope therefore fails closed.

## Pipeline engine

Pipelines are project-defined and industry-neutral. Stages can specify explicit `allowed_next` transitions or use sequential progression. Terminal stages cannot transition further. The migration contains normalized pipeline/stage/transition tables; the JS engine validates definitions and transition targets before execution.

## Timeline and business events

Activities model email, call, note, form, automation, AI action, status change, meeting and other timeline entries. Notes and tasks remain first-class resources.

Canonical business events include:

- `lead_created`
- `lead_qualified`
- `deal_created`
- `deal_stage_changed`
- `form_submitted`
- `contact_created`
- `automation_completed`
- `activity_created`
- `task_created`
- `ai_action_completed`
- `status_changed`

## PostHog mapping

Business events map to `business_<event_type>` events. The mapper sends only project/run/resource/source/status/stage-level operational properties and strips direct contact fields such as email, phone, names, free-text messages, notes and addresses. Person profiles are disabled in the mapping contract. The mapper does not itself authorize external PostHog writes.

## Provider adapter

`createSupabaseCrmAdapter()` exposes scoped Read, Create, Update and Query operations. Every operation requires an allowlisted CRM table and `project_id`. Production, real customer data or a non-zero variable-cost ceiling fail the runtime gate. Controlled Delete exists as a future interface but is disabled by default and requires an explicit one-time destructive staging confirmation before a transport can be called.

The in-memory adapter mirrors the same scope and idempotency behavior for zero-cost E2E tests.

## Factory contracts

Business Factory emits standard contracts for:

- Automation Factory / Make: scoped operation envelope with run ID, resource, idempotency key and hard staging guardrails.
- AI Factory: lead summary/classification/next-action/enrichment input without direct contact fields by default.
- Web Factory: synthetic form event to canonical lead-ingest contract with project scope and idempotency key.

## QA and delivery

The CRM QA engine checks:

1. schema integrity
2. project isolation
3. duplicate protection
4. pipeline validity
5. event consistency
6. analytics data minimization
7. staging safety
8. Automation/AI/Web contract generation

A successful run produces `riosystems.crm-delivery-manifest.v1` containing project, schema, tables, pipeline, custom fields, events, analytics mapping, automation hooks, AI/Web contracts, QA evidence and deployment state.

## Synthetic reference projects

The smoke suite runs the complete flow for two deliberately different business types:

- Bäckerei Müller: local bakery lead/catering style sales flow.
- Northstar Consulting Synthetic: B2B consulting with a longer account/deal pipeline.

Both tests execute Mission/contract → schema → project → company/contact → synthetic web lead → duplicate replay → pipeline/deal → activity/note/task → business events → PostHog mappings → factory contracts → QA → delivery manifest.

No external side effect occurs during the tests and estimated variable provider cost is 0 EUR.

## External activation gate

The migration `20260830042000_riosystems_business_crm_factory_v1.sql` is deployment-ready but is not standing authorization to mutate the live Supabase staging project. Applying it requires a fresh explicit external-write approval under the existing RIOSYSTEMS staging governance.

Likewise, PostHog connectivity may be read-verified without sending an event. A synthetic PostHog event must only be emitted after a fresh approval explicitly covering that analytics write.

Production, real customer data, payments, mass email, automatic paid overflow and destructive database operations remain disabled.
