# AURENTARA PERSONAL BUSINESS AI — DEDICATED CUSTOMER RUNTIME BINDINGS V1

Status: Prelaunch technical activation block.

## Purpose

This block converts the generic Production activation ports into Customer-specific Supabase binding contracts while preserving the hard architecture rule:

`CUSTOMER AI DATA PLANE != OPERATOR CONTROL DATA PLANE`

The currently connected Supabase project used by Operator Control must never be reused as the Production Customer AI project.

## Identity binding

The Customer identity binding requires:

- a dedicated Customer Supabase project reference,
- a different Operator project reference,
- a verified access-token callback bound to the Customer project issuer,
- tenant memberships loaded from the same Customer project,
- an authenticated session identifier,
- no Operator access.

A token issued by the Operator project is rejected even if its user ID otherwise looks valid.

## Durable store binding

The Customer store binding requires:

- a dedicated Customer project reference,
- explicit provider activation or an explicit synthetic fixture,
- tenant scope parsed before provider execution,
- an allowlist of Customer collections,
- optimistic revision semantics,
- tenant-scoped purge support,
- no browser service-role credential.

Unknown collections such as Operator secrets are rejected before they reach the provider callback.

## Current activation state

The contracts are complete, but no Production Customer project is provisioned or activated by this block.

Therefore:

- Production Customer Identity remains OFF.
- Production Customer durable storage remains OFF.
- Real customer data remains NONE.
- Operator Supabase remains untouched.
- No Supabase project is created.
- No migration is applied.
- No paid API is called.

## Why the existing Operator project is not used

The private Operator Control runtime already uses its own Supabase data plane. Sharing that project with Customer AI would weaken isolation, increase blast radius, complicate RLS guarantees and violate the product's established privacy architecture.

The binding layer therefore treats same-project configuration as a hard error: `CUSTOMER_OPERATOR_DATA_PLANE_COLLISION`.

## Launch readiness effect

The Controlled Launch Readiness evaluator now treats the provider-specific dedicated runtime binding contract as complete. The remaining Identity and Durable Data Plane items remain true Operator activation gates because they require provisioning/configuring the separate Customer project and applying the reviewed migrations.

## Safety

- no Production deployment,
- no Production Supabase project creation,
- no existing Operator database mutation,
- no real customer data,
- no service-role credential in browser code,
- no paid API calls,
- no public Customer activation.
