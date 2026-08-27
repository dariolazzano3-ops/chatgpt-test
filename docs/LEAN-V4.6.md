# LEAN V4.6 — Unified Mission Execution Router

V4.6 connects the existing Web Factory mission bridge and the V4.5 Automation Factory mission bridge behind one supervised mission execution router.

## What it adds

- routes mission tasks by their execution engine
- supports `web` and `automation` through one execution entry point
- advances multiple READY tasks in bounded rounds
- respects dependency completion before downstream tasks run
- leaves Web Factory work as supervised external dispatch
- runs Automation Factory work through the supervised V4.4/V4.5 runner
- reports externally pending Web tasks separately from completed inline Automation tasks

## Safety invariants

- explicit adapter dispatch approval remains mandatory
- no production deployment
- no automatic cross-factory side effects
- no automatic multi-factory execution mode is enabled
- external automation actions still require V4.3 authorization, exact host allowlisting, and injected transport
- unsupported engines fail closed

## Scope

V4.6 intentionally does not integrate App, AI, or Business Factory execution. Their integration should use the same router contract only after their own adapters are ready and independently verified.
