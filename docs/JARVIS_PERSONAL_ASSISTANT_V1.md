# JARVIS Personal AI Operating System V1

JARVIS is the private personal intelligence, memory, planning, tool-routing, and action-control layer for the operator.

## Hard isolation rule

HAMYREN is a separate product and a separate data domain.

JARVIS:
- uses its own personal memory namespace: `jarvis.personal`
- does not read HAMYREN memory
- does not write HAMYREN memory
- does not share personal facts, goals, decisions, routines, preferences, files, calendar data, email data, or device context with HAMYREN
- has no automatic HAMYREN connector, memory sync, or data-return path
- rejects HAMYREN-sourced records from the JARVIS personal memory write path in V1

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

## Reuse / no parallel engines

JARVIS does not create a second AI provider registry, mission engine, automation engine, or production runtime. Existing RIOSYSTEMS infrastructure remains the reusable execution backbone where a future adapter is appropriate.

The JARVIS action gate is a personal policy adapter, not a second production approval system. External connector execution remains unbound in this V1 foundation.

## Intentionally unbound in V1 core foundation

- live Gmail / Calendar / Drive / task connectors
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
- External writes OFF
- Financial actions OFF

Acceptance is synthetic and local to the repository. No live personal connector is exercised by the V1 smoke gate.
