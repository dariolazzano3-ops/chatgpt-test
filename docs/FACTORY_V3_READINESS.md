# Factory V3 Readiness Gate

`scripts/factory-v3-readiness.mjs` is the final structural readiness check for Project Factory V3.

It fails CI unless the repository still proves the core V3 guarantees together:

- Factory Control supports explicit dispatch and can publish commit statuses.
- Cost/usage guard and Visual QA are wired into Factory Control.
- Factory Autopilot is limited to `factory-v3/auto/*` branches and only proceeds after successful CI.
- Autopilot dispatches QA-only verification and does not deploy production.
- The strict Factory request contract and cost thresholds remain present.
- The active project stays inside `projects/`, has a canonical HTTPS preview, remains in editing mode, and has production deployment disabled.

The gate runs as part of `npm run check`, so every CI run for infrastructure changes verifies the V3 control plane as one system instead of validating only individual files.

A green readiness gate does not authorize production deployment. Production remains a separate explicit approval-gated action.
