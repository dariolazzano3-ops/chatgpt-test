# RIOSYSTEMS Phase 1 Control Plane

This block turns the Phase 1 runtime foundation into an optional fail-closed governance layer in the existing one-command mission pipeline.

Implemented:

- customer/project scope identity
- capability-wide provider routing contract
- health-aware provider fallback plans
- explicit per-attempt provider authorization boundary
- scoped approval records with actor identity, provider/capability binding and expiry
- project budget ledger with reserve, settle and release operations
- idempotent cost reservations
- project write boundaries and shared-core write protection
- mission pipeline stage `runtime_governance_optional`
- fail-closed `waiting_for_runtime_governance` state when Phase 1 governance is enabled but requirements are missing
- backwards compatibility for legacy V5 pipeline callers that have not enabled the Phase 1 runtime yet

The runtime control plane is deliberately separate from real provider activation. Routing, approvals and cost reservation do not themselves execute an external provider.

Production deployment remains disabled.

## Phase 1 remaining closure work

Before Phase 1 is considered complete, the branch must pass its dedicated CI and the existing V5 mission regressions. The final closure block should then add a consolidated Phase 1 readiness manifest/check that proves the foundation and control plane contracts together.
