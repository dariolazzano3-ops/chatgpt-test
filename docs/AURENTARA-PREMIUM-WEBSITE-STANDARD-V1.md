# AURENTARA PREMIUM WEBSITE STANDARD V1

## Purpose

AURENTARA Premium Website Standard V1 is a quality contract and evidence aggregator layered over the existing RIOSYSTEMS / AURENTARA Web Factory. It does not replace Web Operating System V2, riosystems.web-quality-score.v2, Project Source Intake, QA, Provider Routing, Cost Governance, Approval Governance, Project Delivery Gate or Launch Governance.

Canonical contract: \`aurentara.premium-website-standard.v1\`.

The five pillars are Strategy, Brand, Experience, Engineering, and Growth & Care. Evidence & Governance runs horizontally across all five.

## 100 point model

The score is weighted to exactly 100 points:

- Business Understanding 8
- Brand Foundation & Fit 6
- Content & Copy 10
- Information Architecture & UX 8
- Visual Design & Art Direction 10
- Conversion 8
- Trust 8
- SEO & Discoverability 7
- Performance 6
- Accessibility 7
- Technical Quality & Security 7
- Mobile & Responsive 5
- Legal / Rights Readiness 5
- Launch & Handover Readiness 5

Every required dimension carries a verification state. NOT_VERIFIED cannot be compensated by a high numerical score.

## Readiness projections

BUILD READY means the project has sufficient verified input to build without a known hard failure. It is not a delivery or launch approval.

CUSTOMER REVIEW READY requires score >= 80, all dimensions verified, no dimension below 60, all hard gates PASS, preview QA PASS, responsive QA PASS, and required review content present.

PREMIUM DELIVERY READY requires score >= 88, all dimensions verified, no dimension below 70, Brand, Content, UX, Visual, Conversion, Trust and Mobile each >= 80, every hard gate PASS, and the final human quality gate APPROVED_FOR_PREMIUM_DELIVERY.

PUBLIC LAUNCH READY additionally requires the Premium Delivery projection, the launch checklist PASS, and the existing Launch Governance READY/PASS. This projection never executes a deploy.

Existing Project, Mission, Delivery, Approval and Launch states remain authoritative.

## Hard gates

Hard gates include fabricated trust, reviews, qualifications, certifications or customer/project evidence; fake locations; critical source conflicts; blocked or unknown rights on published assets; broken primary conversion; critical accessibility or responsive failures; secret or PII leakage; critical security failure; tracking outside required consent; incorrect production indexing; critical canonical/redirect/route failure; missing public legal input; missing required customer or human approval; project isolation failure; and production action without existing operator approval.

Hard gates cannot be disabled by score override.

## Discovery, brand, assets and trust

\`evaluatePremiumDiscoveryReadiness\` extends the existing Project Source Intake as a read-only projection over its verified facts and assets. EXTRACTED or INFERRED research may support market, competitor and search decisions, but does not become a customer fact or trust claim without the existing verification states.

Brand paths are USE_EXISTING_BRAND, LIGHT_REFINE, and SEPARATE_BRANDING_REQUIRED. A separate branding requirement cannot be silently hidden by website delivery.

Asset quality uses VERIFIED, MISSING, OPTIONAL, LOW_QUALITY and NOT_APPROVED. Rights status remains a separate field. Missing central real imagery produces a Photo Brief, Shot List and Customer Asset Guide. Fake company photography is not accepted as real business evidence.

Trust evidence follows Claim -> Source -> Verification -> Placement.

## Information architecture and content

The premium path has no fixed minimum of five pages. If the approved information architecture has three justified pages, the Expected Page Set is three. Each page carries business purpose, audience, journey role, search intent, conversion role, trust role and rationale.

The legacy fallback still supplies a normal default page set when no explicit architecture is provided.

Copy quality is deterministic and checks specificity, value proposition clarity, claim provenance, objections, CTA clarity, brand voice, fact consistency, repetition, empty superlatives, generic filler and unsupported assertions. It does not claim to detect AI authorship.

## Conversion and art direction

Conversion evidence covers primary and secondary CTA, channels, contact friction, mobile CTA, form field rationale, confirmation, error states and trust near the CTA.

Art direction remains owned by Design Intent, Visual Contract, Reference Intelligence and Visual Fidelity. Premium Standard consumes their evidence and does not create a second design engine. Subjective visual quality is not auto-verified.

## SEO, Local SEO, performance, accessibility and privacy

Existing SEO and Local SEO modules remain authoritative. Industry profiles add requirements and risk warnings, not rigid sitemaps or layouts. Ranking guarantees, fake locations and doorway pages are prohibited.

Performance separates PRELAUNCH LAB evidence from POST-LAUNCH FIELD CWV. A lab run is never presented as field CWV. \`field_cwv_claimed\` remains false until real field evidence exists.

Accessibility targets WCAG 2.2 AA as an engineering target, not a certification. Existing automated checks are reused. Human primary-journey evidence covers keyboard, focus, form errors, navigation, semantic basics, screen-reader basics, zoom/reflow and touch interaction.

Legal/privacy states are CUSTOMER_INPUT, TEMPLATE, LEGAL_REVIEW_REQUIRED, CUSTOMER_APPROVED and TECHNICALLY_READY. Technical readiness is not legal advice or an attorney review.

## Human review, revisions, delivery and ownership

The final human question is: "WOULD A TOP PROFESSIONAL WEB STUDIO PUT ITS NAME ON THIS WEBSITE?"

Human review covers business relevance, brand fit, visual quality, individuality, copy, trust, conversion, mobile, polish, consistency, customer relevance and template/AI genericness, with desktop, tablet, mobile, small mobile, primary conversion flow and representative-page evidence. Automatic human approval is prohibited.

Revision classes are BUG, QUALITY_GAP, CONTENT_CORRECTION, REVISION and SCOPE_EXPANSION. BUG and QUALITY_GAP are not marked as paid customer revisions. SCOPE_EXPANSION never auto-executes.

Customer delivery is human-readable first. Ownership/handover covers domain, content, asset rights, source/export, analytics, Search Console, provider accounts, credential transfer, third-party licenses, care dependency and retention/deletion notes. Artificial vendor lock-in is prohibited.

Care states are PROJECT_INCLUDED, OPTIONAL and ONGOING_CARE. No care platform or new A/B-testing infrastructure is introduced in V1. Post-launch CRO requires sufficient real analytics.

## Industry profiles

The existing Industry Brain hosts five Premium V1 quality profiles: HANDWERK_LOCAL_SERVICE, GASTRONOMY, PRAXIS, B2B_SERVICE and PROFESSIONAL_SERVICES. Profiles define required inputs, trust/content/conversion patterns, SEO/local requirements, QA rules and risk warnings. They do not define a rigid sitemap, layout, design or template copy.

## Integration

Web Operating System V2 emits a Premium Standard evidence artifact and a human-readable customer-delivery summary while retaining \`riosystems.web-quality-score.v2\`.

Project Delivery Gate requires Premium evidence only for projects explicitly marked \`premium_website_standard_required\` or equivalent contract state. It does not create a second delivery gate.

The existing Operator Project Workspace exposes Premium state, score, dimension scores, hard failures, missing customer inputs/assets, trust, legal, performance, accessibility, SEO, human review, customer review and launch readiness.

## CI and safety

\`.github/workflows/aurentara-premium-website-standard-v1.yml\` runs syntax, the dedicated acceptance smoke, Web Factory V1, Framer/Fidelity, Autonomous Premium, Web OS V2, Project Source Intake, Project Workspace and the existing browser live-QA script against a local static server.

The workflow contains no deploy command, no DNS mutation and no paid provider call. Production remains false. Controlled Paid Staging is not modified. Gelato is not part of this implementation block.

## Known limitations

V1 does not fabricate human review, customer approval, legal review, field CWV or post-launch analytics evidence. Those remain NOT_VERIFIED until real evidence is supplied through the existing governed flows.

PUBLIC LAUNCH READY is evidence only. Existing Launch Governance and explicit operator approval remain mandatory for any later production action.
