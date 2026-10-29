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
| 12 Restart persistence | BLOCKED | Approved by owner, but not executable through the connected identity/tool policy |
| 13 ChatGPT-to-JARVIS execution | BLOCKED | No live project route/MCP E2E |
| 14 Real production/other-project guard | BLOCKED | No mutations made, but OS negative tests unavailable |
| 15 Independent E2E acceptance | BLOCKED | No installed runtime/Claude evidence |

**Actual live matrix: 2 PASS, 3 FAIL, 10 BLOCKED. NOT 100%.**
The 17 local passing tests do not substitute for any blocked E2E step.

## Follow-up after owner approval (2026-10-28, same session)

The owner approved the previous bounded steps in chat. Their consent does not
change the currently connected OS identity or the platform's tool allowlist.
A read-only probe confirmed 2/5 limited preconditions PASS, 3/5 BLOCKED
(core online and general Claude bridge bound; Lukas route, readable runtime
code, and project-specific Claude E2E unavailable).
An attempted `sudo -n -l` via Desktop Commander was refused by the
tool's command allowlist. An attempted direct `git push` was rejected by
the platform security checks; it was not retried through an alternate route.
`git push --dry-run` had confirmed the adapter branch was a fast-forward
candidate, but a dry run is **not** a remote push.
The approved candidate remains local and committed, not installed/published.
The new read-only live-acceptance script is
`scripts/jarvis-universal-live-acceptance-v1.mjs`.
No changed customer project files, systemd units, active JARVIS runtime,
factory timer, Claude worker jobs, GitHub refs, or Cloudflare deployments.
Requires a separately authenticated, legitimately privileged operator
connection and a permitted GitHub publishing path before proceeding.

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


## Work continuation V2 — fresh evidence 2026-10-29

- Starting local HEAD independently read: `8c23edee1a2235fc0bf9afef47b1473b5e1e014b`; working tree clean before this change.
- GitHub connector and on-host preflight both confirm adapter remote HEAD still `edae347260c65778a0470262a6d32a3f6cbbf565`.
- Live service active/running as jarvis-operator; connected identity jarvis.
  Runtime directory remains mode 0700, owned by jarvis-operator.
- Registry still revision 4, with AURENTARA and JARVIS_AUTONOMY_TEST only.
- Read-only Git preflight confirms remote Lukas HEAD `d3275cfe7e43c4435325e4a8202fed609eb9c416`, project directory present, local reference HEAD `7c96ba65a2366a66dbc26cc63a9ba0bf912ba9a7` preserved.
- General Claude bridge bound; project-specific execution not demonstrated.
- Factory service still failed (exit 2). No cleanup or timer changes performed.

### Implemented repair

Reproduced a mutable nested array in the validated catalog: adding an alias
AFTER verification changed the selected route. Freeze the copied route_aliases
array. Regression test covers source-array mutation, push and replacement after
verification, rejected injected aliases, and preserved authorized routing.
18/18 candidate unit tests PASS; git diff --check PASS.
This is a local candidate repair, not runtime integration or OS isolation proof.

### Regular deployment path inspected, not executed

The readable /usr/local/sbin/jarvis-maintenance wrapper provides install/restart/status,
with branch checks and health rollback. Its privileged worker is inaccessible.
The staged owner-private-deploy watcher invokes this helper through sudo;
no corresponding system service or timer was found in the current jarvis unit inventory.
No privileged action or queue submission was attempted. The previous sudo/push
denials were not retried through alternate execution mechanisms.
Runtime reconciliation is mandatory: the staged owner socket source lacks the
project-targets endpoint that demonstrably exists live. Replacing the runtime
from this checkout without reading live changes could regress existing behavior.

### Current real E2E matrix

| Criterion | Status | Fresh evidence / remaining gate |
|---|---|---|
| Core reachable | PASS | active/running; private live probe PASS |
| Actual project listing includes Lukas | FAIL | revision 4 lacks LUKAS_PAFF |
| Live Lukas routing | FAIL | no registered target |
| GitHub SHA and project tree | PASS | read-only remote preflight |
| JARVIS workspace read | BLOCKED | inaccessible operator runtime |
| Cross-project OS isolation | BLOCKED | no accessible project-bound sandbox |
| Real Claude binding for Lukas | BLOCKED | no live target |
| Authorized Claude fixture write | BLOCKED | integration and no-new-cost execution unverified |
| Live failure handling | BLOCKED | candidate unit tests are not live evidence |
| New project enrollment | FAIL | factory exit 2; candidate uninstalled |
| Durable idempotency | BLOCKED | runtime integration unavailable |
| Restart persistence | BLOCKED | privileged runtime access unavailable |
| ChatGPT-to-Lukas execution | BLOCKED | no registered project-bound execution |
| Production/other-project guard | BLOCKED | no independent OS negative tests |
| Independent E2E acceptance | BLOCKED | prerequisites missing |

Total: 2 PASS / 3 FAIL / 10 BLOCKED. Additional local validation: 18 tests PASS.
No paid model job, API fallback, push, deployment, runtime change or restart was
triggered in this continuation. Incremental model-job spend triggered: zero;
provider billing totals are not independently available here.

Smallest next prerequisite: a legitimately authenticated operator/administrator
connection able to read and back up the live runtime and use its bounded
maintenance path. Another chat GO does not supply missing OS/tool capabilities.
Before install, reconcile against actual live HEAD and dirty files; prepare a
reviewable scoped patch and backup/rollback. Keep preserved Lukas local HEAD,
legacy timer and all existing projects untouched until replacement acceptance.
