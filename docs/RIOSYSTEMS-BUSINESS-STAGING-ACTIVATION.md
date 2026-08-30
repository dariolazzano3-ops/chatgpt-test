# RIOSYSTEMS Business Staging Activation

## Current state

The Supabase Free project `riosystems-core` is activated for the approved synthetic staging foundation. The activation was performed under an explicit operator GO with a hard variable-cost ceiling of 0 EUR. No production data or real customer data was used.

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

All CRM tables have Row Level Security enabled and forced. `anon` has no table access. Authenticated access is project-scoped through the `project_id` JWT claim, while server-side privileged execution remains gated by RIOSYSTEMS approvals.

## Supabase verification evidence

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

The immutable repository evidence is `src/business-staging-write-evidence.js`.

## Execution gate for future Supabase writes

A verified foundation does not authorize arbitrary future CRM writes. Every supervised staging write still requires the existing fail-closed boundary:

- exact confirmation `APPLY_SUPABASE_STAGING_CRM_ONCE`
- explicit external-write approval
- supervised-execution approval
- exact customer/project scope match including the project UUID
- staging-only and synthetic-test-data-only posture
- confirmed variable cost ceiling of exactly 0 EUR
- injected Supabase SQL executor

Production, real customer data, automatic paid overflow, and implicit credential access remain disabled.

## Make → Supabase lead bridge

The guarded integration contract in `src/make-supabase-lead-bridge.js` is restricted to:

- customer: `bakery-muller`
- project: `digital-system-v1`
- project UUID: `6b4b7f3a-8c6f-4d72-9be1-f2f8a3120101`
- scope key: `bakery-muller:digital-system-v1`
- synthetic test data only
- maximum variable cost: 0 EUR
- no production

On 2026-08-30 the operator approved one supervised synthetic bridge execution. Make staging scenario `7149691` executed successfully with execution ID `e3198aaaeed64e7b8380c6e067439ecf` and was restored inactive after the run.

The resulting synthetic lead was persisted into the existing Supabase CRM foundation without creating a second schema. Verification confirmed:

- exactly one idempotent lead remains for the project scope
- exactly one bridge lead event exists
- exactly one `make-core` provider execution reference exists and is tied to the Make execution ID
- exactly one bridge audit record exists
- the persisted lead contains project scope `bakery-muller:digital-system-v1`
- the persisted lead is marked synthetic
- variable provider cost remained 0 EUR
- no production data or deployment was touched

The immutable cross-provider evidence is `src/make-supabase-lead-bridge-evidence.js`.

Future Make → Supabase writes still require a fresh approval boundary. This verified run is evidence, not standing authorization.

## Next business activation block

The Make → Supabase staging bridge is now live-verified. The next business-flow work should build on this verified path rather than create another CRM or automation foundation. Production remains locked.

## References

- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase database migrations](https://supabase.com/docs/guides/local-development/database-migrations)
- [2026 Data API exposure change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)
