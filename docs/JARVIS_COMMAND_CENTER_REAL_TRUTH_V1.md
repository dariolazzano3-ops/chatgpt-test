# JARVIS Command Center V1 — Real Runtime Truth

Status: WAVE 1 + WAVE 2 + WAVE 3 implementation candidate

Visual baseline: **ACCEPTED**

This work does not redesign the accepted dark / amber / cinematic Command Center. The screenshots supplied by the operator remain the visual source of truth. This phase only establishes the read-only operational truth contract that the accepted UI must consume.

## Non-negotiable rule

No visible operational value may imply real system state when the value is mock, demo, static decoration, stale, unproven, or unavailable.

When a source is unavailable the UI must render an explicit unavailable state such as `Unbekannt`, `Nicht verbunden`, `Keine Live-Daten`, or `Quelle fehlt`.

Runtime Truth > UI State  
Remote Truth > Memory  
Evidence > Assumptions

## Wave 1 — Current code and data audit

The repository already contains useful runtime primitives, but the accepted screenshot UI is not the same UI currently committed in `src/jarvis/ui-v1.js`. The committed UI is an older blue/glass JARVIS surface. Therefore this wave intentionally does not alter visual components. The runtime truth layer is isolated so it can be wired into the accepted Command Center source without visually re-inventing it.

### Data Source Map

| Domain | Classification | Current source | Binding state | Audit result |
|---|---|---|---|---|
| JARVIS | DERIVED / partial | `src/jarvis/http-v1.js`, `src/jarvis/runtime-v1.js` | PARTIAL | Auth/session, memory readiness and connector facts exist. `core_online: true` is currently static and is **not** sufficient liveness proof. |
| HERMES | UNKNOWN | none proven | NOT_CONNECTED | No inspected process/container health reader proves ONLINE/OFFLINE. |
| ASTRA | UNKNOWN | none proven | NOT_CONNECTED | No inspected live reasoning-service availability source is bound. |
| CLAUDE | STATIC policy only | `src/jarvis/integration-layer-v1.js` | POLICY_ONLY | Claude Code is registered as a capability/provider, but this does not prove AVAILABLE/BUSY/UNAVAILABLE. |
| CODEX | UNKNOWN | none proven | NOT_CONNECTED | No live fallback status source is bound. |
| BRIDGE | UNKNOWN | none proven | NOT_CONNECTED | No dedicated Bridge health reader was established in the audited path. |
| GIT | REAL-capable | `src/source-of-truth.js`, `github.remote_truth.read` capability | ADAPTER_REQUIRED | Full-SHA truth validation exists. A live project-head resolver still has to be injected. |
| RUNS | REAL-capable | `src/ai-job-state.js`, `execution_runs` Command Center contract | ADAPTER_REQUIRED | Real job state models exist, but the screenshot runs are not accepted unless a real store supplies them. |
| APPROVALS | REAL-capable | `src/runtime-approvals.js` | ADAPTER_REQUIRED | Canonical scoped approval records exist. The Command Center needs a real current-record reader. |
| ACTIVITY | REAL write path | `src/jarvis/audit-v1.js`, JARVIS private audit table | READ_PATH_MISSING | Runtime actions append redacted audit events. The inspected Supabase store exposes `appendAudit`, but not a corresponding audit read method. |
| EVIDENCE | UNKNOWN | no Command Center reader proven | NOT_CONNECTED | Evidence references must come from a real evidence source and may never be invented from UI state. |
| PROJECTS | DERIVED / state-dependent | `src/command-center.js` portfolio snapshot | STATE_DEPENDENT | Valid only when the supplied portfolio is itself authoritative runtime state. |
| MEMORY | REAL-capable | `src/jarvis/memory-store-supabase-v1.js` | READ_CAPABLE | Durable private JARVIS memory has a real read path when configured. |
| COSTS | UNKNOWN | no complete JARVIS cost truth reader proven | NOT_CONNECTED | Audit defaults cannot be presented as complete spend/usage truth. |

## Operational mock inventory from accepted screenshots

The following screenshot values are treated as **MOCK / UNKNOWN until a real runtime source proves them**:

