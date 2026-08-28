# RIOSYSTEMS Real Provider Bridge v2

## Scope

This block connects real-provider candidates to the existing integration catalog, Factory integration planner and optional Mission Pipeline planning stage without activating any external provider.

## Enforced boundaries

- Credential references only; inline credential values are rejected.
- HTTPS endpoints and explicit host allowlists.
- Hard eligibility before execution for budget, free-tier, ownership, code export, data classes and automation interface.
- Explicit real-provider activation, supervised execution, paid-cost and external-write approvals.
- Dry-run planning is the default.
- No automatic mock-to-real cutover; mock fallback requires explicit opt-in.
- Provider runners are injected and are never resolved automatically.
- Production responses and undeclared side effects from runners are rejected.
- Production deployment remains disabled.

## Mission safety hardening included

- Mission Pipeline propagates Supervisor persistence failures.
- Bound missions require the observed project head on resume.
- Remote Supervisor persistence validates mission identity and expected revision before every write.
- Mission Intake binds source revisions and persists Mission, Contracts and Package Manifest with one non-force Git ref update.

## Explicitly not included

- Real credentials or secret values.
- A configured external provider account.
- Paid calls, external writes or production deployment.
- Automatic provider activation or automatic provider cutover.
- A production data store for the broader RIOSYSTEMS runtime.

## Verification

The generic `npm run check` now includes the consolidated RIOSYSTEMS Phase 1–6, zero-cost pilot, real-provider bridge and mission-safety regression suites. A dedicated pull-request workflow repeats the bridge and safety checks against `factory-control`.
