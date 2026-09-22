# REFERENCE TO UI V1

Use this workflow whenever a generated/reference image must become a real interactive UI.

## Source of truth hierarchy
1. Locked reference image(s): visual intent only.
2. VISUAL_CONTRACT_V1.json: semantic structure and acceptance contract.
3. Figma when available: editable visual decomposition and component geometry.
4. Runtime code: actual behavior and data truth.

## Non-negotiable rule
Never solve visual fidelity by placing the full reference screenshot, a rectangular screenshot crop, or baked UI text inside the running interface.

Static artwork may be extracted from the reference only when it contains no live text/status/cards and has transparent background around the intended artwork.

## Required decomposition
For every interactive visual target, classify each visible element as one of:
- STATIC_ART: illustration, body, glow, decorative texture.
- LIVE_UI: cards, text, status, navigation, controls.
- INTERACTION: anchors, connectors, hover/selected/focus, detail views.
- RUNTIME_TRUTH: states/evidence supplied by real data.

## Semantic ID contract
A single stable ID must bind all representations of the same concept:
`card/<id> ↔ anchor/<id> ↔ connector/<id> ↔ detail/<id>`.
The DOM must expose the same ID with `data-zone` (or an equivalent semantic attribute).

## Builder sequence
1. Hash and lock original references.
2. Create machine-readable visual contract.
3. Isolate allowed static artwork from reference pixels, with transparency.
4. Build live components separately. Never bake their text/state into art.
5. Implement responsive relationships from actual element geometry.
6. Run structural smoke tests.
7. Run real browser interaction tests at target CSS viewports.
8. Produce screenshots and visual-diff artifacts.
9. Human visual review.
10. Private deployment only after structural + browser + visual acceptance.

## Failure conditions
Fail immediately if:
- a full screenshot or rectangular crop is used to simulate UI;
- a reference contains stale live status that remains visible;
- connectors are hard-coded to viewport pixels rather than element geometry;
- fewer semantic objects exist than the contract requires;
- a PASS is based only on internal geometry scores without actual browser screenshots.
