# PROJECT JAGUAR — WEBFACTORY 100% — WAVE J9

## Browser / Accessibility / Performance V2

J9 turns browser behavior, accessibility engineering and performance evidence into a single fail-closed acceptance layer on top of canonical J8.

J9 does not replace J8 Visual Reference Closure, the existing Premium Website Standard, Web OS V2, QA, Visual Foundry or Launch Governance.

## Browser acceptance

The required behavioral checks are:

- navigation
- mobile navigation
- CTA
- forms
- anchors
- buttons
- dialogs
- accordions
- gallery
- carousel
- video
- keyboard navigation
- focus states
- 404
- external links
- scroll behavior
- sticky navigation
- orientation changes

Browser policy:

- Chromium = REQUIRED
- WebKit = RECOMMENDED
- Firefox = PROFILE_DEPENDENT

Device matrix:

- Desktop
- Laptop
- Tablet
- iPhone
- Small Mobile

Every required Chromium device must provide PASS or an evidence-backed NOT_APPLICABLE with a reason for every browser check. Missing Chromium, missing required devices, unexplained NOT_APPLICABLE or failed required behavior blocks.

WebKit absence is visible as a warning rather than silently presented as coverage. Firefox remains quality-profile dependent.

## Accessibility

Engineering target:

WCAG 2.2 AA

This is a target, not a certification claim.

Hard automated axe gates:

- critical violations = 0
- serious violations = 0

Required acceptance areas:

- keyboard navigation
- visible focus
- heading hierarchy
- landmarks
- labels
- contrast
- alt text
- reduced motion
- touch target size
- zoom behavior

Human primary-journey checks remain distinct:

- keyboard
- focus
- form errors
- navigation
- semantic basics
- screen-reader basics
- zoom / reflow
- touch interaction

Accessibility states are intentionally separated:

- AUTOMATED_PASS
- HUMAN_REVIEW_PENDING
- FULL_ACCEPTED

Automated PASS never fabricates a human review and never claims certification.

A human review can become FULL_ACCEPTED only when it includes a reviewer identity, review timestamp and PASS evidence for every required human check.

## Performance

J9 preserves the existing PROJECT JAGUAR Lighthouse minimums:

- Performance >= 0.90
- Accessibility >= 0.95
- Best Practices >= 0.95

Canonical performance budget rules carried into J9:

- total asset payload above 5 MiB = BLOCK
- JavaScript above 300 KiB = WARNING
- third-party JavaScript present = WARNING

CSS, image and video bytes are always measured separately.

Where an approved quality profile supplies a category-specific CSS, image or video maximum, J9 enforces that explicit profile budget as a hard gate. J9 does not invent a new universal category number when no previously approved number exists.

## Core Web Vitals evidence

Prelaunch Lighthouse lab evidence and post-launch field CWV are separate evidence classes.

A lab result is never presented as field CWV.

Real field evidence must be explicitly marked as real field evidence and linked to an evidence reference.

Good 75th-percentile field thresholds:

- LCP <= 2.5 s
- INP <= 200 ms
- CLS <= 0.1

Poor reference thresholds:

- LCP > 4 s
- INP > 500 ms
- CLS > 0.25

No real field evidence means field status remains NOT_VERIFIED. This does not falsify a prelaunch automated J9 pass.

## Real-browser acceptance fixture

The J9 smoke uses real Chromium and executes the full required behavioral check set across:

Desktop, Laptop, Tablet, iPhone and Small Mobile.

The fixture also verifies:

- real axe analysis
- visible keyboard focus
- semantic headings and landmarks
- form labels
- alt text
- color contrast
- reduced-motion behavior
- 44 px interactive target baseline
- zoom/reflow guard
- real 404 response
- orientation change without horizontal overflow
- real Lighthouse execution
- total payload budget enforcement
- JS warning behavior
- field CWV claim separation

WebKit and Firefox policy behavior is also tested so missing optional/recommended coverage cannot be misrepresented as required Chromium coverage.

## Relationship to J8

J8 remains responsible for reference-first responsive visual closure.

J9 consumes the resulting implementation and verifies runtime behavior, accessibility and performance.

A visually matching site can still fail J9.

A high Lighthouse score cannot override broken browser behavior or accessibility hard gates.

## Evidence model

J9 emits three independent reports:

1. Browser Matrix Report
2. Accessibility Report
3. Performance Report

The combined acceptance fails when any hard blocker exists.

Warnings remain visible and cannot be silently converted to PASS evidence.

## Safety

J9 cannot:

- deploy production
- launch public
- alter DNS
- activate billing
- automatically activate paid providers
- perform external customer writes

Production/Public/DNS/Billing/Paid/External Writes remain OFF.

## Additive implementation

J9 is additive only.

No existing J1–J8 file, script, workflow, report or artifact is deleted, reset, truncated, reverted or blindly replaced.
