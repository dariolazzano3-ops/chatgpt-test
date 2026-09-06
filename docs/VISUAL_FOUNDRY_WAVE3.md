# PROJECT VISUAL FOUNDRY — Wave 3 Pinned Browser Render Lab

The render lab is pinned to Playwright 1.55.0 and CI runner `ubuntu-24.04`. Every render records the real Chromium version, OS release, viewport, DPR, locale, timezone, reduced-motion state, service-worker policy, font manifest, screenshot dimensions/hash, and commit SHA.

Animations/transitions are disabled for acceptance renders. Dynamic regions can be explicitly masked through stable selectors. Masking is evidence, not runtime truth mutation.
