# Sentry read-only bridge

RIOSYSTEMS exposes a protected diagnostic route for read-only Sentry inspection without exposing the Sentry token.

## Required Worker secrets

- `API_TOKEN`: protects the diagnostics route.
- `SENTRY_AUTH_TOKEN`: Sentry Personal Token with read-only scopes only:
  - `project:read`
  - `event:read`
  - `org:read`

Never commit either token to the repository.

## Optional Worker variables

Defaults are aligned with the current RIOSYSTEMS setup:

- `SENTRY_ORG=riosystems`
- `SENTRY_PROJECT=riosystems-core`
- `SENTRY_BASE_URL=https://de.sentry.io`

## Endpoint

`GET /factory/diagnostics/sentry`

Authentication:

```text
Authorization: Bearer <API_TOKEN>
```

The endpoint performs only GET requests to Sentry. It verifies project access and returns a sanitized summary of up to 10 unresolved issues from the last 24 hours. Secret values are never returned.

## Safety properties

- No Sentry write endpoints are used.
- The Sentry token is read only.
- The diagnostics endpoint requires the existing RIOSYSTEMS `API_TOKEN`.
- Issue payloads are reduced to operational metadata such as title, level, counts, and timestamps.
- This bridge does not install the Sentry ingestion SDK and does not send application events to Sentry.

## Separate ingestion step

Capturing Worker exceptions in Sentry is a separate integration. It requires the Sentry Cloudflare SDK and a project DSN. That step should be introduced independently and deployed only after explicit production approval.
