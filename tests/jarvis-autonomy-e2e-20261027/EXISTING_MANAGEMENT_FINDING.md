# Existing management discovery

2026-10-27. Supersedes the assumption that no project-management control path exists.

- Live authenticated GET /v1/project-targets via existing owner-control Unix socket succeeds. Registry revision 3, AURENTARA only.
- Live /v1/status reports automatic_project_target_status.registry_revision=3 and registry_errors={}.
- Readable source in /home/jarvis/auto-project-target-autodiscovery-v1 contains project-target-registry-v1.js and an owner socket POST /v1/project-targets/apply route. Its runtime code loads registered projects and binds per-target Claude bridge projects. POST mutation has NOT been exercised on the live service.
- That local validator only accepts /opt/jarvis/ project paths. Current disposable project /home/jarvis/jarvis-autonomy-e2e-20261027 is outside that scope. Do not widen path policy or use symlinks to bypass it; provision a proper isolated target in the approved scope after administrator inspection.
- Existing registry smoke test PASS; temporary registry only, not production mutation.
- Active source remains protected. Local sources are clues, not attestation of exact live code. Active publisher isolation, worker mount mapping, approved-path workspace provisioning and branch-specific publication remain unverified.

Decision: reuse the existing registry and owner-control APIs. No duplicate management service, new infrastructure, broad root access or speculative core patch. The previous statement that an entirely new management interface is needed was too broad.

Prepared read-only administrator inspection now includes project-target-registry source routing lines/hashes and JARVIS_BRIDGE_PROJECT (the actual environment key used by the inspected resolver). Python syntax checked. This supersedes the script checksum in READINESS_CHECKPOINT.md; no admin execution or runtime activation yet.

Required one-time handoff, in existing authorized root console:
python3 /home/jarvis/jarvis-sprint2-preflight/admin-readonly-inspect.py

Return output for exact active-source reconciliation before preparing the installation/registration change. Current Unix jarvis has no approved access to protected source/settings or Claude workspace provisioning. No service restarts, permission changes, registry edits, production changes or autonomous code-write claims in this step.
