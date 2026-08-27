# LEAN V3.3 — Failure Intelligence & Observability

LEAN V3.3 adds bounded, durable operational telemetry to the existing V3.2 Factory without changing Production policy.

## Durable job telemetry

Each non-duplicate Factory job keeps a bounded event timeline in `factory-state/jobs/<job_id>.json`. The timeline is capped at 80 events and records lifecycle milestones such as request, implementation, QA attempt, preview completion, QA outcome and repair outcome.

Telemetry is intentionally compact. It stores durations, structured QA issue codes, selected repair profile names, relevant commit SHAs and preview URLs. Secrets, browser logs and arbitrary page content are not copied into the telemetry stream.

## Failure intelligence

The V3.2 structured QA classifier remains the safety authority. V3.3 records which issue codes were observed and which bounded repair profiles were selected. Unsafe QA failures still terminate the automatic loop and Production remains disabled.

## Factory observability snapshot

`factory-state/observability.json` is refreshed after non-duplicate Factory runs. It aggregates the durable job records into a small operational snapshot containing:

- terminal job success/failure counts
- QA attempt counts
- average preview and QA durations
- committed automatic repair count
- automatic repair recovery rate
- repair profile frequencies
- structured failure-code frequencies

The snapshot is descriptive only. V3.3 does not automatically change repair policy based on historical metrics.

## Safety and cost behavior

- Production deployment stays `false` throughout Factory Control.
- Production continues to require the existing explicit manual release workflow.
- Automatic QA remains capped at three attempts.
- Event history is bounded to avoid unbounded state growth.
- Duplicate QA requests continue to use the existing idempotency/cost guard and do not create unnecessary preview deployments.
- Observability refresh is non-blocking: a metrics snapshot failure cannot turn a successful project build into a failed project build.

## Evolution value

V3.3 gives future LEAN versions evidence for deciding which failures are common, which repair profiles are effective and where runtime cost is actually spent. Any later adaptive behavior should be introduced separately and only after enough telemetry exists to justify it.
