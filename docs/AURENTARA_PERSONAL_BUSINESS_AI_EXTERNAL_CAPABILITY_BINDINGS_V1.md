# AURENTARA PERSONAL BUSINESS AI — EXTERNAL CAPABILITY BINDINGS V1

Status: Final software-only external activation seal. No live provider activation.

## Purpose

This block completes the concrete binding layer between the existing Customer activation ports and future live providers. It does not choose or activate a paid/new provider. It makes the safety contract executable before any such activation.

## Trusted Retrieval binding

- requires explicit provider activation or an explicit synthetic fixture,
- requires jurisdiction with every query,
- normalizes sources through the existing Trusted Research source contract,
- preserves source content as untrusted data,
- requires Block 03 policy/freshness/citation evaluation after retrieval,
- does not permit provider output to bypass source policy.

## Distributed Abuse binding

- requires a tenant and route class,
- accepts only a pre-hashed subject identifier,
- rejects raw IP/email/session-like identifiers as provider keys,
- fails closed if the distributed provider is unavailable/inactive,
- remains an additional layer; it does not remove the local abuse guard.

## Deletion binding

The existing audited deletion executor is composed with an auxiliary purge binding covering:

- cache,
- vector/index data,
- object storage.

Every target must be configured. The executor performs a dry-run/preflight before the durable Customer store is purged, then executes external purge targets. User confirmation and audit ID remain mandatory.

## Observability binding

Only the defined Customer operational events can reach an external sink. The binding reuses redaction-before-sink and forbids raw prompt/customer-content logging.

Allowed event classes cover:

- request completion/failure,
- rate limiting,
- research blocking,
- compute thresholds,
- deletion completion,
- security signals,
- availability signals.

## Launch readiness effect

`external_capability_bindings` becomes a PASS technical gate.

After this block there is no remaining software-only preproduction requirement in the Controlled Launch Readiness matrix when the mandatory Customer Red Team passes.

The remaining items are genuine activation gates because they require real infrastructure/provider/data/public changes:

- dedicated Production Customer Identity,
- dedicated durable Customer data plane,
- real-customer AI processing approval,
- live trusted retrieval activation,
- distributed rate-limit provider activation,
- Production deletion activation,
- Production observability/alerts activation,
- final legal/privacy review and retention/disclosure approval,
- PUBLIC Customer Surface activation,
- payment provider for Paid Founder launch.

## Verification requirement

The block must pass its dedicated acceptance plus Production Activation, Prelaunch Security/Privacy, Controlled Launch Readiness, mandatory Customer Red Team and canonical repository regression workflows on the same pull-request merge candidate before integration.

## Safety

- no live retrieval provider call,
- no distributed rate provider activation,
- no destructive Production delete,
- no external observability sink activation,
- no real customer data,
- no public real customer traffic,
- no paid API calls,
- no Stripe/payment activation,
- no domain/DNS change,
- no Production Customer project provisioning.
