# PostHog Core Telemetry

RIOSYSTEMS sends a deliberately small operational event set to PostHog for control-plane observability.

## Safety posture

Telemetry is **disabled by default**. It becomes active only when both conditions are true in the Worker environment:

- `POSTHOG_TELEMETRY_ENABLED=true`
- `POSTHOG_PROJECT_TOKEN` is configured

The PostHog project token must be stored as a Cloudflare Worker secret. Never commit it to GitHub, `wrangler.jsonc`, logs, issues, or documentation.

This integration performs no deployment by itself and has no production-control capability. Telemetry failures are isolated from Factory responses.

## Endpoint

Default EU ingestion host:

`https://eu.i.posthog.com`

Capture endpoint:

`POST /i/v0/e/`

An optional `POSTHOG_HOST` override exists for controlled environments.

Current PostHog references:

- https://posthog.com/docs/api/capture
- https://posthog.com/docs/libraries/cloudflare-workers

## Event contract

Event name:

`riosystems_factory_operation`

Stable distinct ID:

`riosystems-control-plane`

`$process_person_profile` is always `false`, so these operational events do not intentionally create person profiles.

Only these properties are allowed:

- `operation`
- `route`
- `method`
- `status_code`
- `outcome`
- `environment`
- `source`
- `telemetry_version`
- `$process_person_profile`

The project token is required by the PostHog capture payload but is not an event property.

## Tracked operations

Only selected POST operations are tracked to keep volume low:

| Route | Operation |
| --- | --- |
| `/factory/plan` | `plan` |
| `/factory/generate/run` | `generate_run` |
| `/factory/rebuild/run` | `rebuild_run` |
| `/factory/evolve/apply` | `evolve_apply` |
| `/factory/materialize` | `materialize` |

GET requests, diagnostics endpoints, preview reads, and unrelated Factory routes are not tracked by this adapter.

## Explicitly excluded data

The adapter does not collect or forward:

- request bodies
- prompts or generated content
- customer IDs or customer data
- project names
- source URLs
- URL query strings
- request headers
- authorization headers
- cookies
- IP addresses
- user agents
- Sentry tokens
- GitHub tokens
- Cloudflare tokens
- response bodies

The smoke test enforces representative privacy assertions.

## Cost posture

The integration is intentionally low-volume and designed for the existing capped PostHog Free setup. No paid PostHog capability is enabled by this code. The event allowlist prevents broad HTTP-log ingestion and keeps operational event volume bounded by selected Factory actions.

The standing RIOSYSTEMS rule remains: no paid upgrade, uncapped usage, or billable provider action without explicit approval.

## Activation sequence

Activation is a separate operational step after code review and explicit deployment approval:

1. Copy the project token directly from PostHog Project Settings. Do not paste it into chat.
2. Store it as Cloudflare Worker secret `POSTHOG_PROJECT_TOKEN`.
3. Set Worker variable `POSTHOG_TELEMETRY_ENABLED=true`.
4. Optionally set `RIOSYSTEMS_ENV` to a non-sensitive environment label such as `staging` or `production`.
5. Deploy only after explicit approval.
6. Run one safe deterministic Factory operation.
7. Verify `riosystems_factory_operation` appears in PostHog and inspect only the allowlisted properties.

Until steps 2 and 3 are both complete, the adapter emits nothing.
