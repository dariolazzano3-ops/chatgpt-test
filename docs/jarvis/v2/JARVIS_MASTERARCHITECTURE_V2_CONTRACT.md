# JARVIS_MASTERARCHITECTURE_V2 — Masterarchitecture Contract

Status: Wave 0 — contract, not implementation. This document is the binding
reference every later V2 wave is built and reviewed against. Where V2 code
disagrees with this contract, the code is wrong until this document is
amended.

Program ID: `JARVIS_MASTERARCHITECTURE_V2`

## 1. V2 scope

V2 closes the last gap in the accepted V1 baseline: a human still has to sit
between every step of a multi-wave engineering program — clicking approve per
mission, watching for completion, deciding when to retry, and manually
advancing to the next wave. V2's scope is narrowly the **orchestration layer**
that removes that manual glue, without changing what is structurally allowed
to happen to the repository:

- drive a named, multi-wave program (`JARVIS_MASTERARCHITECTURE_V2` itself,
  and any future named program) through PLAN → PREPARE → EXECUTE → VERIFY →
  REPAIR → ACCEPT → UPDATE PROGRESS → NEXT WAVE automatically, one tick at a
  time (see §7);
- reuse the accepted V1 primitives as-is — this program does not re-implement
  branch preparation, dispatch, verification, or acceptance; it only decides
  *when* to call them;
- keep every mutating action bounded, auditable, and revocable by an operator
  at any point;
- keep progress truthful: `verified_progress_percent` only ever reflects
  independently-accepted, bridge-verified work, never a worker's self-report,
  elapsed time, or run count.

Explicitly **out of scope** for V2: committing, pushing, merging, deploying,
touching `main`/`master`, granting itself approval, running Bash or reaching
the network from inside a dispatched worker, and any HAMYREN/production data
flow. These remain structurally impossible, not merely policy — see §9 and
§6.

## 2. Accepted V1 baseline

V2 is built entirely on top of an already-accepted V1 baseline. V2 waves may
extend these primitives; they may not weaken, bypass, or duplicate their
guarantees with a parallel, looser path. The accepted baseline is:

- **V1 Live Binding** — the Command Center's operational surfaces are bound to
  real, bridge-computed runtime truth. No value may imply real system state
  when it is mock, demo, static, stale, or unproven; unavailable sources
  render as explicitly unavailable rather than a fabricated healthy state.
- **The repo-bound Engineering Worker**
  (`claude-code-repo-bound-executor-v1.js`) — a bounded, opt-in Claude Code
  session scoped to a real repository directory, restricted to
  `Read,Write,Edit,Glob,Grep`, with git-branch re-checked on every call and
  protected branches (`main`, `master`) refused outright.
- **Independent Acceptance**
  (`engineering-mission-acceptance-v1.js`) — a distinct, explicit operator (or
  operator-authorized) action that requires real, bridge-computed verification
  evidence before a wave can count toward progress. A worker's own completion
  report is never sufficient on its own.
- **The Program Controller / Branch Manager / Program Approval** trio
  (`program-controller-v1.js`, `branch-manager-v1.js`,
  `program-approval-v1.js`) — safe, git-truth-driven branch preparation; a
  scoped, revocable, per-program operator approval that authorizes a bounded
  set of actions without a fresh per-mission click; and a pure state-machine
  that derives each wave's canonical state from the durable audit trail, never
  from a separate mutable table of its own.

V2 does not re-derive or re-justify any of the above. Any V2 design that would
require loosening one of these guarantees to work is out of scope and must be
rejected, not worked around.

## 3. Target architecture

```
 Operator
   │  (Program Approval grant/revoke; wave task text when not mechanically derivable)
   ▼
 Program Controller (program-controller-v1.js)
   │  tick(): reads durable audit trail -> derives ONE wave state -> performs
   │          AT MOST ONE mutating action -> re-reads state -> returns
   ├──▶ Branch Manager        (branch truth + safe branch preparation)
   ├──▶ Program Approval      (scope check: is this action covered?)
   ├──▶ Engineering Mission   (dispatch a bounded Claude Code worker)
   ├──▶ Engineering Mission Resume (authorize + resume a queued dispatch)
   ├──▶ Engineering Mission Acceptance (verify evidence -> Independent Acceptance)
   └──▶ V2 Progress projection (recompute verified_progress_percent)
   ▼
 Durable Audit Trail (owner-scoped store)
   ▲  (single source of truth; every component reads it fresh, nothing is cached)
   │
 Command Center Read Bindings ── renders wave/program state to the operator
```

