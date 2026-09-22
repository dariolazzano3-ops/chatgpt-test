# Pilot 001 — Bäckerei Clemens

Purpose: prove AURENTARA WEB FACTORY V1 with a synthetic bakery project.

## DESIGN_DNA
Premium editorial bakery. Warm paper tones, oversized serif typography, close-up craft photography, deliberately sparse copy, strong vertical rhythm, cinematic scroll movement, no generic bakery template look.

## REUSE_PLAN
- Reuse existing Project Factory project structure.
- Reuse existing Playwright visual QA.
- Use existing browser primitives plus GSAP from CDN for motion rather than building a motion engine.
- Use Pexels free-to-use bakery photography for the pilot.
- Build only the project-specific layout/copy/tokens.

## LANE
Existing static Project Factory lane. No framework migration. No new app runtime.

## ASSET_PLAN
Hero bread texture + craft/hands image. Real client assets would replace these in a customer project.

## CONTENT BOUNDARY
The business is synthetic. No address, opening hours, history or legal claims are fabricated.

## FIRST_PASS
Source lives at projects/baeckerei-clemens-pilot/.

## NEXT VERIFICATION
Run scripts/visual-qa.mjs against a private/local or approved preview, inspect desktop/mobile screenshots, then repair only the three highest-impact visual mismatches.
