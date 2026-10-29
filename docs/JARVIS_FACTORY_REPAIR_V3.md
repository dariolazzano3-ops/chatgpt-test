# JARVIS Factory V3 | Scoped installer handoff

Date: 2026-10-29. Existing VPS only; no new infrastructure.

## What changed
- New project's clone root is created as private 0700 before Git operations.
- Files and directories are owned only by jarvis-operator; no shared jarvis-worker group grant.
- The registry entry is enrolled with enabled=false until project-specific OS isolation, Claude bridge and negative E2E tests pass.
- The existing rootless Factory onboarding logic is reused. No second live registry or runtime service is introduced.
- 20 local Node tests PASS including dormant registration; Python owner installer refuses non-root. No model calls or public deployments.

## One authenticated owner-console operation (not run by Desktop Commander)
- Review scripts/repair-project-factory-v3.py and its separately published hash.
- Root-copy into /root, verify SHA-256 of the copied file before executing.
- Installer enforces exact registry revision/target set, request repository/branch/commit, and pinned JS checksum. It stops only the broken factory timer/service, backs up installed code and registry, quarantines a verified partial Lukas checkout rather than deleting it, installs the tested rootless onboarding code, runs the service once, checks the resulting disabled Lukas registration and restrictive root permissions, then restores the timer.
- If the run fails, the prior code is restored and a compatible old registry snapshot is reinstated. Quarantined workspaces and root-owned backups are preserved for recovery; an unexpected concurrent registry change is never overwritten.

## Acceptance after the owner-console action
- Console must show FACTORY_REGISTRATION_PASS, LUKAS_PAFF_ENABLED=false and exact approved HEAD.
- Read report /home/jarvis/jrf-result.txt through Desktop Commander.
- Live /v1/project-targets must show AURENTARA and JARVIS_AUTONOMY_TEST unchanged, plus disabled LUKAS_PAFF.
- Production Core must remain active. Legacy timer must not be disabled permanently on a claim alone.
- Real chat-to-Claude project write remains BLOCKED until independently verified per-project mount/filesystem isolation and Claude binding. Catalog acceptance is not executable readiness.

## Safety
The root helper and JS source are owned by jarvis in the staging checkout; never execute either from that writable checkout with root privileges. Run only a root-owned, digest-verified copy of the Python installer. No global sudo unblock, no root daemon, no paid API fallback.
