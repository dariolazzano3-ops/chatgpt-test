# RIOSYSTEMS Business Staging Activation

## Current state

The Supabase account and project are verified read-only. The repository now contains a fail-closed staging CRM write plan and injected SQL runner, but no migration or external write has been executed by this block.

The first activation target is an isolated `riosystems_staging.crm_leads` table containing one synthetic Bäckerei Müller lead. The plan keeps the schema outside `public`, enables and forces RLS, revokes access from `public`, `anon`, and `authenticated`, uses a scope-bound atomic upsert, and provides a cleanup statement for the synthetic row.

This posture accounts for Supabase's 2026 Data API exposure change: table grants and RLS are separate controls, and new tables must not be assumed to be API-accessible. The staging table therefore remains unexposed until a later capability explicitly requires Data API access.

## Execution gate

Building the plan does not authorize execution. A real run requires all of the following at the same boundary:

- exact confirmation `APPLY_SUPABASE_STAGING_CRM_ONCE`
- explicit external-write approval
- supervised-execution approval
- exact customer/project scope match
- staging-only and synthetic-test-data-only posture
- confirmed variable cost ceiling of exactly 0 EUR
- injected Supabase SQL executor

Production, real customer data, public API grants, automatic paid overflow, and implicit credential access remain disabled.

## Next activation block

After explicit approval, create a real Supabase migration through the current Supabase CLI/MCP workflow, run database security advisors, apply it only to the isolated staging target, verify exactly one synthetic row, record evidence, and optionally remove that row with the scoped cleanup statement. The provider stack may set `staging_write_verified` to true only from that recorded live evidence.

## References

- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase database migrations](https://supabase.com/docs/guides/local-development/database-migrations)
- [2026 Data API exposure change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)
