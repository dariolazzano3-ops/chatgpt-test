# PROJECT JAGUAR — PREMIUM STATIC WEB V1

## Mission

PROJECT JAGUAR standardizes the existing RIOSYSTEMS Web Factory around one source-owned, exportable premium static website build profile:

`PREMIUM_STATIC_WEB_V1`

Jaguar is an integration layer. It does not create a second Web Factory, second provider router, second Visual Foundry, second delivery gate, or second deployment truth.

## Default routing

The existing native routes now declare `PREMIUM_STATIC_WEB_V1` as their build profile:

- `native-cloudflare`
- `native-premium-cloudflare`
- `framer-design-native-cloudflare` where Framer remains design-specialist-only and the final website remains RIOSYSTEMS-owned code.

Complex CMS and rapid-prototype specialist candidates remain outside the default profile.

## Toolchain

Pinned acceptance toolchain:

- Astro 7.3.1 — static source renderer
- RIOSYSTEMS design tokens / CSS — styling baseline
- GSAP 3.15.0 — optional controlled motion provider
- Sharp 0.35.4 — image optimization
- Playwright 1.55.0 — desktop/mobile browser acceptance
- @axe-core/playwright 4.13.0 — automated accessibility checks
- Lighthouse 13.4.1 — performance/accessibility/best-practices lab evidence
- existing RIOSYSTEMS Visual Foundry — approved-reference visual comparison, delta closure, soft locks, semantic gate
- Cloudflare — preferred staging/hosting route under existing governance

## Source model

The existing native renderer remains the deterministic materialized preview surface. Jaguar additionally produces a buildable Astro source package from the exact generated pages, CSS, JS and project-scoped assets.

This keeps the current preview/runtime contract stable while creating an owned source package suitable for framework-based builds and later controlled evolution.

The source package is returned as build evidence and is not silently exposed through the current static preview root.

## Visual Foundry bridge

When an Approved Reference identity/hash is present, Jaguar marks Visual Foundry acceptance as required.

Jaguar does not implement another visual comparator. It delegates reference registration, screenshot comparison, SSIM/pixel metrics, region locks, semantic gates and delta closure to the existing Visual Foundry.

When no Approved Reference exists, no pixel-fidelity claim is made.

## Acceptance gates

Jaguar CI verifies:

1. deterministic source package
2. Astro static build
3. Sharp image transformation
4. GSAP provider availability
5. Playwright desktop browser rendering
6. Playwright mobile rendering and overflow guard
7. axe serious/critical violations = 0
8. Lighthouse performance >= 0.90
9. Lighthouse accessibility >= 0.95
10. Lighthouse best practices >= 0.95
11. Visual Foundry bridge semantics
12. existing Autonomous Premium regression
13. existing Web OS V2 regression
14. production/public/DNS/paid/external-write safety seal

## Motion policy

Native CSS and Web Animations remain the default. GSAP is available only when the approved motion contract needs it.

Reduced-motion behavior is mandatory. Decorative motion cannot block the primary customer journey.

## Image policy

Sharp is the standard optimization engine for project-scoped assets.

The profile expects responsive variants, explicit dimensions, modern formats where appropriate, and lazy loading below the fold. Rights and provenance remain governed by the existing asset/rights pipeline.

## Safety

PROJECT JAGUAR does not authorize:

- production deployment
- public launch
- DNS changes
- paid provider activation
- automatic paid overflow
- external writes
- customer approval
- legal approval

Those remain under the existing RIOSYSTEMS governance paths.

## Canonical relationship

Jaguar was started from the current `factory/visual-foundry-v1` remote truth so it can consume the current Visual Foundry integration without copying it.

This is therefore a stacked feature branch. Canonical merge must not indirectly bypass the separate Visual Foundry merge/acceptance decision.
