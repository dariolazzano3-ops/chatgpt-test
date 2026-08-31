# AURENTARA SYSTEMS Public Website V1

## Status
Public-facing AURENTARA SYSTEMS website implementation. The legacy project path `projects/riosystems-public-website-v1` is intentionally retained as an internal technical identifier to avoid a disruptive rename. This project is isolated from the private Operator Dashboard and RIOSYSTEMS runtime.

Canonical brand / ownership source of truth: [`../../docs/BRAND_OWNERSHIP_ARCHITECTURE.md`](../../docs/BRAND_OWNERSHIP_ARCHITECTURE.md).

## Brand architecture

`YSRIO → AURENTARA SYSTEMS → connected Business Systems`

- **YSRIO**: strategic umbrella / ownership brand in the background.
- **AURENTARA SYSTEMS**: visible operative customer brand.
- **RIOSYSTEMS**: existing internal technical foundation where stable technical identifiers should remain unchanged.
- Public endorsement may use **A YSRIO Company** discreetly. It is a brand architecture statement and must not be used to imply an unverified legal group structure.

Reserved domains:
- AURENTARA SYSTEMS: `aurentarasystems.com`
- YSRIO: `ysrio.com`

Reservation does not authorize Production, DNS, custom-domain binding or traffic migration.

## North Star
- 70% clarity and trust
- 20% premium authority
- 10% wow

Desired impression: trustworthy, sovereign, premium, calm, technically competent and international.

Avoid: aggressive styling, cyberpunk, generic AI-agency language, excessive glow, overloaded dashboards and technology-first messaging without business context.

## Public positioning
Primary positioning: **WE BUILD THE SYSTEMS BEHIND YOUR BUSINESS.**

Secondary positioning: **YOU RUN THE BUSINESS. WE BUILD WHAT MAKES IT RUN.**

Core offer: AURENTARA SYSTEMS plans, builds and connects Business Systems across **Web, CRM, AI, Automation, Growth, Analytics, Operations and adjacent company systems**.

The public narrative is business-first. Provider names, factories, routers and internal runtime terminology are not the homepage story.

## Homepage messaging
Hero capability line:

**Web. CRM. AI. Automation. Growth. Analytics. Operations.**

Support:

**Wir bauen und verbinden die Systeme, die dein Unternehmen voranbringen.**

Solution principle:

**Ein System. Passend zu deinem Unternehmen.**

Capability section:

**Connected Business Systems.**

Public flow:

Understand → Plan → Build → Connect → Validate → Launch → Improve.

## Visual direction
Reuse the existing premium systems language rather than redesigning from zero:
- near-black / graphite base
- titanium / silver / white hierarchy
- restrained System Blue and Violet activation accents
- Swiss-grotesk typography direction
- strong negative space and precise grid
- connected architecture as the signature visual metaphor
- subtle depth and controlled motion
- AURENTARA Core as the visible center of the system visualization

The Core should communicate connected company architecture, not a sci-fi cockpit. Visual effects must remain reproducible with portable HTML/CSS/SVG/JS and respect reduced-motion preferences.

## Architecture
Static, dependency-free V1:
- `index.html`: semantic homepage and staging-only project intake
- `styles.css`: design tokens, responsive system and reduced-motion rules
- `app.js`: progressive enhancement, mobile navigation, reveal motion, locale preference and privacy-safe analytics event hooks
- `robots.txt`, `sitemap.xml`: SEO readiness placeholders

The central Core visual is CSS + SVG. No WebGL dependency is required for V1.

## Naming boundary
Customer-facing presentation uses **AURENTARA SYSTEMS**. Existing internal identifiers such as `riosystems:analytics`, the folder/slug, schemas and RIOSYSTEMS runtime terminology remain technical implementation details until a separate technical migration has a concrete benefit.

SYNTROPIC and RIOSYSTEMS must not be presented as the current operative customer brand.

## Localization
Locale architecture is prepared for `de`, `en`, `fr`, `it`, `es`, `nl`, `pl`, `pt`. The German copy is authoritative in this first build. Manual choice is stored locally and overrides browser preference. Currency remains EUR (€).

## Intake safety
The V1 staging form validates locally only. It deliberately performs no provider write and sends no personal data anywhere. A real backend/provider integration is a separate user gate.

## Analytics
The page emits local `riosystems:analytics` CustomEvents with allowlisted event names. No analytics SDK is loaded by this project. Existing RIOSYSTEMS/PostHog infrastructure can attach a privacy-safe adapter later instead of duplicating analytics infrastructure.

## Accessibility
Target: WCAG 2.2 AA. Includes semantic landmarks, skip link, focus states, reduced motion, keyboard-operable dialog/navigation, accessible labels and non-color-only communication.

## Performance
No framework, no autoplay video, no remote fonts, no heavy animation library. Visuals use CSS/SVG and progressive enhancement.

## Production
Production deployment, custom-domain binding, DNS changes and traffic migration are explicitly out of scope until separately approved.