- `3 Runs in Arbeit`
- `2 laufen, 1 warten`
- `+2 heute`
- `+11 diese Woche`
- `94 % erfolgreich`
- `R-0142`, `R-0137`, `R-0141`
- `Command Center V1: Home-Ansicht`
- `JARVIS: Memory-Index neu aufbauen`
- `AURENTARA: Landing-Copy veröffentlichen`
- `Claude Worker 1 von 2 Slots`
- `Worker-Limit heute 62 %`
- demo activity timestamps and example events
- `RIOSYSTEMS: Lead-Pipeline Refactor`
- `HERMES ONLINE`
- `ASTRA ONLINE`
- `BRIDGE 1 HINWEIS`
- `GIT SYNCHRON`
- any green/amber status indicator whose state is not backed by a runtime source

These strings are not deleted from the screenshot reference. They are forbidden as runtime truth unless later supplied by a valid source adapter.

## Existing code risks found in Wave 1

### Static liveness claim

`GET /jarvis/api/status` currently emits `core_online: true`. This confirms that the request handler executed, but it does not independently prove all JARVIS runtime dependencies are healthy. The Real Truth layer therefore rejects static liveness as proof for the Command Center status.

### UI overstatement

The committed legacy `src/jarvis/ui-v1.js` promotes a successful session/status request to an `ONLINE` pill and renders a default live dot. This is not sufficient for the new Command Center truth policy. The accepted amber UI must consume the new adapter instead of inferring liveness from presentation state.

### Activity is write-only in the inspected JARVIS store

JARVIS already creates redacted audit events and persists them, which is a strong basis for real Activity. However, the inspected durable store does not expose an audit read method. Wave 4 must add a bounded owner-scoped read path before the Activity timeline can be marked connected.

## Wave 2 — Read-only Data Contract / Runtime Adapter Layer

Implemented in:

`src/jarvis/command-center-runtime-truth-v1.js`

Acceptance smoke:

`scripts/jarvis-command-center-runtime-truth-v1-smoke.mjs`

### Source envelope contract

Every source that wants to populate operational UI truth must provide:

```js
{
  classification: 'REAL' | 'DERIVED',
  source_id: 'stable-source-name',
  observed_at: 'ISO-8601 timestamp',
  stale_after_ms: 60000, // optional
  derived_from: ['real-source-a'], // mandatory for DERIVED
  data: ...
}
```

`MOCK`, `STATIC`, malformed, missing-provenance, stale, or failing sources are rejected and collapse to explicit UNKNOWN / NOT_CONNECTED / UNAVAILABLE / STALE states.

### System states

The adapter uses fail-closed system enums:

- JARVIS: `ONLINE`, `DEGRADED`, `UNKNOWN`
- HERMES: `ONLINE`, `OFFLINE`, `UNKNOWN`
- ASTRA: `AVAILABLE`, `DEGRADED`, `UNKNOWN`
- CLAUDE: `AVAILABLE`, `BUSY`, `UNAVAILABLE`, `UNKNOWN`
- CODEX: `STANDBY`, `ACTIVE`, `UNAVAILABLE`, `UNKNOWN`
- BRIDGE: `HEALTHY`, `DEGRADED`, `OFFLINE`, `UNKNOWN`
- GIT: `SYNCED`, `CHANGED`, `UNKNOWN`

No source means `UNKNOWN`. There is no decorative default ONLINE state.

### Run states

Accepted run states:

`QUEUED`, `RUNNING`, `WAITING_APPROVAL`, `COMPLETE`, `FAILED`, `INTERRUPTED`, `RESUMED`, `BLOCKED`

The existing internal `COMPLETED` state is normalized to Command Center `COMPLETE`.

Run progress is hidden unless all of these are true:

1. progress is numeric from 0 to 100
2. `progress_verified === true`
3. a non-empty `progress_basis` explains the derivation

This prevents arbitrary visual progress bars from becoming operational truth.

### Activity

Activity rows require a real timestamp. Rows without a valid source timestamp are rejected instead of receiving a UI-generated time.

### Safety boundary

Wave 2 is deliberately read-only:

- command dispatch OFF
- production deploy OFF
- DNS write OFF
- billing write OFF
- secret rotation OFF
- destructive DB write OFF
- canonical/main merge OFF
- public release OFF
- Docker socket exposure OFF
- HAMYREN data flow OFF

The adapter contains no deploy, merge, billing, DNS, secret, database mutation, or worker execution path.

## Wave 3 — Explicit live read bindings

Implemented in:

- `src/jarvis/command-center-runtime-truth-v1.js` — `createJarvisCommandCenterLiveProbeBindingsV1`, `jarvisCommandCenterLiveProbeContractV1`
- `src/source-of-truth.js` — `deriveRemoteGitStatus` (genuine remote truth only)
- `src/jarvis/integration-layer-v1.js` — `jarvisIntegrationLivenessClaimV1` (registry proves policy, never liveness)
- `src/jarvis/http-v1.js` — `GET /jarvis/api/runtime-truth` (private, `Request` → `Response`)

