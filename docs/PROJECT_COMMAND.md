# Project Command v1

Project Command is the coordination layer for parallel Factory workstreams. It deliberately does not treat ChatGPT conversations as durable infrastructure. Repository state is the source of truth; chats are operator interfaces.

## Worker lifecycle

`READY -> RUNNING -> DONE`

Additional coordination states: `WAITING`, `BLOCKED`, `HOLD`.

A new work block requires human `GO`. Cross-worker automatic dispatch and Production deployment remain disabled.

## Command protocol

Each worker checkpoint should report:

- worker id
- completed work
- PR / commit / deployment evidence when applicable
- CI state
- blockers
- requested next action

The command layer evaluates dependencies and emits one of: `GO`, `HOLD`, `WAIT`, `READY`, `BLOCK`, `COMPLETE`.

## Operational CLI

Read the current command snapshot:

`node scripts/project-command.mjs status`

Generate a worker handoff:

`node scripts/project-command.mjs handoff ai-factory`

Apply an explicitly authorized transition and persist it atomically:

`node scripts/project-command.mjs apply project-v HOLD "await integration checkpoint"`

`node scripts/project-command.mjs apply project-v GO "continue approved block"`

The CLI only mutates the coordination JSON. It does not merge pull requests, run external actions, deploy Production, or automatically contact another chat.

## Initial workers

- `project-v`: LEAN Core, Automation Factory, Multi-Factory orchestration
- `ai-factory`: isolated AI Factory
- `dashboard`: Factory Control / Dashboard

## CI

The isolated `Project Command` workflow syntax-checks the engine and CLI, runs the smoke suite, reads the status snapshot and generates a handoff. It is scoped only to Project Command files to avoid unnecessary interference with parallel Factory work.

## Safety boundary

Project Command coordinates work. It does not silently merge PRs, deploy Production, invoke external side effects, or automatically start another worker. Those actions require their existing authorization paths.
