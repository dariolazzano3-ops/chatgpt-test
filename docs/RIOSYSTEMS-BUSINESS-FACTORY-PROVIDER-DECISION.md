# RIOSYSTEMS Business Factory Provider Decision v1

Verified: 2026-08-29

## Decision

RIOSYSTEMS does not require a separate CRM SaaS for v1. The Business Factory owns the CRM/customer/pipeline data model and stores it on portable Postgres through Supabase. PostHog is the separate analytics layer and never becomes the business source of truth.

- Business control and schemas: `riosystems-native-business`
- Primary CRM/business backend: `supabase-free`
- Primary product/web/business analytics: `posthog-free`
- Standalone CRM SaaS: not required for v1

## Why Supabase

Supabase gives the Business Factory a normal Postgres source of truth, APIs, Auth, Storage and Realtime without hard-coding the CRM to a proprietary SaaS model. The current Free plan includes 500 MB database size per project, 50,000 MAUs, 1 GB storage and 5 GB egress. Pro currently starts at $25/month and is not activated by this decision.

For the first single-operator stage, the free project is enough to validate the CRM/customer/pipeline model. Customer/project isolation remains a mandatory RIOSYSTEMS policy regardless of provider.

## Why PostHog

PostHog is selected for behavior, funnel and web/product analytics. Its current free allowances include 1 million product analytics events per month and 5,000 session recordings per month. It is analytics evidence, not the authoritative CRM database.

## Safety and costs

No schema migration, CRM write, event ingestion or provider plan change is performed by this decision. External writes require customer-project isolation, explicit write approval and supervised execution. Automatic paid overflow remains disabled.

## Evidence

- Supabase pricing: https://supabase.com/pricing
- Supabase billing: https://supabase.com/docs/guides/platform/billing-on-supabase
- PostHog current product/pricing overview: https://posthog.com/
