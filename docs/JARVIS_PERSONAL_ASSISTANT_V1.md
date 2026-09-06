# JARVIS Personal AI Operating System V1

JARVIS is the private personal intelligence, memory, planning, tool-routing, connector-routing, and action-control layer for the operator.

## Hard isolation rule

HAMYREN is a separate product and a separate data domain.

JARVIS:
- uses its own personal memory namespace: `jarvis.personal`
- does not read HAMYREN memory
- does not write HAMYREN memory
- does not share personal facts, goals, decisions, routines, preferences, files, calendar data, email data, or device context with HAMYREN
- has no automatic HAMYREN connector, memory sync, or data-return path
- rejects HAMYREN-sourced records from the JARVIS personal memory write path in V1
- rejects HAMYREN connector registrations in the connector registry
- has an independent persistence schema: `jarvis_private`

Any future HAMYREN use must be implemented as an explicit connector boundary carrying only the minimum approved request payload. It must never become shared memory.

## V1 core foundation

Implemented:
- one JARVIS Core service
- explicit intent contract
- minimal relevant personal context snapshot
- temporal personal memory contract
- memory trust states: CONFIRMED, INFERRED, TEMPORARY, UNVERIFIED, CONFLICTED, HISTORICAL
- controlled memory retrieval
- controlled memory writeback policy
- credential and secret rejection for memory
- JARVIS tool registry and tool router
- risk and autonomy action gate
- action planning contract
- action result verification contract
- privacy-preserving audit events
- cost estimate field and high-cost approval signal
- explicit production, billing, finance, and credential safeguards

## Personal Memory Persistence V1

Repository migration prepared at:
`supabase/migrations/20260907004000_jarvis_personal_memory_v1.sql`

The persistence domain provides:
- dedicated `jarvis_private` schema
- owner-scoped `personal_memory_v1`
- owner-scoped `audit_events_v1`
- forced Row Level Security
- `auth.uid()` owner isolation
- no anonymous access
- no foreign keys into HAMYREN
- fixed `jarvis.personal` namespace
- HAMYREN source-system rejection
- temporal memory fields
- secret/credential sensitivity states excluded from persistence

A provider-neutral JARVIS Supabase store adapter is implemented at:
`src/jarvis/memory-store-supabase-v1.js`

It deliberately uses separate JARVIS environment bindings:
- `JARVIS_PERSONAL_MEMORY_SUPABASE_URL`
- `JARVIS_PERSONAL_MEMORY_SUPABASE_SERVICE_ROLE_KEY`
- optional JARVIS schema/table bindings

The adapter follows the existing RIOSYSTEMS Supabase store pattern but only addresses the `jarvis_private` data domain. It does not reference HAMYREN tables and does not embed credentials in memory, audit events, code constants, or returned manifests.

The migration and store adapter are committed and CI-validated but are not applied/bound to any production database by this phase.

## Connector Runtime V1

Implemented as a provider-neutral adapter boundary:
- Calendar connector contract
- Email connector contract
- Files connector contract
- Tasks connector contract
- Reminders connector contract
- authenticated/available state separation
- capability routing
- required-permission enforcement
- secret-bearing payload rejection
- write authorization enforcement
- high-cost approval hook
- synthetic execution acceptance
- HAMYREN connector registration block

The connector runtime stores no credentials. OAuth tokens, API keys, session cookies, and passwords must remain in provider secret stores or encrypted credential stores and are injected only by the external connector host.

## Reuse / no parallel engines

JARVIS does not create a second AI provider registry, mission engine, automation engine, cost engine, or production runtime. Existing RIOSYSTEMS infrastructure remains the reusable execution backbone where a future adapter is appropriate.

The JARVIS action gate is a personal policy adapter, not a second production approval system. The connector runtime is an execution boundary, not a new automation engine.

## Current binding state

The connector contracts, connector runtime, persistent schema contract, and Supabase store adapter are implemented and synthetic-tested. Real Gmail, Google Calendar, Drive/files, task, reminder, and persistent personal database bindings remain disabled in repository runtime. No live personal connector or database is invoked by CI.

## Intentionally unbound in V1 core foundation

- live Gmail / Calendar / Drive / task / reminder account bindings
- live persistent JARVIS database activation
- voice and wake word
- proactive monitoring
- device and smart-home execution
- financial execution
- public product surface
- HAMYREN integration
- production deployment

## Development safety

- Production OFF
- Public OFF
- Billing OFF
- Paid provider calls OFF
- External writes OFF in CI
- Financial actions OFF

Acceptance is synthetic and repository-local. No live personal connector is exercised by the V1 smoke gates.
