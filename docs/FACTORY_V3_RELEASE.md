# Project Factory V3 Release Snapshot

Status: RELEASE CANDIDATE / FROZEN

Release baseline: main @ 6d2c531a2b226666bfefe5d67106c7217eab2124

## Verified core paths

- GENERATE: chat request -> project -> branch -> draft PR -> Cloudflare preview -> desktop/mobile visual QA.
- EVOLVE: active project -> isolated deterministic staging branch -> real code changes -> preview -> visual QA -> promotion only after success.
- REBUILD: public source -> analysis -> independent project reconstruction -> preview -> visual QA -> active state.

## Safety and resilience

- Production deployment is approval-gated and disabled by default.
- Invalid production requests fail before deploy or state promotion.
- Request contract validation fails closed.
- Explicit failure reporting is enabled.
- Idempotency ledger prevents duplicate branches, PRs, deploys and QA for identical successful requests.
- Cost/usage guard deduplicates QA and applies warning/critical thresholds before automatic QA-only runs consume excessive preview budget.
- Factory Control is serialized to prevent concurrent state races.
- Serialized runs resolve the event request from its own event commit while refreshing the newest control state before execution.
- Partial failures reuse deterministic recovery branches and existing PRs.
- EVOLVE changes are transactional: failed visual QA leaves the previous active project untouched.
- State promotion and ledger recording occur only after successful validation and QA.

## Autopilot

Eligible `factory-v3/auto/*` pull requests targeting `main` are continued after green CI. The verified chain is:

CI -> automatic merge -> safe `factory-control` synchronization -> QA-only dispatch -> idempotency/cost guard -> success.

The final E2E smoke test was PR #93. CI run #248 succeeded, Factory Autopilot #55 succeeded, and Factory Control #53 succeeded.

## Release freeze rules

1. V3 runtime changes must continue through `factory-v3/auto/*` branches and CI.
2. Production remains disabled unless explicitly approved outside the automatic Factory flow.
3. Do not mutate an active project directly during EVOLVE; always use staging and promotion.
4. Do not bypass the serialized `factory-control` state/ledger path.
5. A failed QA run must never promote active state or record success.

## Known non-blocking repository items

Older project-specific pull requests may remain open because they are separate website/project work and are not part of the Factory V3 release. Recovery-only test PR #89 was closed during the freeze.

## Release decision

Project Factory V3 is considered functionally complete for its current scope once this snapshot passes CI and the existing Autopilot performs the final QA-only verification without production deployment.
