# RIOSYSTEMS D1 Staging Runtime

This block adds the first durable storage adapter for RIOSYSTEMS without applying any database mutation.

## Adapter

`src/d1-runtime-store.js` implements the same `get`, `put`, and `list` boundary used by the runtime store contract. It targets the existing Cloudflare D1 binding shape and keeps writes disabled by default.

Writes require the adapter to be created with `write_enabled: true`. This is a code-level capability only and does not authorize applying migrations or executing external database writes.

Optimistic revision checks reject stale writers.

## Migration

`migrations/0003_riosystems_runtime_store.sql` declares the `riosystems_runtime_store` table and its scope/collection index. The migration is source-controlled only. It is not automatically applied.

Applying this migration to a real D1 database is an external write and remains approval-gated.

## Safety

- D1 writes disabled by default
- no automatic migration application
- no production deployment
- no secret values committed
- no customer data inserted
- stale writer conflicts fail closed
- external migration/application remains operator-approved

The smoke test uses an in-memory fake D1 binding and therefore produces no external side effects or provider costs.
