# PROJECT VISUAL FOUNDRY — Wave 7 Visual Acceptance Contract

Acceptance is explicitly split into:
- FUNCTIONAL_ACCEPTANCE
- VISUAL_ACCEPTANCE
- RESPONSIVE_ACCEPTANCE
- ACCESSIBILITY_ACCEPTANCE
- HUMAN_VISUAL_APPROVAL

Functional PASS never implies visual PASS.

The initial PoC thresholds are configurable defaults: structural 1.0, geometry 0.97, perceptual 0.96, significant pixel difference max 3%, typography 0.97, color 0.97, critical/blocking deltas 0.

Missing deterministic visual evidence yields NOT_EVALUATED. A critical local delta blocks acceptance even when global scores are high.
