# RIOSYSTEMS Web Factory V1

## Purpose

Web Factory V1 is the deterministic, provider-independent website production engine for the `web.build` capability. It builds reusable static multi-page website artifacts from a structured mission. It does not require OpenAI or another paid AI provider.

Pipeline:

`mission -> validation -> website blueprint -> design system -> content contract -> component composition -> multi-page render -> QA -> deterministic repair -> deployment artifact -> delivery manifest`

## Safety and cost invariants

V1 is fail-closed and staging-only:

- production deployment is always false;
- real customer data is false in this build path;
- custom domains and DNS changes are false;
- forms are disabled integration shells in staging;
- payments and external integrations are disabled;
- automatic paid fallback is false;
- deterministic variable cost is 0 EUR;
- staging pages use `noindex,nofollow` and a Cloudflare Pages `X-Robots-Tag` header;
- generated output stays inside `projects/<project-slug>/`;
- executable inline scripts and unknown external executable/media resources are blocking QA issues.

## Contracts and architecture

`contracts.js` validates `riosystems.web-mission.v1`. Critical missing information becomes an explicit requirement; safe defaults are recorded as warnings.

`planner.js` creates `riosystems.website-blueprint.v1` before rendering. Each page records purpose, audience, conversion goal, sections, content requirements, SEO intent and CTA strategy.

`content.js` creates structured content objects. Deterministic fixtures work without AI; a future AI provider can populate the same contract without changing the renderer.

`design-system.js` owns centralized colors, typography, spacing, radii, shadows, containers, breakpoints and control sizes. CSS is generated from these tokens.

The reusable component registry covers Header, Navigation, Hero, FeatureGrid, Services, About, Stats, Testimonials, Gallery, FAQ, CTA, Contact and Footer. Composition is selected by the blueprint, not by customer-specific code.

The baseline supports Home, Services, About, Contact and FAQ, extensible page types, and legal placeholders. Legal placeholders are never represented as approved legal advice or production-ready legal text.

## QA and automatic repair

`qa.js` emits `riosystems.web-qa.v1` with structure, content, responsive, SEO, accessibility, security and deployment categories. Blocking issues always fail the gate regardless of score.

The bounded repair loop only fixes explicitly deterministic defects. Unsupported defects remain blocking. The acceptance suite deliberately removes required staging metadata to prove:

`GENERATE -> TEST -> DETECT -> REPAIR -> RETEST`

It also injects a synthetic secret pattern to prove the security gate fails closed.

## Deployment and delivery

Each verified build creates `riosystems.web-deployment-artifact.v1` and `riosystems.web-staging-project.v1`. The target is `cloudflare-pages-preview`, while `deployment_authorized` remains false. External deployment is delegated to the separately governed Cloudflare staging path. No Web Factory code performs automatic production promotion.

Each build receives a build ID and logs mission receipt, planning, design, content, component selection, page generation, QA, repairs, deployment readiness and final status. Secret-like keys are redacted before logging.

`riosystems.web-delivery-manifest.v1` is the Dashboard-readable result with pages, design-system metadata, components, QA, repairs, deployment status, preview URL, production status, warnings and next actions.

## Provider strategy

Primary: RIOSYSTEMS native builder + GitHub + Cloudflare Pages preview.

Optional accelerator: Lovable.

Specialists: Framer and Webflow.

External builders are not required by the deterministic core and are never automatic paid fallbacks.

## Verification

Run `node scripts/web-factory-v1-smoke.mjs`.

The suite builds two deliberately different synthetic businesses, verifies multi-page generation and project isolation, exercises repair, checks deployment and delivery contracts, confirms 0 EUR variable cost, confirms production is disabled, and rejects fixture-specific logic in the core modules.
