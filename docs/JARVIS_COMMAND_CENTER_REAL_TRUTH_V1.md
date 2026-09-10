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

## Wave 3 — Frontend closure (accepted orange Command Center)

The first frontend-closure attempt wired the wrong surface: `src/jarvis/ui-v1.js`
is the **legacy blue** JARVIS chat surface, not the accepted Command Center. That
change was reverted (the blue file is back to its Wave‑3 state and stays reachable
at `GET /jarvis/legacy`).

The accepted UI is the operator's orange/amber React design, vendored verbatim as
the visual source of truth:

`src/jarvis/command-center-ui/jarvis-command-center.jsx` — `VISUAL_BASELINE=ACCEPTED`

### Repo / build integration (minimal)

- The `.jsx` is bundled with React + `lucide-react` into one self-contained IIFE by
  `scripts/jarvis-command-center-ui-build-v1.mjs` and vendored as
  `src/jarvis/command-center-ui/bundle.built.js` (a generated string module).
- `src/jarvis/command-center-v1.js` wraps that bundle in an HTML document and sets
  `window.__JARVIS_CC__ = { apiBase }`. Delivery is **inline** — no deploy‑time asset
  pipeline, works for both the mounted worker and the neutral standalone host.
- `GET /jarvis` now serves this shell (`commandCenterHtml`, CSP additionally allows
  only `https://fonts.googleapis.com` / `https://fonts.gstatic.com` for the design's
  webfonts; no external script origin — the bundle is inline).
- React / react-dom / lucide-react are **devDependencies**; the runtime worker never
  imports them (only the pre-built string).

### What is connected

Only the **System Status** section (`SystemPanel` on Home, the service grid in
`SystemView`) reads `GET <base>/api/runtime-truth`:

- a live state is shown only when `systems.source.classification` is `REAL` or
  `DERIVED`; every `UNKNOWN` / non-canonical / fetch-failure case renders
  **`Nicht verbunden`**.
- the map is `hermes→HERMES`, `astra→ASTRA`, `claude→CLAUDE`, `bridge→BRIDGE`,
  `git→GIT`; the accepted row set is unchanged (no rows added or removed).
- the static per-service `Online` / `Synchron` / `1 von 2 Slots` / `38 ms` /
  `99,98 %` / heartbeat / "last event" values were removed from `SERVICES`;
  Heartbeat / Latenz / Uptime render `Unbekannt`, the sparkline is a flat baseline,
  the Home "Worker-Limit heute" figure is `Unbekannt`.
- the top-bar badge is honest: `System Status: Live · übrige Bereiche: Mock` when the
  fetch succeeds, otherwise `Runtime nicht verbunden · Mock-Daten`.

Runs, Activity, Freigaben, Limits und Nutzung, Sicherheit and the Pipeline stay
**mock** (now marked `Mock`) until their own waves.

### Preserved

Amber/orange token system (`--amber:#ffab40`, `--bg:#040405`, `--hi:#ffd08a`,
`--deep:#ff7a1a`), layout, the Orb / OrbStage / Beam / Starfield visuals, sidebar and
mobile navigation, all panels, Michroma / IBM Plex Mono / Manrope typography,
interactions and spacing — byte-for-byte from the accepted source apart from the
System Status data swap above.

Acceptance smoke: `scripts/jarvis-command-center-orange-ui-v1-smoke.mjs` (asserts
accepted amber design tokens and CSS markers are served, the legacy blue markers are
not, System Status is wired to `/runtime-truth`, and the fake per-service metrics are
gone).

## Wave 4 — real Runs + real Activity

Seeded mock Runs / Activity / Approvals were removed from the accepted UI's `init()`.
The Home Runs panel, Tasks, the Activity feed, Logs, Freigaben and the Chat context
panel now render from `GET <base>/api/runtime-truth` (or an honest
`Nicht verbunden` / `Noch keine …` / loading state).

Source of truth:

- `store.readAudit({ owner_id, owner_ref, limit })` — a new bounded, owner-scoped,
  deterministic, read-only audit reader added to the memory store, the Supabase
  REST store and the Supabase RPC store (RPC `jarvis_service_audit_read_v1`,
  migration `20260911090000_jarvis_audit_read_v1.sql`). Missing / erroring →
  the caller throws and the domain fails closed. No fabricated empty success.
