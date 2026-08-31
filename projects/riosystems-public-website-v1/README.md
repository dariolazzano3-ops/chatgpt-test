# AURENTARA SYSTEMS Public Website V1

## Status
Implementation branch for the public AURENTARA SYSTEMS website. The legacy project path `projects/riosystems-public-website-v1` is intentionally retained as an internal technical identifier to avoid a disruptive rename. This project is isolated from the private Operator Dashboard and RIOSYSTEMS runtime.

Canonical brand / ownership source of truth: [`../../docs/BRAND_OWNERSHIP_ARCHITECTURE.md`](../../docs/BRAND_OWNERSHIP_ARCHITECTURE.md).

## North Star
- 70% clarity and trust
- 20% premium authority
- 10% wow

Primary positioning: **WE BUILD THE SYSTEMS BEHIND YOUR BUSINESS.**

## Public flow
Understand → Plan → Build → Connect → Validate → Launch → Improve.

## Architecture
Static, dependency-free V1:
- `index.html`: semantic homepage and staging-only project intake
- `styles.css`: design tokens, responsive system and reduced-motion rules
- `app.js`: progressive enhancement, mobile navigation, reveal motion, locale preference and privacy-safe analytics event hooks
- `robots.txt`, `sitemap.xml`: SEO readiness placeholders

The central Core visual is CSS + SVG. No WebGL dependency is required for V1.

## Naming boundary
Customer-facing presentation uses **AURENTARA SYSTEMS**. Existing internal identifiers such as `riosystems:analytics`, the folder/slug, schemas and RIOSYSTEMS runtime terminology remain technical implementation details until a separate technical migration has a concrete benefit.

YSRIO GROUP is the strategic parent / ownership brand and is not presented here as a legally incorporated multi-company group.

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