There is no new mutable "program state" table. Every component — including
the Program Controller itself — derives its answer by re-reading the same
audit trail that already backs runs, approvals, and acceptance. This mirrors
the pattern already established by `v2-progress-v1.js`.

## 4. Component boundaries

| Component | Owns | Does NOT own |
|---|---|---|
| Program Controller | deciding the next single action for one wave; sequencing PLAN→…→NEXT WAVE | branch mutation, dispatch execution, verification, or approval logic — it only calls the modules that own those |
| Branch Manager | branch truth inspection; safe create/fast-forward/checkout of the target branch | commits, pushes, merges, or touching `main`/`master` |
| Program Approval | scope-checked, revocable, per-program operator authorization | granting itself; authorizing anything on the fixed denylist (main/master, merge, deploy, production, DNS, Cloudflare mutation, billing, secrets, public release, destructive DB, HAMYREN, force push) |
| Engineering Worker (repo-bound executor) | making real file edits inside the bounded repo/branch | committing, pushing, merging, deploying, running shell commands, reaching the network |
| Independent Acceptance | evaluating bridge-computed verification evidence and recording a distinct operator acceptance | trusting worker self-report; auto-accepting on dispatch completion |
| V2 Progress projection | computing `verified_progress_percent` from accepted, evidenced waves only | inferring progress from time, run count, or chat activity |
| Command Center Read Bindings | rendering derived state read-only | mutating anything |

Each component is independently callable and independently auditable; the
Program Controller composes them, it does not absorb their responsibilities.

## 5. Trust boundaries

- **Trusted, privileged code**: the Program Controller, Branch Manager,
  bridge/executor wrapper, and Acceptance module all run as this codebase's
  own trusted code. They issue `git`/`node --check` themselves and read the
  audit trail directly.
- **Untrusted, sandboxed code**: the nested Claude Code worker process. It
  receives a task description and a restricted tool allowlist; nothing it
  outputs (exit code, stdout, self-described "I completed the task") is
  treated as evidence. It never sees the audit trail, the approval state, or
  any credential.
- **The operator**: the only actor who can grant or revoke a Program
  Approval, supply a wave's initial task text when none can be mechanically
  derived, or independently accept a completed wave's evidence. The
  controller never promotes itself to this role.
- **The boundary is enforced twice**: once by tool allowlisting (the worker
  structurally has no Bash/network tool to escape with) and once again by
  git-state (nothing is ever committed, so even a hypothetical escape cannot
  reach `main` without a second, human, explicit step). Neither boundary
  substitutes for the other.

## 6. Worker contract

The repo-bound Claude Code worker (`claude-code-repo-bound-executor-v1.js`)
is the only component in V2 permitted to modify real files in the real
repository, and it is bound as follows, enforced in code rather than by
prompting the model to behave:

- `repo_dir` must be an absolute path containing a `.git` directory, checked
  at construction **and fresh on every single call** — never assumed to still
  hold from an earlier check.
- The current branch is read fresh every call via `git`, run by trusted code,
  never by the worker itself. Execution is refused outright if that branch is
  `main`/`master`, or does not match an optional pinned `expected_branch`.
- Tool allowlist is exactly `Read, Write, Edit, Glob, Grep`. No `Bash`, no
  `WebFetch`/`WebSearch`, no `NotebookEdit`, no MCP servers
  (`--strict-mcp-config`). This is not a rule the worker is asked to follow —
  it is a capability it structurally does not have.
- `--permission-mode acceptEdits`, `--permission-prompts none` (anything a
  mode doesn't decide is denied, never escalated), `--no-session-persistence`,
  a bounded `--max-budget-usd`, and a hard bridge-side timeout/kill on top of
  all of the above.
- **The worker never commits, never pushes, never merges, never deploys.**
  Every file change it makes lands as an ordinary uncommitted working-tree
  change. Deciding what happens to that diff (commit it, discard it, hand it
  to a human reviewer) is always a separate, explicit, later step outside the
  worker's own execution — independent of the tool allowlist above (defense
  in depth, not either/or).
- The worker cannot reach the network under any circumstance: it is never
  given a tool capable of an outbound request.
- What actually changed, and whether it is still valid, is computed by the
  bridge-side code that invoked the worker (`git status --porcelain` and
  `node --check`, before/after the run) — never self-reported, and never
  trusted from the worker's own output even if it tries to claim it. This
  computed evidence is what §8/§9 and Independent Acceptance require.

## 7. Orchestration contract

The Program Controller drives each wave through a fixed tick model:

```
PLAN -> PREPARE -> EXECUTE -> VERIFY -> REPAIR -> ACCEPT -> UPDATE PROGRESS -> NEXT WAVE
```

