# PROJECT VISUAL FOUNDRY — Wave 5 Deterministic Visual Measurement Engine

The comparator uses local deterministic measurement for:
- pixel difference via pixelmatch
- perceptual similarity via SSIM
- geometry comparison from DOM snapshots
- average color similarity
- Sobel-style edge/structural comparison
- explicit region-based comparison

AI has no acceptance authority in this layer. Image dimension mismatch fails closed. Diff images are persisted as evidence.