Acceptance smoke:

`scripts/jarvis-command-center-runtime-truth-v1-wave3-smoke.mjs`

### System status binding contract

`JARVIS`, `HERMES`, `ASTRA`, `CLAUDE`, `CODEX`, `BRIDGE` remain `UNKNOWN` unless a genuine
live probe returns:

```js
{
  live: true,                 // explicit proof marker — anything else is rejected
  state: 'ONLINE',            // must be in that system's enum, excluding UNKNOWN
  source_id: 'stable-probe',
  observed_at: 'ISO-8601',
  stale_after_ms: 60000       // optional freshness bound
}
```

A missing probe, `live !== true`, an out-of-enum state, missing provenance, a stale
`observed_at`, or a probe that throws all collapse to `UNKNOWN`. No probe is wired by
default, so the shipped `GET /jarvis/api/runtime-truth` response reports every system as
`UNKNOWN` with `systems.source.source_state = NOT_CONNECTED` until a real probe is injected
through `options.command_center_probes`.

### Git status binding contract

`GIT` is derived only from genuine remote truth. The git probe must return a real remote
head plus the local head with provenance; `deriveRemoteGitStatus` then yields:

- `SYNCED` — remote head equals local head (both full 40-char SHAs)
- `CHANGED` — remote and local heads are valid but differ
- `UNKNOWN` — remote head unproven, not a full SHA, or missing provenance

There is no static `SYNCHRON` / `SYNCED` decoration.

### Fake operational values removed

The Wave 3 route never emits the accepted-screenshot demo values (`3 Runs in Arbeit`,
`94 % erfolgreich`, `R-0142`, `HERMES ONLINE`, `GIT SYNCHRON`, worker-slot percentages,
demo activity timestamps, …). Runs / activity / approvals / evidence / projects / costs
stay empty unless a real Wave 2 source envelope is bound. The legacy static
`core_online: true` liveness claim on `GET /jarvis/api/status` is untouched but is **not**
consumed by the runtime-truth snapshot.

### Wave 3 safety boundary

Still read-only. The route and helpers contain no deploy, merge, DNS, billing, secret, or
database-mutation path. `permissions: contents: read` on CI; no deploy step.

## Smallest clean integration plan

1. Keep the accepted visuals frozen.
2. Use `command-center-runtime-truth-v1.js` as the only operational data ingress for the Command Center.
3. Wave 3 (done): explicit live read bindings for JARVIS/Hermes/Astra/Claude/Codex/Bridge and genuine-remote-truth Git status, exposed at `GET /jarvis/api/runtime-truth`. Anything not bound remains UNKNOWN.
4. Wave 4: bind persisted runs and add a bounded, owner-scoped JARVIS audit reader for Activity.
5. Wave 5: bind canonical approvals and Evidence.
6. Only after read-only truth is stable, Wave 6 may connect text commands through the existing safe JARVIS path.
7. Voice remains presentation-only until a secure speech pipeline exists.
8. V5 deployment closure remains a separate project. This branch must not trigger a V5 cutover.

## Definition for Wave 3 acceptance

- Accepted visual design unchanged (`src/jarvis/ui-v1.js` untouched).
- `GET /jarvis/api/runtime-truth` added with `Request` → `Response`, private, read-only.
- Git status only from genuine remote truth; otherwise `UNKNOWN`.
- JARVIS/Hermes/Astra/Claude/Codex/Bridge `UNKNOWN` unless a genuine live probe proves otherwise.
- No fake operational status values in the route response.
- Wave 1 + Wave 2 smoke plus `jarvis-command-center-runtime-truth-v1-wave3-smoke.mjs` pass.
- No deploy, no merge, no Cloudflare/DNS/billing/secret changes.

## Definition for Wave 1 + Wave 2 acceptance

- Visual baseline untouched.
- Data source map committed and machine-readable.
- Mock/static operational values cannot enter a truth snapshot.
- Missing sources fail closed to explicit unknown/unavailable states.
- Run progress requires explicit verified basis.
- Read failures do not fabricate healthy state.
- HAMYREN isolation preserved.
- No production, billing, DNS, secret, destructive DB, merge, public release, or Docker socket action introduced.
- CI acceptance is read-only and contains no deploy step.
