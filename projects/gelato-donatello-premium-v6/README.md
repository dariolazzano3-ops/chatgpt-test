# Gelato Donatello — Premium Website V6

Designer-led private website generation for Gelato Donatello inside AURENTARA.

V6 keeps the verified business data and owner-provided image library from V5, but rebuilds the visual system, page composition, navigation, responsive behavior and inquiry UX as a coherent premium gelateria brand experience.

## Scope

Six private-preview routes:

- `/` — Start
- `/sortiment/` — 41 confirmed flavors
- `/eisbecher/` — full cup menu and extras
- `/eistorten-eisbomben/` — cakes, ice bombs, Spaghetti cakes and inquiry flow
- `/eisvitrine/` — rental-vitrine specification and reservation preparation
- `/kontakt/` — visit and contact

The codebase is static HTML/CSS/ESM JavaScript. No framework runtime or external UI dependency is required.

## V6 design direction

The design is intentionally editorial rather than dashboard-like:

- warm ivory / sage / espresso / sand palette
- strong condensed display typography with restrained body typography
- asymmetric image-led hero sections
- curated food mosaics rather than repetitive card grids
- large real Donatello photography
- dark/high-contrast storytelling sections
- compact micro-typography for prices and metadata
- horizontal snap galleries on mobile where they improve browsing
- reduced card chrome, no generic pill-button system

Buonissimo remains only a composition/reference principle. No Buonissimo branding, copy or assets are used.

## Authoritative project data

V6 preserves the confirmed data model:

- family-run since 1965, second generation
- since 2016 in Köllerbach
- own ice lab, daily fresh production
- Hauptstraße 4, 66346 Köllerbach
- phone 06806 9394980
- 41 confirmed flavors: 30 Regular + 11 Specials
- 68 cup-menu source entries
- 33 confirmed sauces/creams/liqueurs/toppings
- confirmed cake and ice-bomb prices
- rental-vitrine project-state pricing/specifications

Fixed opening hours are intentionally not published because no newer owner confirmation is available.

## Image assets

78 owner-provided assets are physically integrated for the private preview, including:

- 41 individual flavor images
- 6 cup images
- 24 cake / ice-bomb / Spaghetti-cake images
- 5 shop/interior images
- Donatello logo
- flavor/source poster

The actual mobile rental-vitrine image is not confirmed. V6 therefore uses a designed specification board rather than showing an invented or unrelated photo.

Production/public image rights remain gated pending final owner confirmation.

## Inquiry UX

No confirmed digital delivery endpoint exists. The forms therefore do not pretend to submit anything externally.

For cakes and ice bombs the V6 flow lets the user prepare:

1. variant and size
2. occasion / desired date / decoration
3. flavors, with a dynamic limit of 2 for cakes and up to 6 for ice bombs
4. a local summary for phone or in-person confirmation

User-entered summary values are written using DOM `textContent`, not HTML injection.

## Safety

`project.json` keeps:

- production deploy: false
- public deploy: false
- DNS changes: false
- billing actions: false
- external writes: false
- indexing: NOINDEX

The intended review surface is the existing Cloudflare-Access-protected private preview only.

## Acceptance

Run:

```bash
node scripts/gelato-donatello-premium-v6-smoke.mjs
```

The V6 acceptance additionally uses real Chromium renders at 1440 px desktop and 390 px mobile to verify responsive layout, zero broken images and zero horizontal page overflow.
