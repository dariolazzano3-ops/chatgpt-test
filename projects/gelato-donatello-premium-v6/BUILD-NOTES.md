# Gelato Donatello Premium V6 — Build Notes

## V6 designer loop

V6 was built as a separate project generation at:

`projects/gelato-donatello-premium-v6/`

The verified V5 data model and owner assets were reused. The visible design system was then reworked in an iterative browser loop instead of layering more overrides onto V5.

### Audit findings from V5

The visual audit identified several issues that prevented the previous generation from feeling fully designer-authored:

- repetitive 50/50 section rhythm
- undersized brand/navigation presence
- awkward large-headline wrapping on mobile and some interior pages
- dense menu presentation
- cake inquiry UX collapsing into a long raw checkbox wall
- rental-vitrine placeholders looking unfinished
- insufficient distinction between editorial storytelling and utility sections

### V6 response

V6 introduces:

- a new token system and clean V6 stylesheet
- redesigned navigation and footer
- an asymmetric home hero and compact fact band
- editorial heritage and workshop storytelling
- a curated four-image flavor mosaic
- redesigned cup menu hierarchy and dark extras section
- a real cake gallery using owner assets
- a three-step inquiry experience with collapsible flavor selection
- an intentional rental-specification board instead of a fake missing product image
- new contact composition with controlled headline measures
- mobile snap galleries and reduced visual repetition

## Verified content

The build continues to use the confirmed 41-flavor data set, cup-menu data, extras, cake/bomb prices, contact information and owner-provided images. No dietary, allergen or alcohol metadata was invented.

The duplicated Waldbeer source entry remains a data-quality note rather than being silently replaced.

## Browser QA

Real Chromium QA was performed at:

- 1440 × 1000 desktop
- 390 × 844 mobile

All six routes were exercised.

After the second design/polish loop:

- page overflow: 0 px on desktop and mobile
- broken images: 0
- 41 flavor images physically present
- contact and rental hero headline wrapping corrected
- mobile home and Eisbecher overflow corrected
- request flavor limits verified dynamically
- local request summary verified against HTML injection

The V6 request UX browser test verified:

- classic cake third flavor disabled after 2 selections
- ice bomb expands selection limit to 6
- literal HTML-like user input remains text
- injected image elements in the summary: 0

## Static acceptance

The V6 smoke verifies:

- six expected routes
- NOINDEX metadata
- V6 project schema and private-only safety
- exactly 41 unique flavors
- all 41 flavor image files
- V6 designer structure markers
- no pending rental-image placeholder in the visible V6 surface
- no stale ASCII-only public copy such as Koellerbach/Hauptstrasse
- responsive V6 CSS and reduced-motion support

JavaScript syntax checks, JSON parsing and `git diff --check` also pass.

## Release boundary

V6 may be deployed only to the existing Cloudflare-Access-protected Donatello private preview.

Not allowed by this build:

- production domain changes
- DNS changes
- public publishing
- billing changes
- paid provider actions
- external form submissions

The public `gelato-donatello.de` site remains untouched.
