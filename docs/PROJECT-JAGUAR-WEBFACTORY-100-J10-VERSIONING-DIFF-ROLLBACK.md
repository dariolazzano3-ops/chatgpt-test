# PROJECT JAGUAR — WEBFACTORY 100% — WAVE J10

## Versioning / Diff / Rollback V1

J10 adds the missing revision-control and safe rollback closure on top of the existing WebFactory lifecycle governance.

J10 does not create a second project engine, provider router, approval system, deployment engine or state engine.

It reuses the existing lifecycle-governance-v2 authorities:

- createWebsiteVersion
- createBuildVersion
- analyzeChangeImpact
- calculateBlastRadius
- createRegressionContracts
- createRollbackContract

## Revision domains

J10 covers all required revision domains:

- KNOWLEDGE
- REFERENCE
- BUILD
- PREVIEW
- DELIVERY

Every revision is append-only and carries:

- revision identity
- semantic version
- domain
- source revision
- change reason
- immutable snapshot
- SHA-256 snapshot hash
- artifact reference/hash when applicable
- acceptance state
- previous revision link
- hash-chain link
- existing lifecycle version evidence

Historical revisions are never rewritten.

A duplicate revision ID, a non-advancing semantic version, a mutated historical snapshot, a broken hash chain or an artifact hash mismatch blocks.

## Diff

J10 produces deterministic snapshot diffs between revision records.

Diff output includes:

- before/after revision identity
- before/after domain and version
- changed flag
- deterministic path-level additions, removals and changes
- before/after payload hashes

The diff is evidence. It does not silently mutate project state.

## Change impact

Every change must deterministically select one of exactly four outcomes:

1. NO_REBUILD
2. PARTIAL_REBUILD
3. FULL_REBUILD
4. REFERENCE_REVIEW_REQUIRED

Decision policy:

- non-rendering metadata/note/label changes -> NO_REBUILD
- Knowledge/fact changes -> REFERENCE_REVIEW_REQUIRED
- non-approved Reference changes -> REFERENCE_REVIEW_REQUIRED
- approved Reference changes -> FULL_REBUILD
- global design token/layout/routing/page-structure changes -> FULL_REBUILD
- high or cross-factory blast radius -> FULL_REBUILD
- bounded content/component/CTA/form/asset/page changes -> PARTIAL_REBUILD
- changes with no rendering/integration impact -> NO_REBUILD

J10 uses the existing change-impact and blast-radius engines as evidence. It does not replace them.

## Regression plan

J10 wraps the existing regression contract and binds it to the canonical Jaguar stack:

- Visual regression -> existing Visual Foundry
- Multi-viewport reference closure -> J8 when required
- Browser/accessibility/performance -> J9
- automatic approval -> false

A change impact decision is therefore not itself acceptance.

## Rollback

Rollback must restore a previous accepted artifact without rebuilding it.

Supported artifact rollback domains:

- BUILD
- PREVIEW
- DELIVERY

Knowledge and Reference remain revisioned, but are not artifact-pointer rollback domains.

Rollback requires:

- current revision
- an earlier historical revision in the same domain
- accepted/known-good target state
- target artifact reference
- target artifact SHA-256
- rollback reason
- restore adapter
- restored-artifact hash verification
- rollback validation

The restore mode is:

ARTIFACT_POINTER_RESTORE

Hard rules:

- rebuild_required = false
- rebuild_allowed_during_rollback = false
- no previous accepted artifact -> BLOCK
- restored artifact hash mismatch -> BLOCK
- rollback validation failure -> BLOCK
- automatic rollback acceptance -> false
- new revision record required after a successful restore
- automatic production switch -> false

A rollback therefore restores the exact known-good artifact rather than recreating an approximation from current source.

## Real acceptance fixture

The J10 smoke proves:

1. all five revision domains are covered
2. revisions are append-only
3. historical mutation breaks integrity
4. duplicate revision IDs fail
5. non-advancing semantic versions fail
6. deterministic Knowledge and Build diffs work
7. NO_REBUILD is selected for non-rendering changes
8. PARTIAL_REBUILD is selected for bounded content changes
9. FULL_REBUILD is selected for global design changes
10. REFERENCE_REVIEW_REQUIRED is selected for Knowledge/non-approved Reference changes
11. cross-factory form impact escalates to FULL_REBUILD
12. existing lifecycle regression contracts are reused
13. rollback selects the previous known-good Build artifact
14. rollback restores that artifact without invoking rebuild
15. tampered restored artifacts fail hash verification
16. no-known-good rollback fails closed
17. Knowledge rollback through the artifact path is rejected

## Integration

WebFactory capability:

web.versioning.rollback.v1

Operations:

- manifest
- ledger
- verify
- append
- diff
- impact
- regression
- rollback_plan
- rollback

The capability is a thin adapter over the J10 module and existing lifecycle-governance-v2.

## Safety

J10 cannot:

- deploy production
- launch public
- alter DNS
- activate billing
- automatically activate paid providers
- perform external customer writes

Production/Public/DNS/Billing/Paid/External Writes remain OFF.

## Canonical closure rule

J10 is not accepted because the module exists.

Required closure loop remains:

Remote Truth
-> implement
-> test
-> repair
-> regression
-> dogfood
-> acceptance
-> merge
-> exact post-merge verification

No fake PASS.
