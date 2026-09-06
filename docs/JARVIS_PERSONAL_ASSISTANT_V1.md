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

The connector contracts and runtime are implemented and synthetic-tested. Real Gmail, Google Calendar, Drive/files, task, and reminder accounts remain unbound in repository runtime. No live personal connector is invoked by CI.

## Intentionally unbound in V1 core foundation

- live Gmail / Calendar / Drive / task / reminder account bindings
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
