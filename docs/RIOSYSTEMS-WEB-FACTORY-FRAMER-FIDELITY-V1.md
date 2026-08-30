# RIOSYSTEMS Web Factory — Framer Premium Design Bridge + Visual Fidelity V1

## Purpose

This block extends Web Factory V1. It does not replace the native builder.

The premium path is:

`Framer visual design stage -> provider-neutral design contract -> RIOSYSTEMS interpretation -> owned HTML/CSS/JS reconstruction -> measurable visual fidelity QA -> bounded visual repair -> Cloudflare staging candidate`

Framer is a `visual_specialist`, not the default hosting provider. Framer hosting requires a project-specific dependency or explicit operator approval.

## Provider roles

- RIOSYSTEMS Native Builder: `native_builder`
- Framer: `visual_specialist`
- Webflow: `cms_specialist`
- Lovable: `rapid_prototyper`
- Cloudflare: `hosting_provider`

Routing remains cost-aware and lock-in-aware. Native code artifacts prefer Cloudflare.

## Design contract

`riosystems.visual-design-contract.v1` carries pages, sections, layout, color/typography/spacing/radius/shadow tokens, component geometry, interaction/animation intent, responsive rules, assets/rights, visual references and implementation notes.

The contract deliberately forbids raw provider HTML copying and proprietary code extraction. The interpretation layer produces `riosystems.structured-design-spec.v1`.

## Asset and font safety

Every supplied asset must include a source, license status, ownership, explicit reimplementation permission and replacement flag. Unknown or unapproved rights fail closed.

Custom fonts are not allowed unless a matching approved font asset exists. System/generic font stacks remain safe for the zero-cost deterministic path.

## Native reconstruction

`reconstructPremiumWebsite()` starts with the existing Web Factory V1 mission/build path, then applies the structured visual specification to the owned design system and emits an independent CSS reconstruction overlay. It writes the following evidence into the project artifact:

- `structured-design-spec.json`
- `visual-implementation.json`
- `interaction-translation.json`
- `asset-rights-report.json`
- `provider-route.json`
- `visual-fidelity-report.json`
- `screenshot-comparison-job.json`
- `visual-repair-history.json`
- enriched `delivery-manifest.json`

No Framer runtime is required.

## Fidelity evidence

The V1 fidelity score is not a pixel score. It is a weighted exact comparison of properties that the system can actually verify from the structured reference and native implementation metadata:

- layout
- spacing
- typography
- colors
- component geometry
- responsive rules
- section order
- translated native interaction coverage

Levels:

- STANDARD: target >= 85
- PREMIUM: target >= 93
- HIGH_FIDELITY: target >= 97 and screenshot evidence required

When browser/image-comparison execution is unavailable, the screenshot report is explicitly `NOT_EXECUTED_RUNTIME_UNAVAILABLE`; pixel similarity, rendered font metrics and exact image crop pixels remain unverified. HIGH_FIDELITY therefore fails closed without screenshot evidence.

## Screenshot architecture

The prepared adapter pipeline is:

`REFERENCE_SCREENSHOT -> GENERATED_SCREENSHOT -> COMPARE -> DIFFERENCE_REPORT -> REPAIR -> RETEST`

`runScreenshotComparison()` executes only when both capture and compare adapters are supplied. Otherwise it returns a non-executed report and makes no pixel claim.

## Visual repair

The bounded visual repair loop currently repairs deterministic structured mismatches that can be safely patched without redesign decisions, including container width, hero height, section/grid spacing, colors, body/heading font family, card/button radius and card shadow. It records attempts and fails closed when remaining differences cannot be repaired.

## Interaction translation

Interactions are classified as:

- `native_reproducible`
- `approximation_possible`
- `requires_specialist_runtime`
- `unsupported`

Non-native outcomes are written as transparent delivery deviations. They are never silently dropped.

## Framer activation

Provider states:

`not_configured -> free_ready -> connected -> design_verified`

`paid_required` is a separate gate and cannot be activated automatically.

V1 prepares the Free-plan activation checklist but stores no credentials in the repository. A real Framer provider call is optional and must stop at any credential, permission or paid gate.

## Hard safety

- Production: disabled
- Real customer data: disabled
- DNS/custom domains: disabled
- Paid activation/overflow: disabled
- Variable cost ceiling: 0 EUR
- Unlicensed asset reuse: disabled
- Secrets in repository: disabled
- Cloudflare preview/JWT issue: outside this block

## Acceptance

Run:

```sh
node scripts/web-factory-v1-smoke.mjs
node scripts/web-factory-framer-fidelity-smoke.mjs
```

The premium fixture is `fixtures/web-factory/premium-architecture-studio.json`. The existing Bäckerei Müller fixture is rebuilt as a regression check.
