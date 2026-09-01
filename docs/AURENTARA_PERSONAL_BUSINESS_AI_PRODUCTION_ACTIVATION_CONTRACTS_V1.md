# AURENTARA PERSONAL BUSINESS AI — PRODUCTION ACTIVATION CONTRACTS V1

Status: Build Block 08 implementation.

## Mission

Close every technical `PREPROD_REQUIRED` gate from Controlled Launch Readiness V1 without activating Production, customer data, paid APIs, new providers, domains or payment systems.

These contracts are deliberately provider-neutral ports around the existing Customer AI stack. They do not create second engines.

## 1. Customer Identity Adapter

Contract:

`provider assertion -> verified principal -> active tenant membership -> Customer context`

Properties:
- tenant membership is mandatory,
- no Operator access is ever emitted,
- a configured verifier is not enough to execute,
- a real callback requires explicit provider activation,
- deterministic tests require explicit `synthetic_fixture=true`.

## 2. Durable Customer Store Adapter

The adapter preserves the existing Customer Foundation store semantics:

`get(scope, collection, id)`
`put(scope, collection, id, value, options)`
`list(scope, collection)`

It parses existing Customer scopes before the driver receives them:
- `tenant:<tenant_id>`
- `<tenant_id>:<business_id>`

The driver therefore receives explicit tenant scope rather than an opaque key. Optimistic revision conflicts remain supported.

A deterministic driver proves:
- same collection/id in separate tenants does not collide,
- business records remain tenant-isolated,
- revision conflicts fail correctly,
- tenant purge cannot delete another tenant.

No Production database is provisioned or migrated by this block.

## 3. Trusted Retrieval Adapter

Contract:

`query -> provider-neutral retrieval -> Block 03 normalized source records -> Trusted Research policy`

The adapter uses the existing Block 03 source normalizer. Source content is always untrusted data and must still pass source-quality, freshness, evidence and citation policy.

Prompt-like text inside retrieved evidence is preserved as untrusted evidence metadata and cannot become runtime instructions.

No live retrieval provider is activated.

## 4. Distributed Rate-Limit Adapter

This port defines the common contract for later distributed edge/runtime enforcement.

Properties:
- fail closed when unavailable or unactivated,
- explicit route class, key, limit and window,
- a limited decision returns a hard customer rate-limit failure,
- the existing local abuse guard is not replaced by this contract.

No Cloudflare/other distributed limiter is activated here.

## 5. Customer Deletion Executor Contract

Deletion is treated as an auditable multi-scope operation.

Requirements before execution:
- explicit user confirmation,
- audit ID,
- Customer Store purge capability,
- every required external purge target configured,
- preflight of all external targets before the first destructive step.

V1 required external scope:
- cache/vector scopes.

The Customer Store purge covers tenant, membership, business, conversation, memory, goal, decision and usage records. Production execution remains blocked unless Production activation is explicitly enabled.

Synthetic acceptance proves that deleting Tenant A preserves Tenant B.

## 6. Customer Observability Contract

Events are redacted before any sink callback is invoked.

Sensitive keys include prompts, messages, answers, content/evidence, emails, phone numbers, cookies, authorization, tokens, secrets and passwords. String-level email and Bearer-token scrubbing adds defense in depth.

The contract allows operational fields such as event name, severity, tenant/business identifiers, status and latency while prohibiting raw customer content logging.

A configured sink cannot execute unless it is explicitly activated or the test uses `synthetic_fixture=true`.

## Activation invariant

Across identity, retrieval, rate limiting and observability:

`callback configured != provider activated`

External callbacks require explicit activation. Synthetic fixture execution is an explicit test-only override.

## Launch Readiness integration

`productionActivationContractsManifest()` is now read by the existing Controlled Launch Readiness evaluator.

For `FREE_CONTROLLED_PILOT`, once the mandatory Red Team passes:

- all six technical preproduction contracts are PASS,
- `preproduction_required_ids` becomes empty,
- next state becomes `OPERATOR_ACTIVATION_REQUIRED`.

For `PAID_FOUNDER_LAUNCH`, one safely buildable preproduction item still remains:

- `payment_adapter_contract`.

Therefore the roadmap must continue to the Payment Lifecycle Contract before stopping at final operator gates.

## Safety

This block performs:
- no Production deployment,
- no Production migration,
- no real customer identity calls,
- no real customer data,
- no live research calls,
- no distributed rate provider calls,
- no Production deletion,
- no external telemetry activation,
- no paid APIs,
- no payment activation,
- no domain/DNS changes.

## Next logical block

**Payment Lifecycle Adapter Contract V1**

Build a provider-neutral synthetic subscription/payment event state machine for the Founder plan. Do not activate Stripe or any payment provider. After that block, the remaining launch work should be genuine operator activation gates only.
