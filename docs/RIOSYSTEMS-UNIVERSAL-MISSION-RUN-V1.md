# RIOSYSTEMS Universal Mission Run V1

Universal Mission Run V1 connects the existing RIOSYSTEMS domain factories through one deterministic, branch-independent mission contract. It is intentionally not a new factory.

## Flow

Natural-language mission → mission compilation → business analysis → capability selection/rejection → dependency plan → factory/provider routing → zero-cost approval preflight → supervised synthetic staging → quality control → bounded retry/fallback → unified delivery → command-center projection.

## Capability ownership

- Growth/GTM: demand, ICP/positioning/acquisition strategy
- Web: conversion surface
- Business/CRM: business state and structured lead/customer handling
- Automation: repeatable follow-up/process flow
- AI: optional, only when explicit AI value is requested
- Analytics: outcome measurement

The run selects only capabilities justified by the mission and records rejected capabilities with reasons.

## Provider policy

The V1 routing policy records zero-cost staging routes and bounded fallbacks: RIOSYSTEMS Native Web + Cloudflare Pages Free for Web, Make with Activepieces fallback for Automation, Cloudflare Workers AI Free with deterministic fixture fallback for AI, Supabase Free for Business/CRM, PostHog Free for Analytics, and the internal Growth/GTM Factory for strategy. V1 acceptance never invokes those external providers. Provider participation is simulated and recorded honestly.

## Safety

Universal Mission Run V1 is fail-closed for this build block: staging only, synthetic data only, production disabled, variable development cost ceiling 0 EUR, no paid overflow, no real customer contact, no DNS/domain change, no money movement, no paid campaigns, no external writes. Real external dispatch remains behind existing approval gates and is not performed by this V1 runner.

## Acceptance

`scripts/universal-mission-run-v1-smoke.mjs` proves:

1. Bäckerei Müller remains a reusable regression mission.
2. A separate synthetic local Handwerksbetrieb compiles independently from natural language.
3. Capability selection and rejection are mission-specific.
4. Dependency and provider plans are explicit.
5. A synthetic Make failure exercises bounded fallback to the zero-cost Activepieces route without a provider call.
6. Both projects remain isolated.
7. Quality and Unified Delivery complete with `SIMULATED_HANDOFF_READY`.
8. Production, real data, and non-zero variable-cost requests fail closed.

The dedicated workflow also runs the central RIOSYSTEMS regression suite.
