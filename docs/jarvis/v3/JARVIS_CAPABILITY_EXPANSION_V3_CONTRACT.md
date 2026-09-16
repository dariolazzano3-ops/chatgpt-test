# JARVIS_CAPABILITY_EXPANSION_V3 Contract + Constitution V3.1

Status: W11 operator-authorized constitution amendment. This document and
`src/jarvis/v3-constitution-v1.js` are the paired binding sources of truth.
They must agree. W11 performs no live connector activation or external effect.

Program ID: `JARVIS_CAPABILITY_EXPANSION_V3`

## 1. Objective

V3 turns the accepted private JARVIS orchestration core into a reliable personal
operator with versioned skills, structured owner-scoped memory, controlled
connectors, 24/7 execution, voice interaction and proactive operation.

The accepted V2 execution backbone remains authoritative: Program Controller,
Program Approval, Branch Manager, private Bridge execution, Independent
Acceptance, trusted local publication, restart recovery and Git truth.

## 2. Progress contract

The roadmap has 26 waves, W0-W25. Already accepted W0-W10 retain their original
5% weight each, so the independently verified Phase A baseline remains exactly
55%. W11-W25 each carry 3%. Total verified weight remains exactly 100%.

No elapsed time, worker self-report, run count or roadmap declaration counts as
progress. Only independently accepted audit evidence counts.

## 3. Roadmap

| Wave | Title | Phase | Weight |
|---|---|---|---:|
| W0 | V3 Contract + Constitution | Phase A | 5% |
| W1 | Skill Registry V1 | Phase A | 5% |
| W2 | Skill Runtime V1 | Phase A | 5% |
| W3 | Skill Permission Engine | Phase A | 5% |
| W4 | Memory Model V1 | Phase A | 5% |
| W5 | Memory Ingestion V1 | Phase A | 5% |
| W6 | Memory Retrieval + Context Compiler | Phase A | 5% |
| W7 | Memory Governance | Phase A | 5% |
| W8 | Connector Core V1 | Phase A | 5% |
| W9 | Connector Pack + Unified Action Plane | Phase A | 5% |
| W10 | 24/7 Readiness V1 | Phase A | 5% |
| W11 | Phase B Authorization + Constitution Amendment V3.1 | Human Gate | 3% |
| W12 | Connector Live Read Activation | Phase B | 3% |
| W13 | Connector Live Write Activation | Phase B | 3% |
| W14 | Scheduled Autonomous Cycles | Phase B | 3% |
| W15 | Cross-Skill Orchestration | Phase B | 3% |
| W16 | Personal Context Fusion | Phase B | 3% |
| W17 | Observability + Alerting | Phase B | 3% |
| W18 | Failure Matrix + Safety Hardening V3 | Phase B | 3% |
| W19 | Phase B Infrastructure Seal | Phase B | 3% |
| W20 | Voice Input | Phase C | 3% |
| W21 | Voice Output | Phase C | 3% |
| W22 | Realtime Voice Loop + Command Center UX | Phase C | 3% |
| W23 | Proactive Signal + Attention Engine | Phase C | 3% |
| W24 | Proactive Operator | Phase C | 3% |
| W25 | Autonomous E2E + Final Completion Seal | Phase C | 3% |

## 4. W11 Human Gate

W11 is a distinct operator action. It may be registered for evidence and
Independent Acceptance, but it is marked `operator_task_required: true` and the
Wave Task Planner must never auto-propose it. An operator-supplied task is the
only valid dispatch source.

W11 may amend only the V3 contract, constitution, program catalog, wave
registry/planner and their gate/bootstrap tests. It does not connect any real
account, call an external provider, perform an external write, change service
configuration, or activate Phase B runtime behavior.

W11 is considered cleared only when Wave 11 appears in `completed_waves` from a
real Independent Acceptance row. Merely editing this contract, registering the
wave, or receiving worker COMPLETE is not clearance.

W12-W25 are fixed roadmap labels at W11 time but remain unregistered tasks.
Their concrete goals, expected files and checks may only be authored after W11
has been independently accepted. Silence is correct until then.

## 5. Post-gate connector authority

The old blanket ban on all external calls and all account connections is
replaced by narrower fail-closed authority classes. This does not make network
or account access generally available.

Before W11 is independently accepted, the following post-gate capabilities are
not grantable:

- `OPERATOR_AUTHORIZED_EXTERNAL_READ`
- `OPERATOR_AUTHORIZED_ACCOUNT_CONNECTION`
- `APPROVAL_GATED_EXTERNAL_WRITE`

After the gate, only an OPERATOR may grant those capabilities. A worker, skill,
system component or connector can never self-grant them. Live credentials stay
server-side behind credential handles and may never be exposed to a worker or
returned to the user as secret output.

External writes remain approval-gated. A connected account or permitted read
does not imply write permission.

## 6. Permanent safety boundaries

The following remain forbidden across every wave, including after W11:

- no main/master mutation
- no merge, push or force push
- no deploy or production activation
- no public release
- no DNS or Cloudflare mutation
- no billing action
- no destructive database action
- no HAMYREN data flow
- no unapproved external network call
- no unapproved account connection
- no unapproved external write
- no worker secret access
- no secret output or credential exfiltration
- no self-granted permission

Production/Public/DNS/Cloudflare/Billing remain separate explicit human gates
outside this roadmap even if a later capability is otherwise complete.

## 7. Acceptance and trust boundaries

Claude remains an untrusted implementation worker restricted to the bounded
workspace and approved tools. It never commits, pushes, merges, deploys,
accesses secrets or decides its own acceptance.

Independent Acceptance must use real repo-bound evidence against the registered
wave allowlist and required checks. Trusted publication remains local-commit
only. Git and the durable audit remain the code/progress truth.

One Program Tick performs at most one mutating action. Repair remains bounded.
Unknown or ambiguous authority fails closed.

## 8. W11 acceptance surface

W11 may change only the files listed by its own registry entry. Required checks
must prove at minimum:

- 26-wave roadmap and 100% weighting
- accepted W0-W10 still equal exactly 55%
- accepted W11 would equal exactly 58%
- W11 cannot be auto-proposed by the planner
- W12-W25 are not yet registered
- post-gate capabilities fail closed before gate clearance
- permanent safety boundaries remain denied
- V2 final regression remains green

## Change history

- W0: initial 20-wave V3 contract and Phase A constitution.
- W11 / V3.1: operator-authorized expansion to W0-W25, preserves the verified
  55% baseline, adds controlled post-gate connector authority and retains all
  permanent safety boundaries. No live external activation occurs in W11.
