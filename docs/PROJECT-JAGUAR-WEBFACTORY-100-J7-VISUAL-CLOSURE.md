# PROJECT JAGUAR — WEBFACTORY 100% — WAVE J7

## Full Visual Closure Loop V1

J7 implements the critical reference-first closure loop:

Approved Reference
→ Build
→ Browser Screenshot
→ existing Visual Foundry comparison
→ delta segmentation
→ root cause
→ repair plan
→ bounded repair
→ rebuild
→ rescreenshot
→ recompare

There is no parallel visual comparator.

## Visual Foundry integration

The existing Visual Foundry feature track had already implemented the deterministic visual core, but its long-lived branch had diverged substantially from current factory-control.

J7 therefore integrates the reusable Visual Foundry core modules into current Canonical rather than merging the historical branch wholesale.

Integrated Foundry authority:

- visual-comparator
- visual-delta
- visual-priority
- visual-acceptance
- delta-closer
- soft-region-locks
- region-closure
- semantic-gate

The comparator uses:

- PNG decoding
- pixelmatch
- SSIM
- color similarity
- Sobel/Jaccard edge similarity
- optional region crops

AI is not the acceptance authority.

## Approved Reference gate

No visual-match pass is possible without:

- APPROVED Reference state
- valid J1 hash lock
- visual_source_of_truth=true
- image/png reference asset
- SHA-256 render asset hash
- exact materialized PNG hash match
- exact viewport ID match
- exact PNG dimensions match the closure viewport

A wrong or changed reference image blocks before visual acceptance.

## Delta types

J7 explicitly supports:

- typography
- position
- spacing
- size
- color
- background
- asset
- crop
- border
- radius
- shadow
- responsive
- missing
- extra
- motion

Blocking deltas must receive a resolved visual type and root cause before automatic repair.

Blind rewrite is forbidden.

## Deterministic delta identity

Visual Foundry delta IDs are stable across implementation commits for the same visual target and measurement.

This enables real no-progress detection across repair rounds.

The implementation commit remains evidence on the delta, but is not part of semantic delta identity.

## Priority and root cause

Each typed delta receives deterministic priority based on:

- measurement error
- affected area
- contrast
- semantic importance
- criticality

Repair plans remain phase-ordered through the existing Visual Foundry delta closer.

## Soft / region locks

Regions that already pass become soft-locked.

During candidate evaluation:

- a pass-to-fail region regression rejects the candidate
- regression beyond tolerance rejects the candidate
- a better global score cannot override a critical-region regression
- newly passing regions are added to the lock set

Finalization blocks if any locked region remains regressed.

## Semantic gate

Pixel similarity can never override semantic implementation quality.

The existing Visual Foundry semantic gate checks, among other things:

- one visible H1
- heading hierarchy
- main landmark
- accessible names
- link semantics
- positive tabindex
- fake interactive elements
- stencil leakage
- screenshot-as-implementation hacks
- excessive structural absolute positioning
- duplicate DOM IDs

A semantic failure rejects the candidate.

## Bounded repair

Default automatic repair rounds: 4.

Hard maximum: 8.

There is no infinite loop.

A candidate is rejected when it causes:

- semantic regression
- functional regression
- responsive/accessibility regression
- region-lock regression
- global visual regression

If the blocking-delta signature does not make deterministic progress, J7 stops with HUMAN_DECISION_REQUIRED.

If the bounded rounds are exhausted, J7 stops with HUMAN_DECISION_REQUIRED.

## Real browser acceptance

The J7 acceptance test uses a real Chromium browser.

It:

1. renders an exact mobile reference
2. captures the PNG
3. creates and human-approves a J1 reference
4. verifies the materialized reference SHA-256
5. renders an intentionally wrong implementation
6. measures real SSIM and pixel diff through Visual Foundry
7. verifies a known-good region is initially locked
8. applies a first candidate that improves the target but regresses the locked region
9. requires that candidate to be rejected
10. applies a second candidate matching the reference
11. requires final pixel difference 0 and SSIM 1
12. runs the real semantic gate
13. runs a separate bounded-exhaustion case and requires HUMAN_DECISION_REQUIRED

## WebFactory capability

Capability:

web.visual.closure.v1

Operations:

- manifest
- verify_reference
- run

The run operation is asynchronous because browser capture and image comparison are runtime operations.

## Safety

The J7 closure cannot:

- deploy production
- launch public
- alter DNS
- activate billing
- automatically activate paid providers
- perform external customer writes

J7 changes only project-scoped frontend files through the Visual Foundry repair-authority guard.
