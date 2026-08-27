# LEAN V4.7 — AI Mission Execution

V4.7 connects the existing AI Factory to the durable Mission Execution Router.

## What is new

- AI mission tasks are routed through `ai-factory-v1`.
- Explicit adapter dispatch approval remains required.
- AI execution requires an injected runner. No provider is activated implicitly.
- AI tools, external-data access and external side effects remain disabled.
- AI results are reconciled into durable mission task state.
- The unified router now supports Web, Automation and AI.
- Dependency outputs can flow from completed Automation tasks into downstream AI tasks.

## Safety invariants

- `production_deploy: false`
- `automatic_adapter_dispatch: false`
- `automatic_multi_factory_execution: false`
- no implicit network/provider activation
- no AI tool access
- no AI external-data access
- no AI external side effects

V4.7 expands supervised multi-factory mission execution without enabling autonomous production side effects.
