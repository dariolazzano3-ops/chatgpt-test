# JARVIS Integration Layer V1

## Purpose

JARVIS remains the personal + project orchestrator. External systems are specialist capabilities, not new sources of personal memory.

This layer binds JARVIS to the tools required for day-to-day life and project execution while preserving approval boundaries.

## Remote truth checked before this wave

Base branch: `factory/jarvis-personal-assistant-v1`  
Base HEAD: `26bb967076ffa2e2be218732b721f9302ca959eb`

The existing JARVIS core already provides:

- isolated personal memory
- HAMYREN hard isolation
- action gate + autonomy levels
- tool registry + connector registry
- provider-neutral connector runtime
- Google Calendar read adapter
- private JARVIS worker / Pages surface
- dedicated Supabase private persistence architecture

Therefore V1 does **not** build a second orchestration engine.

## Integration order

1. GitHub Remote Truth
2. Claude Code specialist
3. Browser / public research
4. Calendar / tasks / reminders
5. Cloudflare read-only
6. Supabase read-only / bounded JARVIS-private operations
7. Gmail draft/read, then approval-gated send
8. later providers

## Capability classes

### READ

May run autonomously when authenticated and scoped.

Examples:

- repository metadata
- branch / HEAD
- pull requests
- CI / workflow runs
- public web research
- deployment status
- database health / schema read

### PREPARE

May produce plans, patches, commands, drafts, worktrees, local changes and test results without external effect.

Examples:

- Claude Code analysis
- local code edits in a bounded workspace
- commit proposal
- PR body
- deploy plan
- email draft

### SAFE_INTERNAL_WRITE

May be enabled only for explicitly scoped internal workspaces.

Examples:

- write files inside a JARVIS project worktree
- create local commits
- update local task/evidence state

No protected branch, production, DNS, billing or secret mutation is included.

### APPROVAL_REQUIRED

Must stop and ask Dario before execution.

Examples:

- push to a remote branch unless explicitly allowlisted
- open/update a pull request when write mode is enabled
- merge
- production deploy
- DNS
- secret mutation
- external email send
- destructive database change
- billing / purchase

### BLOCKED

Never executable in V1:

- financial transfer
- bypassing approval gates
- HAMYREN private-memory access
- credential extraction / persistence into normal memory
- destructive production action without a dedicated future contract

## GitHub binding

Role: canonical remote-truth provider for code projects.

Read scope:

- repository
- branches
- commits
- pull requests
- workflow runs / jobs / logs
- statuses
- changed files

Write scope in initial live binding:

- OFF by default

JARVIS may prepare branch/commit/PR operations but remote writes remain disabled until a separate bounded policy is activated.

## Claude Code binding

Role: coding specialist under JARVIS orchestration.

Preferred orchestration mode:

- non-interactive print mode for bounded one-shot tasks
- tmux interactive mode only for deliberate multi-turn repair loops

Claude Code must receive:

- explicit project workspace
- explicit goal
- allowed tool boundary
- max-turn / timeout boundary
- acceptance criteria
- no-production rule
- no-secret rule
- no HAMYREN private context

Expected loop:

JARVIS Remote Truth
→ execution brief
→ Claude Code
→ local edits
→ tests
→ JARVIS verification
→ evidence
→ approval gate for remote write / merge

## Workspace isolation

Claude Code should operate in a dedicated project worktree or worker workspace, not in JARVIS personal-memory directories.

It must not receive:

- Telegram bot token
- Hermes auth store
- JARVIS OAuth vault material
- Supabase service-role secrets
- unrelated personal memory

## Provider boundary

Cloudflare, Supabase and other providers start READ-ONLY.

Write enablement is always a later explicit policy step.

## Acceptance V1

Integration Layer V1 is accepted when:

- registry declares all initial providers
- every capability has a risk class
- GitHub remote-truth reads are classified READ
- Claude Code workspace execution is PREPARE / SAFE_INTERNAL_WRITE only
- merge / production / DNS / billing / secret changes are approval-gated or blocked
- HAMYREN private-data flow remains impossible
- credentials are never part of normal action payloads
- smoke test passes

## Non-goals

- no merge
- no production deployment
- no DNS change
- no billing action
- no live secret mutation
- no shared memory with HAMYREN
