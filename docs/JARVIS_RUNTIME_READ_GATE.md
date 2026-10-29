# JARVIS bounded maintenance access — phase 1

2026-10-29. Owner authorized preparation of a limited permanent maintenance path.

## Implemented, not installed yet

`scripts/setup-runtime-read-gate.py` is a one-time owner-console bootstrap.
Run using `/usr/bin/python3 -I` from an authenticated root console. No agent
sudo retry, queue, daemon, alternate privileged execution transport, runtime
permission relaxation, production modification, model call or restart occurs.
The platform's command policy remains independent of OS sudo authorization.

Creates root-owned `/usr/local/bin/jarvis-runtime-read` and
`/etc/sudoers.d/jarvis-runtime-read`. Only exact `status` and `source` commands
are allowed as `jarvis-operator`, never root. The helper rejects extra arguments,
uses fixed subprocess argument arrays and a minimal environment, and archives
only committed `src`, `scripts`, and `package.json` from the runtime. A dirty
runtime blocks export. Existing conflicting helper/policy files are not replaced.
Existing sudo permissions are not broadened or removed elsewhere.

The bootstrap validates sudoers before and after, checks the exact command as
jarvis, exports runtime sources and copies the two fixed root-owned maintenance
programs into a private review directory. New policy/helper files are removed on
activation/smoke failure. Existing runtime ownership and permissions are untouched.
Console success marker: `READ_GATE_READY`; review path: `REVIEW_DIR=...`.

## Verification

`python3 -B scripts/test-runtime-read-gate.py`: 9 tests PASS.
Tests cover argument rejection, identity, fixed read commands, dirty-tree refusal,
commit-pinned export paths, environment isolation, no-overwrite atomic creation,
non-root bootstrap rejection and exact restricted sudo command policy.
Syntax compilation and git diff --check PASS.
Root installation, real sudoers validation and Desktop Commander invocation:
BLOCKED pending owner-console execution; not replaced by mocked unit tests.

## Remaining install gate

The existing maintenance wrapper is readable; its privileged worker is not.
Do not grant install/restart through this bootstrap. Inspect exported worker and
runtime first, then prepare the reviewed bounded deployment extension with
backup, verified expected HEAD, scoped patch, health checks and rollback.
No claim that this first stage completes the universal adapter.

## Owner rollback

Only the two newly introduced files belong to this access feature. From an
authenticated root console remove `/etc/sudoers.d/jarvis-runtime-read` first,
then `/usr/local/bin/jarvis-runtime-read`, and validate using `visudo -c`.
This revokes this feature without modifying the runtime or existing maintenance
configuration. Review exports are private to jarvis and can be removed after use.
