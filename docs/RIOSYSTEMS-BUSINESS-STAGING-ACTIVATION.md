# RIOSYSTEMS Business Staging Activation

## Current state

The Supabase Free project `riosystems-core` has now been activated for the approved synthetic staging foundation. The activation was performed under an explicit operator GO with a hard variable-cost ceiling of 0 EUR. No production data or real customer data was used.

The verified foundation is the relational CRM model in `public`:

- `customer_projects`
- `contacts`
- `leads`
- `lead_events`
- `provider_execution_refs`
- `audit_log`

The repository migration history is aligned with the versions registered by Supabase:

- `20260830013445_riosystems_staging_crm_foundation.sql`
- `20260830013612_riosystems_staging_crm_fk_indexes.sql`

All CRM tables have Row Level Security enabled and forced. `anon` has no table access. Authenticated access is project-scoped through the `project_id` JWT claim, while server-side privileged execution remains gated by RIOSYSTEMS approvals. The runtime does not rely on public Data API exposure as an authorization boundary; grants plus RLS are the access-control boundary.

## Verification evidence

The live staging verification established all of the following:

- one synthetic Bäckerei Müller lead can be written and read
- repeating the same logical write leaves exactly one lead because the idempotency key is project-scoped
- one audit record, one lead event, and one provider execution reference are present
- Project A sees its synthetic lead
- a different Project B scope sees zero foreign leads
- anonymous lead SELECT and INSERT privileges are absent
- RLS is enabled and forced
- Supabase security advisor returned zero security lints
- no paid upgrade or additional credits were required
- variable provider cost for the activation was 0 EUR
- production remains unchanged

The immutable repository evidence is `src/business-staging-write-evidence.js`. Provider Stack, Activation Matrix, Mission Plan, and Command Center derive `staging_write_verified` from that evidence rather than from a manually toggled boolean.

## Execution gate for future writes

A verified foundation does not authorize arbitrary future CRM writes. Every supervised staging write still requires the existing fail-closed boundary:

- exact confirmation `APPLY_SUPABASE_STAGING_CRM_ONCE`
- explicit external-write approval
- supervised-execution approval
- exact customer/project scope match including the project UUID
- staging-only and synthetic-test-data-only posture
- confirmed variable cost ceiling of exactly 0 EUR
- injected Supabase SQL executor

The write guard targets the verified relational foundation directly. It does not create a second CRM schema.

Production, real customer data, automatic paid overflow, and implicit credential access remain disabled.

## Make → Supabase lead bridge

The repository now contains a guarded integration contract in `src/make-supabase-lead-bridge.js` for the next business-provider block. It connects the already verified Make staging path conceptually to the already verified Supabase CRM foundation while remaining non-executing by default.

The bridge is deliberately restricted to the exact staging scope:

- customer: `bakery-muller`
- project: `digital-system-v1`
- project UUID: `6b4b7f3a-8c6f-4d72-9be1-f2f8a3120101`
- scope key: `bakery-muller:digital-system-v1`
- synthetic test data only
- maximum variable cost: 0 EUR
- no production

The plan reuses Make staging scenario evidence and the existing Supabase tables, project-scoped idempotency, audit log, lead events, and provider execution references. It explicitly forbids creating another CRM schema.

Planning the bridge does not authorize a provider call. A real one-shot bridge execution requires a fresh execution boundary with all of the following at the same time:

- exact bridge confirmation `RUN_MAKE_SUPABASE_STAGING_LEAD_ONCE`
- exact Make confirmation `RUN_STAGING_ONCE`
- exact Supabase confirmation `APPLY_SUPABASE_STAGING_CRM_ONCE`
- explicit external-write execution approval
- supervised-execution approval
- Make provider execution approval
- exact project-isolation approval for `bakery-muller:digital-system-v1`
- staging-only and synthetic-test-data-only approval
- confirmed variable-cost ceiling of exactly 0 EUR

Until those gates are present, `execute_make` and `execute_supabase` remain false. This lets RIOSYSTEMS advance the integration architecture without silently spending money, touching production, or performing a new external write.

## Next business activation block

After the bridge contract passes repository validation, the next external step is one supervised synthetic Make → Supabase lead transfer under the fresh bridge approval boundary above. The run must verify idempotent persistence, one audit entry, a provider execution reference tied to the Make execution ID, project isolation, zero variable cost, and restoration of the Make scenario to inactive state.

## References

- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase database migrations](https://supabase.com/docs/guides/local-development/database-migrations)
- [2026 Data API exposure change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)
