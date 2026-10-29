# JARVIS Universal Adapter | Live integration gates (2026-10-29)

## Verified this session
- Desktop Commander VPS online as unprivileged `jarvis`; root bootstrap output `READ_GATE_READY` was provided by the owner.
- Root-generated read-only export is present: private review under `/var/tmp/jarvis-maintenance-review-d3a6lcpe`; source snapshot HEAD `220e3012798e04578964d61506fc33ec8c2fa1d5`, clean tree at export.
- Active JARVIS Core still runs as `jarvis-operator`; no runtime files were modified.
- Project registry revision 4 has exactly AURENTARA and JARVIS_AUTONOMY_TEST; LUKAS_PAFF is absent.
- Lukas GitHub branch: `d3275cfe7e43c4435325e4a8202fed609eb9c416`; committed catalog matches. Preserved local polish revision `7c96ba65a2366a66dbc26cc63a9ba0bf912ba9a7` must NOT be overwritten.
- Adapter branch safely fast-forward-pushed to remote. Unit suite 18/18 PASS; read-gate suite 9/9 PASS.
- Existing Project Factory service remains failed (exit 2), timer active; prior repair evidence identifies EPERM chmod, EXDEV queue move and stale locks. No timer changes were made.
- Staged factory revision with EXDEV-safe archive and permission fix was copied into this branch with regression tests: 19/19 PASS. This is source control only, NOT live installation.

## Blockers before claiming 100%
1. Rootless factory changes are not installed in `/opt/jarvis/project-factory/onboard.mjs`. A legitimately authorized privileged deployment, rollback and service health proof are required.
2. Live LUKAS_PAFF registration, exact-checkout, workspace ownership and integrity are not verified. Do not register an executable target without passing all prerequisites.
3. Existing factory workspace permissions use shared `jarvis-worker` group for project directories. Those modes alone do not prove cross-project read isolation. Require independent OS negative tests and a per-project filesystem/mount boundary before Claude access.
4. Catalog-only approval must not imply executable Claude binding. A real project-specific bridge, persisted restart, ChatGPT request, actual non-production fixture modification, independent commit/test evidence and negative routing tests are outstanding.
5. Any Claude/API usage that incurs additional charges requires a separately authorized cost cap. No paid job was triggered here.

## Guardrails
Keep existing AURENTARA and autonomy test targets, protected previews, Git branches and paid systems unchanged. No global sudo unblock, no guessed project readiness, no forced remote update, no cloud deployment. Disabling the broken legacy timer is gated on a verified replacement, not merely a green unit suite.
