# PROJECT JAGUAR — WEBFACTORY 100% — WAVE J7

## Full Visual Closure Loop V1

J7 extends the existing screenshot comparison and visual repair paths.

It does not create a second Visual Foundry or a second pixel-comparison engine.

### Authoritative pipeline

Approved Reference

→ Build

→ Browser Screenshot

→ existing riosystems.screenshot-comparison-job.v1

→ Delta Segmentation

→ Root Cause

→ Bounded Repair Plan

→ Repair

→ Rebuild

→ New Screenshot

→ Recompare

→ PASS or Human Review Required

### Approved Reference

The loop only starts with a valid J1 hash-locked Approved Reference.

Candidate, Draft or tampered references are rejected.

The loop never mutates the Approved Reference.

### Delta taxonomy

J7 classifies:

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

Unknown deltas remain explicitly unclassified and are not silently auto-repaired.

### Root causes

Deltas are mapped to bounded architectural causes:

- TYPOGRAPHY_TOKENS
- LAYOUT_GEOMETRY
- STYLE_TOKENS
- ASSET_MEDIA
- RESPONSIVE_RULES
- COMPOSITION
- MOTION_CONTRACT
- UNCLASSIFIED

### Region Locks

Previously accepted regions may be locked by region ID or path prefix.

A delta inside an accepted locked region becomes:

LOCKED_REGION_REGRESSION

and blocks automatic repair.

The system returns HUMAN_REVIEW_REQUIRED instead of regressing a locked region.

### Bounded Loop

Auto repair is hard-capped.

Default candidate: 3 rounds.

Absolute system maximum: 5 rounds.

Infinite loops are forbidden.

If the loop does not close inside the allowed rounds:

HUMAN_REVIEW_REQUIRED.

### Runtime evidence

J7 acceptance uses:

- real Playwright browser screenshots
- real Sharp pixel decoding/comparison
- a deliberately mismatched initial candidate
- positive initial pixel difference
- bounded repair
- rebuilt candidate
- a second real browser screenshot
- final pixel difference of zero for the deterministic fixture

The test separately proves:

- Region Lock blocks regression
- no-op repairs exhaust into Human Review
- missing browser/comparison runtime fails closed
- no pixel-level PASS is claimed when runtime is missing

### Existing engine reuse

Comparison authority remains:

riosystems.screenshot-comparison-job.v1

Structured repair authority remains:

riosystems.visual-repair-result.v1

J7 is the orchestrator that closes the loop around those existing systems.

### Adapter

Capability:

web.visual.closure.v1

Synchronous control-plane operations:

- contract
- manifest
- segment
- repair_plan

The actual browser closure loop is asynchronous runtime work exposed by runFullVisualClosureLoop.

### Safety

- no automatic Reference approval
- no Reference mutation
- no Production deploy
- no Public launch
- no DNS change
- no Billing change
- no automatic paid provider activation
