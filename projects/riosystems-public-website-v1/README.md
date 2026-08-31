# AURENTARA SYSTEMS Public Website V1

## Status
Implementation branch for the public AURENTARA SYSTEMS website. The public brand is intentionally isolated from the private Operator Dashboard and the underlying RIOSYSTEMS runtime.

## Brand architecture
- YSRIO GROUP: ownership / holding brand in the background
- AURENTARA SYSTEMS: visible operating and customer brand
- Existing RIOSYSTEMS technical infrastructure may remain internally as implementation substrate

The public website must not expose internal RIOSYSTEMS architecture unless it creates clear customer value.

## North Star
- 70% clarity and trust
- 20% premium authority
- 10% wow

Primary positioning: **WE BUILD THE SYSTEMS BEHIND YOUR BUSINESS.**
Secondary positioning: **YOU RUN THE BUSINESS. WE BUILD WHAT MAKES IT RUN.**

## Public flow
Understand → Plan → Build → Connect → Validate → Launch → Improve.

## Architecture
Static, dependency-free V1:
- `index.html`: semantic homepage and staging-only project intake
- `styles.css`: design tokens, responsive system and reduced-motion rules
- `app.js`: progressive enhancement, mobile navigation, reveal motion, locale preference and privacy-safe analytics event hooks
- `robots.txt`: staging indexing guard

The central systems visual is CSS + SVG. No WebGL dependency is required for V1.

## Localization
Locale architecture is prepared for `de`, `en`, `fr`, `it`, `es`, `nl`, `pl`, `pt`. The German copy is authoritative in this first build. Manual choice is stored locally and overrides browser preference. Currency remains EUR (€).

## Domain direction
Future public primary domain: `aurentarasystems.com`.
Group / ownership domain: `ysrio.com`.
No production domain, DNS or traffic switch is authorized by this project.

## Intake safety
The V1 staging form validates locally only. It deliberately performs no provider write and sends no personal data anywhere. A real backend/provider integration is a separate user gate.

## Analytics
The page currently emits the existing local `riosystems:analytics` CustomEvents. This namespace is intentionally treated as internal technical infrastructure and is not customer-facing. No analytics SDK is loaded by this project. Existing RIOSYSTEMS/PostHog infrastructure can attach a privacy-safe adapter later instead of duplicating analytics infrastructure.

## Accessibility
Target: WCAG 2.2 AA. Includes semantic landmarks, skip link, focus states, reduced motion, keyboard-operable dialog/navigation, accessible labels and non-color-only communication.

## Performance
No framework, no autoplay video, no remote fonts, no heavy animation library. Visuals use CSS/SVG and progressive enhancement.

## Production
Production deployment is explicitly out of scope until separate user approval.