Concretely, per wave, canonical states are:
`PENDING, PREPARING, EXECUTING, VERIFYING, REPAIRING, ACCEPTING, ACCEPTED,
BLOCKED_OPERATOR, FAILED`.

Rules that make this safe to run unattended:

- **State is derived, not stored.** The controller holds no mutable
  state table of its own. Every tick re-reads the durable audit trail (runs,
  approvals, acceptance records) and re-derives the current wave's state from
  scratch, the same pattern `v2-progress-v1.js` already uses for progress.
- **One tick == at most one mutating action.** A tick either prepares the
  branch, proposes a wave task, authorizes-and-resumes a dispatch, resumes an
  already-approved dispatch, verifies-and-accepts a completed dispatch,
  analyzes for repair, or does nothing (`WAIT` / `NONE`) — never more than one
  of these per call. Autonomy comes from calling tick repeatedly (a timer, a
  script, or an operator), not from looping internally, so every step stays
  independently observable and auditable.
- **Dispatch and acceptance both require Program Approval coverage.** A wave
  never advances past `PENDING`/`EXECUTING` into a real dispatch, and never
  reaches `ACCEPTING`, unless a real, persisted Program Approval already
  covers this exact program + repo_dir + target_branch + capability. The
  controller never grants that approval itself.
- **No fabricated task text.** If a wave has never been given a task, the
  controller reports `PENDING` / `AWAITING_OPERATOR_SUPPLIED_WAVE_TASK` and
  performs no action rather than inventing what the wave should contain.
- **Advancement to the next wave is itself just another derived, auditable
  action** (`ADVANCE_TO_NEXT_WAVE`), gated on the current wave already being
  `ACCEPTED` — never on elapsed time or a run merely finishing.

## 8. Evidence contract

Nothing in V2 accepts a worker's self-report as proof of anything. Every
piece of "did this actually happen" evidence is computed by trusted,
bridge-side code, never by the dispatched worker:

- **Branch truth** — the actual current git branch, working-tree cleanliness,
  and target-branch existence/divergence, read fresh via `git` on every call
  (`branch-manager-v1.js`). A stale or unavailable read fails closed to
  unknown/unsafe; it is never assumed clean or safe by default.
- **Real file diff** — `git status --porcelain` snapshotted before and after
  the worker runs; only paths that became dirty *during* this run count as
  "files changed" (a path already dirty beforehand is conservatively excluded
  even if the worker touched it further).
- **Syntax check** — every changed `.js`/`.mjs` file is run through
  `node --check` by trusted code after the worker exits; a deleted/missing
  file is skipped, not counted as a failure; anything else that fails to
  parse fails the check.
- **Branch drift detection** — if the branch after the run differs from the
  branch before it (or cannot be read), the run's external effect is
  withheld entirely, treated as an anomaly rather than trusted output.
- This bundle (`schema: aurentara.jarvis.repo-bound-verification.v1`) is the
  only admissible evidence for accepting work through a **live repo-bound
  dispatch**. A dispatch with no verification (e.g. a disposable-tmp-workspace
  run instead of a repo-bound one) can never be accepted through this path, by
  construction. Acceptance additionally requires the branch not to be
  protected, at least one real file changed, and the syntax check to have
  passed — and remains a distinct, explicit operator action even when all of
  that evidence is present; a completed dispatch never self-promotes to
  accepted.
