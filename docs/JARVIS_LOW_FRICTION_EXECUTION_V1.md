# JARVIS | Low-friction execution policy V1 (2026-10-30)

**Goal:** routine owner-approved project work starts from chat without repeating VPS/root/sudo steps. Reuse the existing project factory, owner-control socket, GitHub repository, maintenance helper and Claude Bridge. Do not create a second registry or privileged agent.

## Decision: eliminate unnecessary approval friction

For a project already approved in the immutable catalog and technically bound to an isolated workspace, no separate human confirmation is needed for:
- project lookup and Git revision checks;
- opening project files within the approved subdirectory;
- editing only that project's non-secret source files;
- safe syntax/tests/audits and a local commit on its approved non-production branch;
- reading status, audit, and bounded source snapshots.

These are the *desired standing authorizations* for the future project-specific runtime. They are not a claim that the blocked Claude binding is currently installed.

Only ask the owner for a **new** decision when changing the agreed scope or material risk: real-money spending above a preapproved cap, production/public deployment, destructive changes, credential access, permissions affecting unrelated projects, or a new project not already owner-approved. No per-file or per-command approval loop.

## Unnecessary gate removed now

Direct Desktop Commander read access to `/opt/jarvis/chatgpt-test` is **not** a prerequisite for auditing a known immutable revision: the previously exported, checksum-pinned private runtime snapshot can be inspected as the user `jarvis`. Preserve protected production permissions. A fresh HEAD and dirty-check is still required for any real installation. See `scripts/jarvis-universal-live-acceptance-v1.mjs`.

## Non-negotiable functional boundaries

- **Actual Claude project isolation:** the existing Bridge V5 chooses a `/workspace/projects/<project>` directory but the shared worker UID 11000 and some old group-readable workspaces are not a per-project OS boundary. Do not enable `LUKAS_PAFF` until the executing worker can access only that project and a negative cross-project test passes.
- **Live release/billing:** do not publish to a public website, pay for a new external service or run a paid model test unless within a previously approved scope and cost cap.
- **No broad sudo changes:** Desktop Commander has a platform-side command block independent of VPS sudoers. Do not try to evade it. Use the existing owner-approved rootless factory for routine enrollment and the bounded maintenance path for the rare privileged action.
- **Fail-closed on drift:** repo/branch/Git SHA mismatch, missing worker attestation or bad credentials must not fall back to another project.

## Direct shortest completion route

1. Keep Lukas registered but disabled in registry revision 5 (already done). The Core reads revision 5 (already done).
2. Reuse Claude Bridge V5 and provision a dedicated per-project execution boundary with only the Lukas workspace mounted, not the shared multi-project workspace. Check host/worker UID, in-container visibility, project Git tree and denied access to AURENTARA / JARVIS_AUTONOMY_TEST. This is a one-time privileged setup, not a per-task approval.
3. Bind the verified worker receipt to the owner-controlled catalog using the existing strict adapter. Activate Lukas only after PASS.
4. Execute one bounded, non-production fixture through chat → JARVIS → Claude; independently audit changed files, tests, branch, local commit and other-project nonchanges. The model call must respect a separately approved cost budget.
5. Once proven, reuse this pattern for subsequent owner-approved projects without manual VPS registration or routine sudo.

**Current limit:** The integration has not passed the actual project-specific Claude isolation / E2E tests. No global permissions were changed and no new model spending was authorized.
