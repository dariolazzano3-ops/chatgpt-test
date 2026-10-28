# JARVIS Universal Project Adapter V1 | Staged technical decision (2026-10-28)

## Live truth

JARVIS status, runtime-truth and project-targets respond on the private owner socket.
Only AURENTARA and JARVIS_AUTONOMY_TEST are active project targets (revision 4).
The active worker runs as `jarvis-operator`, while Desktop Commander runs as `jarvis`.
The live service source is under `/opt/jarvis/chatgpt-test`, not writable by Desktop Commander.
The separate project-factory timer is running but its service repeatedly fails
(exit 2); prior records identify EPERM chmod, EXDEV rename, stale-lock incidents.
The factory has **not** registered LUKAS_PAFF. Do not clean old resources prematurely.
The Claude HTTP bridge is reported bound for existing use, NOT for Lukas Paff.
The remote Lukas Paff branch is d3275cfe7e43c4435325e4a8202fed609eb9c416.
The preserved local polish commit is 7c96ba65a2366a66dbc26cc63a9ba0bf912ba9a7.
Do not replace or push either.

## Architecture decision

**Reuse** the existing JARVIS route resolver, owner-control socket, Claude
Bridge, GitHub and restricted workspace lifecycle. Use one source-controlled
trusted project catalog loaded from an **independently verified immutable Git
commit** on an owner-approved branch. Never create a project from an untrusted
chat string. Do not maintain a second writable VPS registry, recurring
registration timer or per-project systemd unit.

This candidate provides:
- strict catalog schema, owner/repository, branch, subdirectory and SHA validation;
- deterministic project resolution via the existing JARVIS router;
- fail-closed discovery for unknown, ambiguous or overlapping project names;
- explicit distinction between catalog approval and verified worker readiness;
- server-side executable target composition only for separate verified workspace
  and Claude binding receipts (the boolean-shaped test fixtures are not real attestation);
- reproducible Node tests and independent read-only Git remote preflight.

**Not installed or production-ready:** this is a local source candidate.
Current runtime still uses the old registry; no bootstrap or service restart,
remote push, Cloudflare deploy, or project mutation was performed.

## Required integration for real E2E (only after specific approval)

1. Verify canonical runtime source/commit as `jarvis-operator` and reconcile
   local runtime changes before installing any module.
2. Commit catalog to a trusted owner-controlled GitHub branch, review authorizations,
   protect promotion, verify the source commit independent of chat input.
3. Wire verified catalog into existing owner-control project resolution. Do not
   inject catalog-only entries into the existing job dispatcher.
4. Reuse the worker's established isolation mechanism; create each project
   workspace only with approved repository+branch+SHA, with Git metadata and
   unrelated project folders inaccessible to the Claude worker. Verify with OS
   permission and negative access tests, not with JavaScript flags.
5. Bind each approved project to a *real* Claude bridge workspace and preflight.
   Never reuse a global default project binding when switching.
6. Test JARVIS-to-ChatGPT invocation and two-project isolation end-to-end.
7. Stop the failed Project Factory timer only after replacement is proven,
   with a backup and rollback. This action needs explicit systemd approval.

## Verification

```sh
cd /home/jarvis/auto-project-routing-v1
node --test scripts/universal-project-adapter-v1.test.mjs
node scripts/jarvis-universal-project-preflight-v1.mjs
```

Approval gate: restricted operator runtime deployment/restart + optionally catalog
push and legacy factory timer deactivation, each with exact files, backup, rollback.
No extra cost and no public deployment required. All real execution tests remain
BLOCKED until permissioned runtime integration; never report them PASS from a unit test.
