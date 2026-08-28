# Sentry read-only bridge

RIOSYSTEMS exposes a protected diagnostic route for read-only Sentry inspection without exposing the Sentry token.

## Required Worker secrets

- `API_TOKEN` protects the diagnostics route.
- `SENTRY_AUTH_TOKEN` must be a Sentry token restricted to `project:read`, `event:read` and `org:read`.

Secret values must never be committed. The repository stores references and configuration contracts only.

## Endpoint and boundary

`GET /factory/diagnostics/sentry` requires `Authorization: Bearer <API_TOKEN>`.

The bridge performs only GET requests, accepts only the allowlisted Sentry origins `https://de.sentry.io` and `https://sentry.io`, sanitizes issue output, and returns at most ten unresolved issues from the last 24 hours. Unsupported methods return `405` and unauthenticated requests return `401` without contacting Sentry.

## Integration truth

- The read-only bridge first existed on `main` through PR #195.
- This implementation consolidates the bridge into the canonical `factory-control` core without copying the one-time production deployment workflow from PR #197.
- GitHub diagnostics now validate `factory-control` by default instead of treating `main` as the canonical control branch.
- The existing production Worker is not the canonical provider-ready runtime and must not be used as evidence that `factory-control` is deployed.

## Excluded scope

- no Sentry ingestion SDK
- no event writes
- no paid provider activation
- no production deployment
- no real customer data

Capturing Worker exceptions in Sentry remains a separate approval-gated integration.
