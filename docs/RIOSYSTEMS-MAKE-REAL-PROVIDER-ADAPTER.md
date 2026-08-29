# RIOSYSTEMS Make Real Provider Adapter

Status: bridge-integrated, connection/runtime credentials still required.

The Make provider is now representable as a `riosystems.real-provider-candidate.v2` for capability `automation.run` and can be inserted into the shared Integration Catalog.

The adapter converts the Make staging connection contract into the canonical Real Provider Bridge contract and preserves the global gates:

- credential references only, never raw tokens
- HTTPS plus explicit Make zone host allowlist
- paid-provider approval before supervised execution
- external-write approval before scenario-changing actions
- supervised-execution approval
- monthly and per-run cost ceilings
- no automatic extra-credit purchase
- no production deployment

A Make candidate is not considered activation-ready until the account contract is valid and explicit monthly/per-run EUR cost estimates are supplied. This prevents the generic budget gate from silently treating an unknown subscription or credit cost as zero.

The Integration Catalog entry intentionally has no runner by default. This means RIOSYSTEMS can plan, validate, budget-check and route Make today, but cannot perform an HTTP request until a runtime runner and secret resolver are intentionally configured.

Next real-world gate: confirm Make API access, zone, team ID, least-privilege API token scopes and approved cost envelope. After that, the first action should be the read-only `/ping` and scenario-list preflight before any scenario creation or run.
