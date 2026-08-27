# LEAN V4.0 — Web Factory Mission Executor

LEAN V4.0 connects durable orchestration missions to the existing Web Factory without duplicating the web build pipeline.

## Flow

Mission task → execution contract → authorized web adapter → Factory request on `factory-control` → existing Preview/QA/Self-Healing pipeline → durable Factory job → reconciliation back into the same mission.

## Safety

- Mission execution is initiated explicitly through `workflow_dispatch`.
- The web adapter always sends `production_deploy: false`.
- Production remains a separate manually approved release workflow.
- Planned factories remain unavailable and cannot be dispatched.
- The supervisor waits only for terminal Factory job states and reconciles validated outputs/errors.
- Factory Control remains the single source of truth for web execution, QA and repair.

## CI

Pull requests targeting `factory-control` are now covered by the normal CI workflow. V4.0 adds readiness checks for the supervisor, adapter authorization and production isolation.
