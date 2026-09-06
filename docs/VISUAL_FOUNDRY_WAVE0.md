# PROJECT VISUAL FOUNDRY — Wave 0 Baseline Harness

Status: implementation candidate on `factory/visual-foundry-v1`.

## Purpose

Wave 0 establishes a reproducible evidence path before any autonomous visual repair is allowed:

`APPROVED REFERENCE → BROWSER RENDER → RUNTIME SCREENSHOT → BASELINE COMPARISON OUTPUT → EVIDENCE PACK`.

This wave intentionally does **not** claim visual acceptance. The current baseline comparison records dimensions and cryptographic hashes only. Until the deterministic visual comparator is implemented in the later measurement wave, every evidence pack reports:

`VISUAL_ACCEPTANCE_NOT_EVALUATED`.

## Reused platform capabilities

- Playwright/Chromium
- existing RIOSYSTEMS browser QA conventions
- existing Factory repair loop as the future extension point
- existing cost/deployment safety model
- Git commit evidence

## New Wave 0 artifacts

- `src/visual-foundry/baseline.js`
- `scripts/visual-foundry-wave0.mjs`
- `scripts/visual-foundry-wave0-smoke.mjs`
- `.github/workflows/visual-foundry-wave0.yml`

## Gold-standard rule

The AURENTARA Masterdashboard approved reference is not invented or reconstructed from implementation code. If the approved reference asset is not present, the real Gold Standard run remains blocked with `APPROVED_REFERENCE_MISSING`.

## Safety

Production OFF. Public OFF. DNS OFF. Billing OFF. No provider calls. No AI repair. No runtime-truth writes.
