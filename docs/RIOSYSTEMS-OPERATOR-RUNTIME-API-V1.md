# RIOSYSTEMS Operator Runtime + Dashboard API V1

Block 8 turns the read-only Operator Control Plane from Block 7 into a stateful single-operator runtime contract.

## Runtime

`riosystems.operator-runtime.v1` owns only operator-session state:

- current Command Center state
- selected project scope
- durable mission inputs
- synthetic Universal Mission Run history
- monotonic runtime revision
- local audit trail

Every mutation requires the caller's expected runtime revision. Stale writes fail closed with `RUNTIME_REVISION_CONFLICT`.

## API surfaces

Read routes:

- `GET /health`
- `GET /snapshot`
- `GET /dashboard`
- `GET /projects`
- `GET /projects/:scope`
- `GET /missions`
- `GET /missions/:id`
- `GET /deliveries`
- `GET /factories`
- `GET /approvals`
- `GET /actions`

Controlled mutation routes:

- `POST /projects/:scope/select`
- `POST /universal-missions`
- `POST /commands`

`POST /commands` delegates to the existing Command Center API. A dispatch function can be injected, but this API never invokes it automatically. It only returns a supervised dispatch handle when the existing approval rules allow preparation.

`POST /universal-missions` uses Universal Mission Run V1 in synthetic staging mode. Unsafe production, paid-budget or real-customer-data requests remain blocked by the Universal Mission preflight.

## Store

V1 ships a memory reference adapter with compare-and-swap semantics. It demonstrates the persistence contract without introducing a new database or provider dependency. A later durable adapter can implement the same `load`, `create` and `compareAndSwap` contract.

## Safety invariants

- production disabled
- direct provider calls disabled
- automatic dispatch disabled
- external writes never implicit
- paid execution never implicit
- automatic paid overflow disabled
- current development variable-cost ceiling remains 0 EUR
- project scope is checked before synthetic mission creation
- stale mutations are rejected
