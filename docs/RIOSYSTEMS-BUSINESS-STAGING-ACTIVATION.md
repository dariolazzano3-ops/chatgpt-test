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

The write guard now targets the verified relational foundation directly. It no longer creates a second `riosystems_staging.crm_leads` model.

Production, real customer data, automatic paid overflow, and implicit credential access remain disabled.

## Next business activation block

The next business-provider step is the supervised Make → Supabase lead bridge. It must reuse this CRM foundation and its idempotency/audit model rather than create another CRM schema. A future bridge run still needs its own external-write approval boundary.

## References

- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase database migrations](https://supabase.com/docs/guides/local-development/database-migrations)
- [2026 Data API exposure change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)
