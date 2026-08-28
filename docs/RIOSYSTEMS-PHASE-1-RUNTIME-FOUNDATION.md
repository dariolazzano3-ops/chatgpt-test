# RIOSYSTEMS Phase 1 Runtime Foundation

Phase 1 turns the existing LEAN V5 / MAX mission engine into a governed RIOSYSTEMS runtime layer.

## Block 1 implemented

- provider-neutral registry across capabilities
- deterministic primary provider routing
- bounded fallback ordering
- per-request customer/project scope identity
- budget gate before paid execution
- explicit approval gate for paid and external providers
- production deployment remains disabled
- no provider or external system is activated automatically

## Safety contract

A provider route is not execution authorization. External or paid execution must pass runtime governance with an explicit customer/project scope, sufficient remaining budget and required approvals.

Customer and project identity are combined into an immutable scope key for downstream persistence and audit boundaries.

## Next blocks

1. integrate runtime governance into the one-command mission pipeline before activation/supervision
2. add durable cost ledger and reservation/reconciliation primitives
3. add capability-wide provider adapters and health-aware fallback
4. add approval records with scope, expiry and actor identity
5. add code ownership and project write-boundary enforcement

Production deploy and implicit real-world side effects remain outside this phase and require separate explicit authorization.
