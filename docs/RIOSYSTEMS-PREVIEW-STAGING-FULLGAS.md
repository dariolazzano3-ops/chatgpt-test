# RIOSYSTEMS Preview Staging Fullgas

This block moves the post-architecture activation track forward without enabling production.

## Preview staging contract

`src/preview-staging.js` defines a revision-pinned `preview-staging` environment for the existing Cloudflare worker path. It keeps custom domains disabled, external writes approval-gated, paid actions approval-gated, automatic paid overflow disabled, and production deployment disabled.

The current contract can prepare a dry-run deployment plan and evaluate preview evidence for operator review. Passing preview evidence never implies production promotion.

## Durable runtime store abstraction

`src/durable-runtime-store.js` adds a storage boundary for projects, portfolio state, approvals, cost ledger, execution runs and audit records. The first adapter is memory-only, which keeps this block free and side-effect free while exercising the persistence contract.

The repository is customer/project scoped and uses optimistic revision checks to reject stale writers. A production database is intentionally not provisioned by this block.

## Safety boundary

- no production deploy
- no custom domain activation
- no paid overflow
- no real secret values committed
- no external writes without explicit approval
- no production database provisioning
- no automatic preview-to-production promotion

The dedicated smoke test verifies zero-cost preview planning, paid/production rejection, promotion evidence, revision conflicts, and cross-customer isolation.
