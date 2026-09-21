# JARVIS CURRENT TRUTH V1

Date: 2026-09-21

## One authoritative picture

Public/private owner surface: `https://jarvis.ysrio.com`.

Live service: `jarvis-remote-operator.service` on the VPS.

Live working directory: `/opt/jarvis/chatgpt-test-project-mission-v2`.

Live integration branch: `project-mission-live-v2`.

The branch name is historical. It already contains the V3 capability branch through commit `223a891`, merged by `e780659`, plus the first real voice patch `87ef6ad`.

Therefore: the running system is not “old V2”. It is the current integration runtime with V3 content plus live-only integration work.
## Product rule

JARVIS has two distinct lanes.

1. Conversation lane
   - normal text and voice conversation
   - recent-turn continuity
   - personal context and read-only information
   - no engineering execution
   - no project mutation

2. Mission lane
   - explicit Engineering Mission or Project Mission
   - approvals, evidence, bridge execution and acceptance
   - actions stay separate from normal conversation

Normal speech must never feel like an engineering mission.

## Current priority

No V4 and no new capability waves until the conversation lane passes real owner acceptance from a phone.
Acceptance sentence:

`Jarvis, hörst du mich?`

Expected behavior:
- accurate transcript
- direct natural answer
- no capability jargon
- no project detour
- audible reply
- follow-up question keeps recent conversation context

After conversation acceptance, reconcile the historical live branch name with the canonical V3 branch. Do not rename or rewrite branch history during conversation stabilization.
