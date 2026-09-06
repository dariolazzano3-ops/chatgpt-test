# PROJECT VISUAL FOUNDRY — Reference Stencil & Constraint Closure V1

This layer changes the repair strategy, not the Visual Foundry architecture.

## Reference Stencil

The Approved Reference can be mounted as a build-only, pointer-events-none layer over the real HTML/CSS implementation.

Supported operator/build modes:
- REFERENCE_ONLY
- RUNTIME_ONLY
- OVERLAY
- BLINK
- DIFFERENCE

The stencil is VISUAL_BUILD_AID only. It is never Runtime Truth, never Production UI, and never a deployable screenshot implementation.

## Responsive Constraint Extraction

Pixels remain the calibration truth at the approved viewport, but they are not automatically the final CSS strategy.

The constraint set stores:
- exact desktop calibration anchor
- parent-relative x/y/width/height
- fixed structural rails where appropriate
- grid fractions for sibling columns
- responsive projection intent

A 216px navigation rail may remain structurally fixed while content columns are represented as fractions. The approved 1536×1024 viewport must still match exactly.

## Soft Region Locks

A good region is SOFT_LOCKED rather than permanently frozen.

During search, a regression creates a warning but does not automatically block a candidate. Before global acceptance, every regression beyond tolerance must be recovered. This allows a shared container correction to move several regions together without losing final regression safety.

## Deterministic Heatmap Priority

Priority is computed without AI:

(.6 × perceptual error + .4 × pixel error)
× area factor
× contrast factor
× semantic weight
× criticality weight

Weights are explicit and versionable. AI may explain a delta but does not assign the authoritative priority.

## Semantic Implementation Gate

Pixel closure is insufficient by itself.

Final implementation checks include:
- one visible H1
- valid heading progression
- main landmark
- accessible button/link names
- no positive tabindex
- no fake click-div controls
- no viewport-sized screenshot-as-implementation hack
- no leaked stencil
- bounded use of absolute/fixed positioning for structural visual components
- no duplicate DOM IDs

A visual PASS cannot override a semantic FAIL.

## Closure

APPROVED REFERENCE
→ STENCIL
→ CALIBRATION ANCHOR
→ RESPONSIVE CONSTRAINTS
→ LOCAL DELTA CLOSURE
→ SOFT REGION PROTECTION
→ GLOBAL VISUAL ACCEPTANCE
→ SEMANTIC IMPLEMENTATION GATE
→ RESPONSIVE ACCEPTANCE

Wave 20 remains LOCKED.
