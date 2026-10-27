# JARVIS Sprint 2: Active isolation and publisher gate (2026-10-27)

## Verified live facts (read-only)
- VPS v2202609413456515163 is online via Desktop Commander as Unix user `jarvis` (uid 1000).
- JARVIS private owner socket `/opt/jarvis/owner-deploy-queue/owner-control.sock` is accessible. `/v1/runtime-truth` reports `ok=true`, `read_only=true`, `production_deploy=false`, `command_dispatch_enabled=false`, `independent_acceptance=false`.
- Active service runs as `jarvis-operator`, working directory `/opt/jarvis/chatgpt-test` with directory permissions 0700. This user cannot inspect its active code or protected service environment.
- Active target registry `/opt/jarvis/owner-deploy-queue/project-targets.v1.json` is readable, owned by `jarvis-operator:jarvis` mode 0640, revision 3 dated 2026-09-28. It contains exactly one enabled target: `AURENTARA` pointing to `/opt/jarvis/aurentara-project`, branch `factory/aurentara-real-lifecycle-v1`. No disposable test target is registered.
- Older, non-authoritative development copy `/home/jarvis/owner-control-bridge-v1-latest/src/jarvis/accepted-work-publisher-v1.js` implements verified local commit, optional GitHub push, and optional *private JARVIS runtime installation*. The active publisher implementation/configuration could differ. It MUST be inspected by an authorized operator before any write mission.
- `/v1/runtime-truth` reports GIT adapter `ADAPTER_REQUIRED`, independent verification node unbound; read-only Claude job with independent reviewer PASS was previously evidenced, but no real autonomous write is proven.

## Exact blocker
The owner API cannot be trusted to select a disposable repository/branch or suppress private-runtime installation. Sending a write prompt might alter the protected core or the real AURENTARA project. No such prompt was sent.

## Required admin-only inspection (NO secrets in output)
1. From an existing authorized root/operator session, inspect the *active* target-registry loader, owner-chat project resolver, publisher and private-deploy enablement/configuration, and the actual effective service environment. Never dump tokens, full environment files or secrets.
2. Determine whether a dedicated disposable target can be registered with `repo_dir` pointing outside the protected core and all production project roots, with a dedicated `factory/` branch and bounded allowlisted file scope.
3. Verify *effective* owner-chat publisher behavior: GitHub push only to the disposable branch, and **private runtime install explicitly disabled** for this target. If the global publisher cannot scope runtime install per target, do not enable write tests. Implement and verify a target-specific deny gate in isolated development first; activation requires explicit separate approval.
4. Confirm the owner-chat route resolves this target from a typed identifier rather than natural-language guessing; fail closed on missing/mismatched project.
5. After approved configuration changes and safe reload, test target resolution with read-only calls; inspect resulting audit. Only then authorize one real Claude Code IMPLEMENT write on the disposable fixture. Independently verify file diff, tests, reviewer PASS, and a JARVIS-generated commit/push. No human/ChatGPT code edit counts as autonomous success.

## Acceptance and safety
- No sudo bypass, Docker socket permission change, root shell automation, production website changes, DNS or paid fallback.
- Do not weaken review/approval gates or change active JARVIS service without explicit owner approval and rollback.
- No claim of 100% readiness until a complete live write and independent acceptance are proven.
- Sprint 2 audit was read-only. No live code, service, target registry, publisher, or deployment was changed.
