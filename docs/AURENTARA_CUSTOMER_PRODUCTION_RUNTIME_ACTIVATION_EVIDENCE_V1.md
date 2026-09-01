# AURENTARA Customer Production Runtime Activation Evidence V1

Date: 2026-09-01

## Dedicated Supabase Customer project

- Organization: RIOSYSTEMS
- Customer project name: AURENTARA Customer AI
- Customer project ref: `pqmbtfzjcdnihovvppjr`
- Region: `eu-central-1` (Frankfurt)
- Status at provisioning: `ACTIVE_HEALTHY`
- Project creation cost confirmed by operator: `0 EUR/month`

## Operator separation

Private Operator project remains:

- Project name: `riosystems-core`
- Operator project ref: `pgzayxpqiakuvibhonwh`
- Region: `eu-west-1`

Customer and Operator project refs are different. The Customer project is not a reuse of the Operator project.

## Applied Customer migrations

Applied only to `pqmbtfzjcdnihovvppjr`:

1. `aurentara_customer_ai_foundation_v1`
2. `aurentara_customer_chat_runtime_v1`
3. `aurentara_customer_rls_performance_hardening_v1`

## Verified isolation

A transaction-scoped synthetic test created two tenants and verified:

- Tenant A sees its own tenant/business/memory.
- Tenant A cannot read Tenant B business or memory.
- Tenant A cannot write Tenant B memory through the authenticated role.
- A second member of Tenant A cannot read another member's private conversation.
- `authenticated` has no DELETE privilege on memory or conversation tables.
- Test data was rolled back and not retained.

## Supabase advisors

Security Advisor after migration: no findings.

Performance Advisor findings that affected foreign-key indexing and per-row `auth.uid()` RLS evaluation were repaired in `aurentara_customer_rls_performance_hardening_v1`. Remaining performance notices are only expected unused-index INFO notices on a fresh empty database.

## Identity public configuration

Customer Supabase URL: `https://pqmbtfzjcdnihovvppjr.supabase.co`

No service-role key is committed to the repository or exposed to the browser. Publishable client keys are not persisted in this evidence file.

## Still intentionally not active

- no real customer accounts/data
- no real customer AI inference
- no public Customer Surface
- no Stripe/real payments
- no paid AI/provider calls
- no domain/DNS change
