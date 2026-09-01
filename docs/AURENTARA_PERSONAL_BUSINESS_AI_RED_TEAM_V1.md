# AURENTARA PERSONAL BUSINESS AI — QA / RED TEAM / ABUSE RESISTANCE V1

Status: Build Block 06 implementation.

## Purpose

Block 06 attacks the complete customer stack before any Controlled Public Launch can be recommended.

The mandatory policy is simple:

`ALL REQUIRED RED-TEAM CASES MUST PASS`

Tests are synthetic, local/deterministic and zero-cost.

## Mandatory attack matrix

The V1 gate covers:

- cross-tenant leakage,
- memory poisoning,
- stale facts,
- conflicting facts,
- wrong provenance,
- unauthorized access,
- prompt injection,
- malicious source input,
- weak research sources,
- unsupported high-risk claims,
- model failure,
- provider failure,
- cost runaway,
- rate abuse,
- deletion behavior,
- account/tenant boundaries,
- customer/operator boundary,
- unsafe HR behavior,
- unsafe tax/legal certainty,
- wrong business context,
- cross-tenant cache/session contamination,
- plan-change budget-reset abuse.

## Repairs produced by the red team

### 1. Temporal memory validity

Finding: a fact could remain status `CONFIRMED_FACT` while its `valid_until` was already expired. Previous context resolution considered status/provenance but not the temporal validity window.

Repair: `resolveCurrentFacts()` now excludes facts whose `valid_from` is in the future or whose `valid_until` has passed. The underlying record remains available for audit/history, but it is not current Business State.

### 2. Fair-use plan-switch reset

Finding: an internal synthetic/manual preview plan switch recreated the monthly compute ledger, which could erase already-spent units for that month.

Repair: plan changes now change the existing ledger limit while preserving spent/reserved units, operation attribution and a plan-change history. Upgrades increase the remaining allowance without erasing use; downgrades cannot regenerate allowance.

### 3. Customer burst abuse

Finding: fair-use compute bounded successful AI work, but guest-session creation and rapid Customer API mutation bursts did not have a dedicated local abuse guard.

Repair: the preferred public `/customer` handler now runs through `Customer Abuse Guard V1` before the existing Customer Surface.

V1 local limits cover:

- Guest session creation by client source,
- chat bursts by session + client source,
- other Customer mutations.

The guard runs before inference, returns HTTP 429 with Retry-After, and never opens an Operator route.

## Rate-limit limitation

The new guard is intentionally honest about its boundary: it is process/isolate-local and therefore **not** a globally distributed Production rate limiter.

A Controlled Public Launch still requires a distributed edge/runtime rate-limiting mechanism and verified Production configuration. That requirement becomes a launch-readiness gate rather than being hidden behind an in-memory counter.

## Memory poisoning

AI-generated memory remains `MEMORY CANDIDATE` only. The Red Team injects a high-confidence false revenue claim and proves it does not enter current confirmed memory without explicit user confirmation.

## Stale/conflicting facts

The suite proves:

- expired facts are not current,
- future-valid facts are not current,
- a confirmed current fact outranks contradictory AI inference.

## Provenance

A model response attempting to cite a foreign/non-retrieved memory reference fails the existing Block 02 evidence allowlist.

## Prompt and source injection

Customer instruction-like text and instruction-like text embedded in an official-looking research source remain untrusted data. Source injection is detected but cannot override runtime constraints.

## High-risk HR / legal / tax

Employment-law and tax/legal questions are classified high-risk. Without trusted current evidence they block before provider inference. With allowed official evidence, citations remain mandatory and professional-escalation metadata is preserved.

## Provider and model failure

The Red Team verifies that:

- a provider failure does not spend fair-use compute,
- structurally invalid model output fails validation,
- reserved fair-use compute is released after failed turns.

## Cost runaway

The Free tenant budget is exhausted synthetically and the next compute reservation is rejected before provider work. No unlimited-compute path exists.

## Deletion

A confirmed memory record is deleted through Foundation V1 and is then absent from both memory search and relevant reasoning context, including historical-context requests.

This verifies memory deletion behavior, not full Production account/business hard deletion. Full durable customer-data deletion remains a Controlled Launch prerequisite because the Foundation V1 deletion plan intentionally has no Production purge executor yet.

## Account and session boundaries

Forged Guest Session tokens fail. Production account auth remains disabled. Guest tenant/business scope remains server-derived rather than request-selected.

## Customer / Operator boundary

The hardened customer handler cannot handle `/operator`; the canonical Worker entry still resolves private Operator Control first. The Customer Abuse Guard imports no Operator runtime/dashboard modules.

## Cross-tenant cache/session contamination

Two synthetic guests share the same Customer Surface process. Tenant A memory is changed and the suite proves the marker never appears in Tenant B memory.

## Economics plan-change abuse

The Red Team spends compute, upgrades an internal preview plan, then downgrades it. Spent compute remains preserved through both changes.

## Acceptance standard

`src/customer-product/red-team-v1.js` defines the mandatory test IDs and evaluator. The evaluator passes only if every required attack case has explicit passing evidence.

The CI workflow runs syntax plus the full synthetic attack suite and remains a required development signal for future Customer AI changes.

## Production status

- Production customer surface: inactive
- Production auth: inactive
- real customer data: none
- live research provider: inactive
- Stripe/payment: inactive
- paid API calls: 0
- variable test cost: €0
- distributed Production rate limit: not active

## Next logical block

**Controlled Public Launch Readiness V1**

That block should convert the current product state into an explicit launch gate matrix, verify all prerequisites that can be proven without Production changes, and stop only where real operator action is actually required.