- A second, equally strict evidence type exists for engineering work that was
  implemented and committed BEFORE a live dispatch could ever observe it as a
  working-tree diff (a live dispatch's `git status` diff is structurally blind
  to work already committed prior to it) — **commit-range evidence**
  (`schema: aurentara.jarvis.commit-range-verification.v1`,
  `commit-range-evidence-v1.js`). Independently, in trusted code, it requires:
  the named commit is real and reachable from the target branch's current HEAD
  (`git merge-base --is-ancestor`); it has exactly one parent (a merge commit
  is refused, never guessed); its own diff from that parent is non-empty (an
  empty/no-op commit is never admissible); every changed path is inside the
  wave's fixed `expected_files`; no added diff line matches a forbidden
  external-effect pattern, scanned per non-generated file — a path the wave
  explicitly lists in `generated_files` (a build artifact mechanically
  regenerated from a source file that IS scanned, e.g. a minified UI bundle)
  is exempt from this content scan only, never from the `expected_files` /
  non-empty-diff checks above; the branch is exactly the wave's own
  `target_branch`, unprotected, with a clean tracked working tree (reuses
  `branch-manager-v1.js`'s `evaluateJarvisBranchTruthV1`); and the wave's own
  `required_checks` (real commands, e.g. its own smoke tests) are executed
  here, for real, right now — never trusted from a claim. `expected_files`,
  `required_checks`, and `generated_files` are fixed per wave in
  `wave-registry-v1.js`, never a parameter the caller of the acceptance path
  (`commit-range-acceptance-v1.js`) can supply. Like the live-dispatch path,
  acceptance through commit-range evidence remains a distinct, explicit
  operator (or operator-authorized) action, and is still gated on a real,
  persisted Program Approval covering ACCEPTANCE for the exact program +
  repo_dir + target_branch — this module never grants that approval itself.

## 9. Recovery contract

Repair exists to unblock a failed wave without ever inventing new scope:

- **Bounded attempts.** A wave may be retried at most
  `JARVIS_PROGRAM_MAX_REPAIR_ATTEMPTS` (3) times. Once that bound is reached,
  the wave state becomes `BLOCKED_OPERATOR` with reason
  `MAX_REPAIR_ATTEMPTS_EXCEEDED` and no further automatic action is taken.
- **Mechanically-derived repair tasks only.** When a dispatch fails, the
  controller first attempts to derive a repair task purely mechanically —
  from the real, already-persisted `node --check` failure output of the
  failed attempt (file + error text), never from invented judgment about what
  the wave should have contained. If no mechanical repair is derivable and no
  operator-supplied task exists either, the controller performs no action and
  waits, rather than guessing.
  Repair dispatch is itself still gated on Program Approval coverage like any
  other dispatch.
- **`BLOCKED_OPERATOR` is the universal fail-closed state.** Any condition the
  controller cannot safely resolve on its own — a protected target branch, a
  dirty working tree, branch truth marked unsafe, a dispatch not covered by
  Program Approval, an unrecognized run status, or repair attempts exhausted
  — resolves to `BLOCKED_OPERATOR` with a specific machine-readable `reason`,
  and `next_action: null`. The program only proceeds again once an operator
  intervenes (approves, cleans the working tree, supplies a task, or revokes
  and re-plans) — never by the controller quietly retrying past the bound or
  reinterpreting the block away.

## 10. Safety constitution

These are hard constraints on the entire V2 program. No component, wave, or
operator-approved scope may cross them; a design that requires crossing one of
these is out of scope and must be rejected, not worked around:

- No deploy.
- No merge.
- No `main`/`master` changes.
- No production activation.
- No DNS changes.
- No billing changes.
- No secret output.
- No HAMYREN data flow.
- No destructive DB actions.
- No force push.
- No public release.

## 11. Wave 0-12 acceptance model

Each wave carries a fixed, canonical progress weight. `verified_progress_percent`
is the sum of the weights of waves that are `ACCEPTED`, and only that — never
a worker's self-report, elapsed time, or run count.

| Wave | Weight |
|---|---|
| Wave 0 | 5% |
| Wave 1 | 10% |
| Wave 2 | 10% |
| Wave 3 | 10% |
| Wave 4 | 10% |
| Wave 5 | 10% |
| Wave 6 | 8% |
| Wave 7 | 8% |
| Wave 8 | 10% |
| Wave 9 | 5% |
| Wave 10 | 6% |
| Wave 11 | 4% |
| Wave 12 | 4% |
| **Total** | **100%** |

A wave only counts toward `verified_progress_percent` once it is **COMPLETE**,
**independently verified** (per §8's evidence contract), and **independently
accepted** (per §2's Independent Acceptance and §7's ACCEPT step) — never on a
worker's self-report of completion, never on a dispatch merely finishing or
exiting cleanly, and never on elapsed time or run count.

## Change history

- Initial draft covering sections 1-9 (V2 scope through recovery contract).
- Follow-up pass adding section 10 (safety constitution) and section 11
  (Wave 0-12 acceptance model).
- §8 amended to document commit-range evidence (`commit-range-evidence-v1.js`
  / `commit-range-acceptance-v1.js`) as a second, equally strict, explicitly
  admissible evidence type — for engineering work implemented and committed
  before a live repo-bound dispatch could ever observe it as a working-tree
  diff, which the live-dispatch evidence type is structurally blind to. Code
  using this path (Wave 1's and Wave 2's real, persisted acceptance) predated
  this amendment; this pass brings the contract text into agreement with that
  already-reviewed, already-in-use mechanism rather than leaving §8's prior
  "only admissible evidence" wording contradicted by it. No change to the
  live-dispatch evidence type, Program Approval, budget limits, or the
  repair-attempt bound.
