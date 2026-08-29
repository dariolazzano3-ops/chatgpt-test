# RIOSYSTEMS Make Staging Activation

Status: contract ready, account/API connection still required.

## Purpose

Make is the primary external Automation Factory runtime for the current single-operator stage. This block prepares the first real staging bridge without executing a Make request, creating a scenario, consuming scenario credits, or enabling production.

## Current Make facts verified 2026-08-29

- Make API uses zone-specific API base URLs in the form `https://{zone}/api/v2`.
- Official example zones include `eu1.make.com`, `eu2.make.com`, `us1.make.com`, `us2.make.com`, plus Celonis-hosted EU1/US1 variants.
- API token authentication uses `Authorization: Token <token>`.
- Read-only preflight can use `GET /ping` and `GET /scenarios?teamId=...` with the required read scopes.
- Creating scenarios requires `scenarios:write`.
- Running a scenario requires `scenarios:read`, `scenarios:write`, and `scenarios:run`; the scenario must be active.
- Make Free currently includes 1,000 credits/month but not Make API access. Core currently starts at USD 12/month for 10,000 credits and includes Make API access.
- Extra-credit auto-purchasing exists on paid plans, so RIOSYSTEMS explicitly keeps automatic extra-credit purchase disabled as a policy.

Official references:
- https://developers.make.com/api-documentation/getting-started/api-structure
- https://developers.make.com/api-documentation/authentication
- https://developers.make.com/api-documentation/api-reference/general
- https://developers.make.com/api-documentation/api-reference/scenarios
- https://www.make.com/en/pricing

## Secret handling

No Make API token is stored in GitHub. The bridge only accepts an opaque credential reference such as `secret:MAKE_API_TOKEN`. The actual token must live in an approved secret store/runtime environment.

## Activation sequence

1. Confirm the existing Make account has API access (Core or higher).
2. Create a least-privilege Make API token for RIOSYSTEMS.
3. Record only the zone URL, team ID, plan class, granted scopes, and token reference.
4. Run the read-only preflight: `/ping` plus scenario listing.
5. Build the first Bäckerei Müller staging scenario from synthetic test data.
6. Before scenario creation, require explicit paid-provider, external-write, supervised-execution, and staging-only gates.
7. Before the first scenario run, require the same gates plus `scenarios:run` scope.
8. Keep real customer data, CRM writes, extra-credit auto-purchase, and production disabled during the first staging proof.

## Bäckerei Müller first proof

The first scenario is intentionally harmless: synthetic webhook input → normalization → qualification → structured output. It does not write to a CRM or use real customer data. This proves the LEAN → Automation Factory → Make route before adding business side effects.

## Code boundary

`src/make-staging-bridge.js` currently plans and validates Make API operations but sets `execute_http: false` for every request. A later activation block may add the actual HTTP runner only after the account connection and approvals are available.
