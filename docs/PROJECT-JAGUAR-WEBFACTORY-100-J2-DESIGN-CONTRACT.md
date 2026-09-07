# PROJECT JAGUAR — WEBFACTORY 100% — WAVE J2

## Reference Design Contract V1

J2 extends the existing WebFactory design path. It does not introduce a second design engine or visual comparator.

### Source rule

A design contract can only be produced from a valid J1 Approved Reference whose SHA-256 lock verifies.

The extraction input must be structured observation evidence tied to the Approved Reference by reference_id and reference_hash. Opaque pixel-only extraction is not accepted as contract truth.

### Contract dimensions

The contract explicitly carries:

- layout
- grid
- spacing
- typography
- colors
- section order
- component intent
- hero geometry
- navigation
- CTA hierarchy
- image placement
- background behavior
- border
- radius
- shadow
- responsive behavior

### Determinism

The canonical contract payload is normalized before hashing. Same Approved Reference + same structured observation + same contract version yields the same SHA-256 contract hash.

The contract is:

- machine-readable
- versioned
- project-scoped
- viewport-scoped
- deterministic
- hash-verifiable
- diffable

### Existing architecture reuse

J2 converts the reference-derived contract into the existing riosystems.visual-design-contract.v1 and runs the existing validator.

Asset rights remain fail-closed. Unknown or disallowed rights block the visual contract.

Visual Foundry remains the only visual comparison engine.

### Diff

Reference Design Contract Diff compares two valid contracts for the same project scope and viewport and returns changed paths and categories. It does not hide version, spacing, typography, responsive or other structural changes behind one aggregate score.

### Adapter

WebFactory exposes:

web.reference.design-contract.v1

Operations:

- create
- verify
- diff

The dashboard can call this adapter later without GitHub-specific operator steps.

### Safety

Production, public launch, DNS, billing and paid activation remain disabled.
