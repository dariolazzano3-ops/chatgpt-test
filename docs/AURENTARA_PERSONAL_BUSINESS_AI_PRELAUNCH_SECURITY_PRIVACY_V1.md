# AURENTARA PERSONAL BUSINESS AI — PRELAUNCH SECURITY, PRIVACY & SURFACE SHIELD V1

Status: Technical prelaunch seal. No public launch.

## Scope

This block closes the remaining software-only security/privacy/surface preparation before external Production activation.

It adds:

- static verification of the reviewed Customer SQL security contracts,
- consent ledger contract,
- business-data export bridge,
- deletion-plan/executor bridge,
- explicit launch modes,
- a prelaunch access shield in the canonical Worker entry path.

## SQL security seal

The verifier requires the Customer migration contracts to preserve:

- a dedicated Customer data plane,
- RLS on Foundation and Conversation tables,
- hardened `is_tenant_member` membership lookup with fixed `search_path`,
- authenticated tenant/member scope,
- conversation owner scope,
- no authenticated hard-delete policy,
- vector/semantic filtering by tenant and business at query time,
- reviewed migration files remaining non-applying contracts until the dedicated Customer project is provisioned.

## Privacy technical controller

The technical controller reuses the existing Foundation as the source for:

- business data export,
- memory correction,
- deletion planning.

The existing audited deletion executor remains the hard-delete path. User confirmation is required before execution.

A tenant-scoped consent ledger supports explicit grant/withdrawal events with policy versions for:

- persistent business memory,
- trusted research,
- product analytics,
- optional AURENTARA service handoff.

The block does not decide final legal retention periods or replace legal review.

## Launch Shield

The canonical `/customer` namespace now passes through an explicit mode shield:

### OFF

Default. Customer routes return inactive/404.

### SYNTHETIC_STAGING

Existing synthetic product surface remains available for controlled synthetic tests.

### CONTROLLED_PRELAUNCH

Requires:

- explicit prelaunch enable flag,
- matching prelaunch token,
- real-data flag remaining false.

The shield delegates only to the synthetic runtime.

### PUBLIC

Public mode remains blocked unless all of the following are explicitly true/bound:

- public activation approval,
- real-customer-data approval,
- Production Customer runtime binding.

Those conditions are intentionally not activated by this block.

## Launch readiness effect

`prelaunch_security_privacy_contracts` becomes a PASS technical gate.

The following remain genuine Operator gates:

- Production Customer Identity,
- dedicated durable Customer Data Plane,
- real-customer AI processing,
- live trusted retrieval,
- distributed rate limiting,
- Production deletion,
- Production observability,
- final legal/privacy review and retention/disclosure approval,
- PUBLIC Customer Surface activation,
- payment provider for paid launch.

## Safety

- no public customer traffic,
- no real customer data,
- no Production Customer database provisioned,
- no migration applied,
- no trusted retrieval provider called,
- no distributed rate provider activated,
- no external telemetry sink activated,
- no paid API calls,
- no Stripe/payment activation,
- no domain/DNS changes.
