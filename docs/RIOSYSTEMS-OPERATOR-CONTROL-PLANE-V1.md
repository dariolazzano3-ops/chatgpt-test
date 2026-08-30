# RIOSYSTEMS Operator Control Plane V1

## Purpose

Block 7 turns the existing Command Center, provider evidence and mission delivery aggregation into one operator-facing control contract.

The control plane does not replace the existing LEAN Core. It composes it.

Inputs:

- Command Center state / project portfolio
- Provider Stack V1 and activation evidence
- Mission Delivery Aggregator V4.12
- Verified Bäckerei Müller Block 6 live staging E2E evidence
- Growth / GTM Factory V1 manifest

Outputs:

- factory readiness matrix
- provider activation view
- mission delivery registry
- verified live E2E proof registry
- alerts and next actions
- cost posture
- safety posture
- dashboard-ready presentation model

## Readiness model

Core factories `web`, `automation`, `ai` and `business` are considered live-staging verified only when their existing repository evidence says so. Growth is represented as a provider-neutral strategy engine. App Factory remains planned until it becomes required by the business-building core.

`LIVE_STAGING_CONTROL_READY` means:

1. all four core runtime factories have verified staging capability;
2. the Bäckerei Müller cross-provider Block 6 proof is verified;
3. no operator attention item is currently present in the supplied control-plane state.

It does **not** mean production is authorized.

## Unified delivery

Every supplied durable mission state is passed through the existing `aggregateMissionDelivery()` implementation. Structural completion remains separate from external activation readiness.

Block 6 is represented as a separate immutable live proof because it is a real correlated staging verification across Cloudflare Pages, Make, Supabase, PostHog and Cloudflare Workers AI.

## Dashboard contract

`buildOperatorDashboardView()` produces a presentation-only model with:

- hero/system state
- metrics
- project queue
- factory cards
- delivery feed
- approvals
- execution summary
- alerts
- action queue
- safety panel

The view model makes no direct provider calls and performs no external mutation.

## Safety

V1 is read-only.

- production deployment: disabled
- external writes: explicit approval only
- paid execution: explicit approval only
- automatic paid overflow: disabled
- development cost ceiling: 0 EUR
- real customer data in current staging posture: disabled
- custom domain/DNS changes: disabled
- mass email: disabled
- money movement: disabled

This block is therefore safe to validate entirely in CI with existing immutable evidence and synthetic mission state.