- `src/jarvis/command-center-read-bindings-v1.js` — `createJarvisCommandCenterReadBindingsV1`
  projects the real persisted audit events into source envelopes:
  - `activity` = **REAL** (`jarvis-audit-reader-v1`) — one row per persisted event,
    real persisted timestamp only; rows with no parseable timestamp / no content
    are rejected.
  - `runs` = **DERIVED** (`jarvis-run-projection-v1`, `derived_from` the audit
    reader) — grouped by `request_id`; canonical run states only
    (`QUEUED/RUNNING/WAITING_APPROVAL/COMPLETE/FAILED/INTERRUPTED/RESUMED/BLOCKED`);
    `progress` is **always `null`** (never a fabricated percentage; the detail
    panel shows `Unbekannt` and no progress bar).
  - `approvals` = **DERIVED** — audit events that required an approval gate;
    `AWAITING_APPROVAL` → `PENDING` (not `GRANTED`).
  - `evidence` = **DERIVED** — commit / audit references carried by events.
- `GET /jarvis/api/runtime-truth` merges these over the Wave 3 probe bindings.
- With no audit history the panels show `Noch keine Runs` / `Noch keine Aktivität`;
  with no readable store they show `Nicht verbunden`.
- The command field no longer fabricates runs, approvals, logs or a synthetic
  JARVIS reply (Wave 6 makes it real). `TICK` only animates session-local
  optimistic runs, never a projected one.

Acceptance smoke: `scripts/jarvis-command-center-wave4-smoke.mjs`.

## Smallest clean integration plan

1. Keep the accepted visuals frozen.
2. Use `command-center-runtime-truth-v1.js` as the only operational data ingress for the Command Center.
3. Wave 3 backend (done): explicit live read bindings for JARVIS/Hermes/Astra/Claude/Codex/Bridge and genuine-remote-truth Git status, exposed at `GET /jarvis/api/runtime-truth`. Anything not bound remains UNKNOWN.
3b. Wave 3 frontend (done): serve the accepted orange `jarvis-command-center.jsx` at `GET /jarvis`; wire only its System Status section to `/jarvis/api/runtime-truth`; legacy blue UI moved to `/jarvis/legacy`.
4. Wave 4: bind persisted runs and add a bounded, owner-scoped JARVIS audit reader for Activity.
5. Wave 5: bind canonical approvals and Evidence.
6. Only after read-only truth is stable, Wave 6 may connect text commands through the existing safe JARVIS path.
7. Voice remains presentation-only until a secure speech pipeline exists.
8. V5 deployment closure remains a separate project. This branch must not trigger a V5 cutover.

## Definition for Wave 3 acceptance

Backend:

- `GET /jarvis/api/runtime-truth` added with `Request` → `Response`, private, read-only.
- Git status only from genuine remote truth; otherwise `UNKNOWN`.
- JARVIS/Hermes/Astra/Claude/Codex/Bridge `UNKNOWN` unless a genuine live probe proves otherwise.
- No fake operational status values in the route response.
- Wave 1 + Wave 2 smoke plus `jarvis-command-center-runtime-truth-v1-wave3-smoke.mjs` pass.

Frontend closure:

- The accepted orange `jarvis-command-center.jsx` is the served Command Center at `GET /jarvis`; the legacy blue `ui-v1.js` is restored and moved to `/jarvis/legacy`.
- Amber/orange visual system, layout, Orb, desktop + mobile design, navigation, panels, typography, interactions and spacing preserved.
- Only System Status consumes canonical Runtime Truth (`REAL`/`DERIVED` only); `UNKNOWN` → `Nicht verbunden`.
- No fake latency / usage / uptime / heartbeat / timestamp in System Status.
- `scripts/jarvis-command-center-orange-ui-v1-smoke.mjs` proves the accepted UI (amber tokens) is served and the blue UI cannot satisfy it.
- W1/W2/W3 smokes, the rendered-UI regressions and the bundle builds pass.

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
