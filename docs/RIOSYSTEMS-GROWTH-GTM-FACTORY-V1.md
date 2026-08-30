# RIOSYSTEMS Growth / Go-to-Market Factory V1

## Role

The Growth Factory is the provider-neutral strategic intelligence layer above the growth lifecycle. It owns market understanding, ICP, positioning, offer architecture, messaging, channel portfolio, campaign strategy, content/SEO/local strategy, reputation, funnel/CRO analysis, attribution interpretation, experiments, learning, prioritization and delivery manifests.

It does **not** own website implementation, AI inference, automation execution, CRM truth, analytics event storage, paid media activation or public publishing.

## Pipeline

`BUSINESS MISSION -> MARKET UNDERSTANDING -> ICP -> POSITIONING -> OFFER -> MESSAGING -> CHANNEL STRATEGY -> CAMPAIGNS -> CONTENT -> SEO/LOCAL -> REPUTATION -> ACQUISITION -> CONVERSION -> ANALYTICS -> EXPERIMENTS -> OPTIMIZATION -> DELIVERY`

## V1 modules

- `contracts.js`: GTM mission compiler, evidence, campaign/content/keyword/UTM/experiment/delivery contracts and hard governance.
- `market.js`: market intelligence, segments, ICP prioritization, JTBD, customer language, competitor intelligence, competitive maps, differentiation, industry/geographic intelligence and localization.
- `strategy.js`: positioning variants, offer validation, pricing model strategy, value proposition, messaging hierarchy, channel portfolio, acquisition, campaign planning, budget strategy, zero-budget mode and paid readiness.
- `acquisition.js`: content, SEO, topic clusters, SEO-to-Web contract, local growth, Google Business strategy integration, reputation, social proof, funnel/landing/CRO, lead magnets, referrals, partnerships, outbound and sales enablement.
- `analytics.js`: event taxonomy, attribution, UTM-compatible metrics, KPI registry, funnel analytics, growth health, diagnostics, bottleneck/next-best-action, unit economics and lifecycle growth.
- `experiments.js`: experiment prioritization/validation, learning loop, project-scoped knowledge, strategy versioning, change impact, blast radius and future watch contracts.
- `cross-factory.js`: provider-neutral contracts to AI, Web and Automation, and read-only inputs from Business/CRM and Analytics.
- `recipes.js`: nine deterministic recipe seeds: local service, consulting, agency, restaurant, real estate, SaaS, professional services, hospitality and ecommerce-light.
- `quality.js`: strategy quality gate, deterministic GTM readiness, recommendation/operator contracts, reputation risk and production safety gate.
- `index.js`: orchestration entry point plus synthetic market mode and full Growth Delivery Manifest assembly.

## Evidence discipline

External market claims are represented through `riosystems.market-evidence.v1`. Market fields explicitly distinguish `KNOWN`, `INFERRED`, `ASSUMED` and `UNKNOWN`. V1 synthetic fixtures are always `ASSUMED` and never presented as live market facts. Search volume and price amounts are not fabricated.

## Cross-factory ownership

- Web Factory implements landing pages, website surfaces, SEO pages and experiment surfaces.
- AI Factory performs inference and content generation requested by Growth.
- Automation Factory decides and executes approved follow-up/review/referral actions.
- Business / CRM Factory remains source of truth for leads, qualification, deals, customers and revenue. Growth cannot mutate CRM state.
- Analytics / PostHog owns event storage and observed behavior. Growth consumes only the data needed for strategy and diagnostics.

Shared correlation fields are `project_id`, `correlation_id`, `campaign_id`, `lead_id` and `experiment_id` when available.

## Safety and cost governance

V1 is hard-gated to:

- Production: false
- Real customer data: false
- Automatic paid ads/provider usage/overflow: false
- Real campaign activation/ad spend: false
- Mass email/cold outreach execution: false
- Money movement: false
- Fake or manipulated reviews: false
- False marketing claims: false
- Unlicensed competitor asset reuse: false
- Cross-project data access: false
- Automatic public publishing or production experiments: false
- Variable development cost ceiling: 0 EUR

## Synthetic acceptance

`scripts/growth-gtm-factory-v1-smoke.mjs` covers the required engines/contracts and the twelve reference scenarios A-L. It validates project isolation, zero-cost operation, provider neutrality, no external writes and no production activation.

The repository-wide `CI` workflow remains the regression authority for the existing Factory stack. The dedicated Growth workflow adds syntax, fixture, safety and Growth acceptance checks without changing shared core files.
