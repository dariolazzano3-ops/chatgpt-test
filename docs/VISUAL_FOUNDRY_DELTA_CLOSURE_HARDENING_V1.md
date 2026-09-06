# PROJECT VISUAL FOUNDRY — Gold Standard Delta Closure Hardening V1

This hardening layer exists between a failed Gold Standard measurement and the next isolated PoC attempt. It does not change Wave 20 and does not replace Waves 0–19.

## 1. Reference Asset Extractor

Approved raster references may yield explicit REFERENCE_EXTRACTED visual assets through bounded crop contracts.

Every extraction is locked to:
- reference_id / version / SHA-256
- exact canvas
- exact crop rectangle
- output SHA-256
- GOLD_STANDARD_POC_ONLY usage scope

Reference extraction never infers production rights. It never silently upgrades an extracted crop into an ORIGINAL_ASSET.

## 2. Typography Resolver

When a raster reference does not reveal a trustworthy font identity, the resolver searches an explicit bounded candidate grid and measures metric equivalence.

It optimizes family candidate, weight, size, line-height, and letter-spacing using deterministic browser/image evidence.

A metric-equivalent substitution may pass the raster calibration threshold, but the system never claims the original font identity was discovered unless it was independently known.

## 3. Deterministic CSS Optimizer

Numeric CSS parameters are optimized using bounded coordinate descent.

Typical parameters:
- sidebar width
- hero height
- grid ratios
- gaps
- padding
- component heights
- font metrics

Every candidate is measured. Protected regions cannot regress beyond tolerance.

## 4. Regression-Protected Region Closure

Regions already above threshold are frozen as protected regions. Candidate repairs that turn PASS to FAIL, regress a protected score beyond tolerance, or fail to improve the target are reverted.

This creates a monotonic closure path rather than a blind rewrite loop.

## Gold Standard order

REFERENCE_EXTRACTED ASSETS
→ MACRO GEOMETRY CALIBRATION
→ COMPONENT GEOMETRY
→ TYPOGRAPHY METRIC CALIBRATION
→ COLOR / EFFECTS
→ MICRO SPACING
→ MACHINE ACCEPTANCE

AI remains optional for locating the responsible code/rule. Deterministic measurement decides whether a candidate survives.

Wave 20 remains LOCKED.
