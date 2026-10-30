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

## 2026-10-30: independently verified post-installation

- Root bootstrap console reported `FACTORY_REGISTRATION_PASS`, `LUKAS_PAFF_ENABLED=false`, approved HEAD `d3275cfe7e43c4435325e4a8202fed609eb9c416`. Owner report `/home/jarvis/jrf-result.txt` independently confirms `registration_pass:true`, no paid Claude job and no Core restart.
- Private socket GET `/v1/project-targets`: revision 5, original AURENTARA and JARVIS_AUTONOMY_TEST still enabled, LUKAS_PAFF registered but disabled.
- Factory timer active and recurring factory service executions now exit 0 (oneshot inactive/success is expected).
- `jarvis` user cannot read or traverse new Lukas workspace; stronger independent negative access tests with the actual Claude worker and other projects remain BLOCKED.
- Core runtime status still reports cached registry revision 4 even though source registry revision 5. Do not treat registered as executable. A controlled Core refresh is necessary, but not sufficient; no restart was performed.
- General Claude bridge bound is not proof of a Lukas-specific Claude worker binding or E2E. No real Claude fixture write or model job was submitted.
- Staged router now excludes `enabled:false` from project selection (smoke PASS). Staged adapter supports safely matching an existing dormant registry entry against immutable catalog/attestation; 19/19 adapter tests PASS.
- New read-only acceptance probe: 8 PASS / 4 BLOCKED. Two blockers are operational (cache refresh and direct source access); export already supplies bounded source visibility. Two are functional/security-critical (real per-project Claude isolation and E2E). This is not a percent-complete measure.

No public deployment, other-project mutation, model fallback, or production Core installation was triggered by these checks.

## 2026-10-30 10:48 UTC: V5 continuation and maintenance gate

- Reconfirmed VPS identity via Desktop Commander; effective user is jarvis (uid 1000).
- Adapter working tree was clean at 61f5016883cbf79b336bd20127287770b1bf20d8.
- Re-ran factory onboard/archive and universal adapter suites: 39 tests passed, zero failures.
- Read-only live acceptance: 8 PASS / 4 BLOCKED. Sandbox and Claude E2E checks are explicit outstanding-evidence placeholders, not executed negative worker tests.
- Core remains online with cached registry revision 4; disk/socket registry is revision 5 with LUKAS_PAFF disabled. Existing targets remain enabled.
- Inspected installed maintenance wrapper: restart requires runtime branch factory/jarvis-capability-expansion-v3 and a clean tree. Restart performs a health check but has no automatic rollback; install has its own rollback. Neither was executed.
- The Desktop Commander tool rejected the attempted sudo maintenance status command with `Command not allowed` (INVALID_ARGUMENT). No obfuscated invocation, alternate privilege mechanism, restart queue, or rights expansion was attempted.
- Runtime service retains ProtectSystem=strict. Its multiple project write paths are not evidence of individual Claude project isolation.
- Readable bridge source chooses a cwd below ROOT and checks path containment; this alone cannot establish an OS filesystem isolation boundary. Whether that source is the running bridge version is unverified.
- No runtime changes, target activation, paid model requests, pushes, or deployments occurred.

### Exact next prerequisite
Run the existing read-only maintenance status interface in an authorized owner console:

```sh
sudo /usr/local/sbin/jarvis-maintenance status
```

Review its branch, HEAD, dirty-line count and health result before preparing a controlled restart with a viable rollback. This command grants no new rights and does not restart the service. Project sandbox configuration and real worker negative tests remain required before activation; a model run still requires fresh explicit cost approval.
