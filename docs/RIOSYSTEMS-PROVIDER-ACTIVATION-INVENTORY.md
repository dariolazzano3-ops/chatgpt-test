# RIOSYSTEMS Provider Activation Inventory

Verified: 2026-08-28

This inventory defines the current zero-cost-first path from internal mocks to real staging providers. It contains no credentials and does not activate any external service.

## Current preferred staging path

- Cloudflare Workers Free for staging compute, hosting and selected automation runtime. Official pricing currently documents a Free plan with 100,000 Worker requests per day.
- Cloudflare Workers AI for the first real AI staging path. Official pricing currently documents a free allocation of 10,000 Neurons per day. The system must hard-fail rather than silently cross into paid usage.
- Supabase Free for database/business backend/CRM storage. Official pricing currently lists the Free plan at $0, with two free projects and 500 MB database size per project. Real database writes remain separately approval-gated.
- PostHog Free for analytics/observability. Current official pricing lists a free Product Analytics tier of 1 million events per month. Ingestion is still an external write and remains approval-gated.
- OpenAI API remains an optional premium AI path, not a requirement for the first real zero-cost staging pilot. It is usage-priced and therefore requires explicit cost approval before activation.

## Safety contract

1. Re-verify pricing immediately before real activation because provider pricing and quotas can change.
2. Store credential references only. Never commit secret values.
3. Free-tier candidates must fail closed at quota boundaries. No automatic upgrade or paid overflow.
4. External writes require explicit approval even when the provider itself is free.
5. Provider activation and supervised execution remain explicit gates.
6. Production deployment remains disabled.

## Current account discovery

Connected accounts may be inspected read-only to determine whether required account bindings already exist. Account IDs, API tokens and secret values must not be copied into repository documentation.

## Next activation boundary

The next step after this inventory is to bind account-specific provider metadata and credential references in staging. This is still not permission to perform external writes, paid API calls or production deployment.
