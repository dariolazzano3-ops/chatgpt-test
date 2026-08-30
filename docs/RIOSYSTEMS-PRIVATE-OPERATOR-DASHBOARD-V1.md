# RIOSYSTEMS Private All-in-One Operator Control Plane V1

## Purpose

This browser surface is the private single-operator cockpit for the existing RIOSYSTEMS control plane. It is deliberately not a second mission planner, capability router, provider router, cost engine, approval engine, quality engine, or delivery engine.

Architecture:

`Browser /operator -> Cloudflare Access identity -> operator-dashboard-http-v1 -> operator-runtime-api-v1 -> operator-control-plane-v1 / command-center / universal-mission-run-v1 -> existing factories and provider evidence`

The backend remains authoritative.

## V1 navigation

- HQ
- Projects
- Mission Studio
- Approvals
- Factories
- Providers
- Costs
- Deliveries
- System Health
- Audit Log
- Settings

The UI uses one shared status mapping and deliberately keeps technical detail behind expandable evidence blocks.

## Complete V1 vertical slice

1. Open HQ.
2. Choose a synthetic project.
3. Enter a natural-language mission in Mission Studio.
4. The server overwrites safety-sensitive fields with V1 safe defaults.
5. The existing Universal Mission compiler performs compilation, business analysis, capability selection/rejection, dependency planning, provider routing and cost preflight.
6. The browser receives a read-only Plan Review plus an expiring server-side plan token.
7. No execution has happened yet.
8. Operator approval posts only the plan token.
9. The server checks operator identity and runtime revision again.
10. Only then the existing Operator Runtime API runs the existing Universal Mission Run in supervised synthetic staging mode.
11. Quality and Unified Delivery are read back through the existing Runtime API.
12. Results, evidence, costs and audit events appear in the same dashboard.

The dashboard does not expose the raw `POST /universal-missions` runtime endpoint. This prevents the browser from bypassing Plan Review and the dashboard approval token.

## Safety invariants

- staging only
- synthetic data only
- production authorization forced to false
- variable mission budget forced to 0 EUR
- paid overflow forced to false
- no direct provider calls from the browser
- no provider credentials in browser responses
- no automatic dispatch
- no implicit external write
- no real customer data
- no DNS or domain changes
- no mass communication
- no money movement
- no production deploy path
- runtime mutations retain existing compare-and-swap revision protection
- a plan becomes invalid if the runtime revision changes before approval

## Private access

The Worker route is fail-closed.

The dashboard requires Cloudflare Access identity through `ctx.access`. The Worker checks both:

- the Access audience against `RIOSYSTEMS_ACCESS_AUD`
- the authenticated email against `RIOSYSTEMS_OPERATOR_EMAIL`

If either variable is missing, Access did not run, the audience differs, or the email differs, `/operator` and `/operator/api/*` are denied.

No public registration exists. No auth token is stored in the repository or sent to the browser.

### Local browser run

`wrangler.jsonc` contains a Cloudflare Access development identity only:

- audience: `riosystems-operator-local`
- email: `operator@riosystems.local`

These values are local test fixtures, not a production identity.

Run locally without committing credentials:

```bash
npx wrangler dev --var RIOSYSTEMS_OPERATOR_EMAIL:operator@riosystems.local --var RIOSYSTEMS_ACCESS_AUD:riosystems-operator-local
```

Then open:

```text
http://localhost:8787/operator
```

For a future protected staging deployment, configure the real allowed operator email and Access audience outside the repository and enable Cloudflare Access for the Worker route before exposing it. Do not deploy the dashboard without that explicit deployment approval.

## Reality labels

The dashboard intentionally separates evidence states. Current Universal Mission execution is shown as synthetic staging and `SIMULATED_HANDOFF_READY`, never as production.

Cost Center uses `ESTIMATED_ZERO` for the current zero-variable-cost synthetic runs. It does not claim `FREE VERIFIED` merely because the estimated amount is 0 EUR.

System Health does not invent CI health at runtime. CI is shown as `NOT_VERIFIED` in the browser unless a future authoritative CI projection is added.

## Runtime persistence limitation

`operator-runtime-store-v1` currently provides the repository's memory reference adapter. Dashboard runtime state can therefore disappear when a Worker isolate restarts. The UI states this explicitly.

V1 does not invent a second database or persistence model. A later durable adapter should implement the existing `load`, `create` and `compareAndSwap` runtime-store contract, for example using an already-approved RIOSYSTEMS storage mechanism.

## Synthetic projects

The initial single-operator runtime contains three isolated synthetic project scopes for dashboard operation and regression:

- Bäckerei Müller
- Muster Handwerksbetrieb
- Synthetic Service Studio

Universal Mission Run V1's own Bäckerei Müller and industry-independent Handwerk regression remain separate canonical tests.

## CI

`.github/workflows/riosystems-operator-dashboard-v1.yml` runs:

- syntax checks
- dashboard access and vertical-slice acceptance
- Operator Runtime API regression
- Operator Control Plane regression
- Command Center regression
- Universal Mission Run regression
- integrated RIOSYSTEMS regression gate
- Cloudflare staging bundle dry-run

No deploy command is executed.

## Known V1 gaps

These are intentionally not disguised as completed capabilities:

- durable Operator Runtime storage adapter is not yet connected
- real staging deployment is not performed by this block
- real Cloudflare Access application/policy configuration is not changed by this block
- CI status is not yet projected into the runtime API
- new customer/project creation is not added because there is no existing authoritative create-project command in the Operator Runtime API
- production actions remain unavailable

These gaps preserve the existing ownership boundaries instead of solving them with duplicate frontend logic.
