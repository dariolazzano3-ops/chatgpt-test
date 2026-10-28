# JARVIS Universal Project Adapter V1 | Evidence and acceptance (2026-10-28)

## Direct evidence collected on existing VPS

- Device `v2202609413456515163` reachable through Desktop Commander.
- Executor identity: `uid=1000(jarvis)`, member of group `jarvis`.
- `jarvis-remote-operator.service`: running, as `jarvis-operator`.
  Runtime WorkingDirectory `/opt/jarvis/chatgpt-test` is `0700`
  owned by `jarvis-operator`. The account `jarvis` cannot inspect or modify it.
- Private owner-control socket `/opt/jarvis/owner-deploy-queue/owner-control.sock`
  responds HTTP 200 for GET `/v1/status`, `/v1/runtime-truth` and
  `/v1/project-targets`.
- Current live registry revision: 4, containing exactly `AURENTARA` and
  `JARVIS_AUTONOMY_TEST`. No `LUKAS_PAFF` route.
- Existing Project Factory timer active; service failed exit code 2.
  Prior evidence: `EPERM` on workspace chmod, `EXDEV` archiving,
  `ANOTHER_RECONCILE_IN_PROGRESS`. The old service was NOT disabled.
- `git ls-remote` confirms real remote Lukas Paff branch
  `d3275cfe7e43c4435325e4a8202fed609eb9c416`; remote tree contains
  `projects/lukas-paff-premium-v1`.
- Local Lukas Paff finish commit is
  `7c96ba65a2366a66dbc26cc63a9ba0bf912ba9a7`, not remote. Preserved.
- Candidate built at `/home/jarvis/auto-project-routing-v1`, branch
  `factory/jarvis-auto-project-routing-v1`.
- Candidate source unit tests: 17 PASS / 0 FAIL, including fail-closed paths
  and negative project-selection scenarios.
- No live JARVIS reload, no Claude execution, no GitHub push or Cloudflare deploy.
  Additional explicitly triggered paid API costs: none.

## User's 15-test acceptance matrix (REAL E2E, not unit-test substitutes)

| Test | Status | Evidence / reason |
|---|---|---|
| 01 Core reachable | PASS | Private socket GET 200 |
| 02 Actual project listing | FAIL | LUKAS_PAFF absent from revision 4 |
| 03 Live Lukas routing | FAIL | No live registered target |
| 04 GitHub SHA | PASS | Independent remote branch SHA and tree |
| 05 JARVIS workspace read | BLOCKED | Worker workspace inaccessible to current identity |
| 06 Cross-project OS isolation | BLOCKED | Cannot inspect/test restricted worker paths |
| 07 Real Claude binding for Lukas | BLOCKED | No registered live target and bridge proof |
| 08 Authorized Claude fixture write | BLOCKED | No verified project-bound Claude execution |
| 09 Live failure handling | BLOCKED | Local negative tests pass; live dispatch untested |
| 10 New project enrollment | FAIL | Existing factory service fails, candidate uninstalled |
| 11 Durable idempotency | BLOCKED | Only pure-function tests possible |
| 12 Restart persistence | BLOCKED | Restart requires separate explicit approval |
| 13 ChatGPT-to-JARVIS execution | BLOCKED | No live project route/MCP E2E |
| 14 Real production/other-project guard | BLOCKED | No mutations made, but OS negative tests unavailable |
| 15 Independent E2E acceptance | BLOCKED | No installed runtime/Claude evidence |

**Actual live matrix: 2 PASS, 3 FAIL, 10 BLOCKED. NOT 100%.**
The 17 local passing tests do not substitute for any blocked E2E step.

## Bounded permission/approval gate

1. Approve source reconciliation with the REAL, running JARVIS files under
   `/opt/jarvis/chatgpt-test` by authorized `jarvis-operator` identity.
   Make backups before any change. Do not use sudo bypasses.
2. Approve promotion/push of **only** reviewed adapter candidate commit on
   `factory/jarvis-auto-project-routing-v1`, if GitHub catalog is selected.
3. Approve precisely scoped operator runtime integration and one controlled
   `jarvis-remote-operator.service` restart with automatic rollback on failure.
4. Authorize a non-production, sandboxed Claude fixture test only if no new
   billing is incurred; otherwise obtain a separate explicit cost cap.
5. After all E2E criteria PASS, approve **only** the obsolete
   `jarvis-project-factory.timer` deactivation, with rollback.

Until then: leave all existing projects, Core, GitHub branches, Cloudflare
and factory service untouched. No real universal project binding is claimed.
