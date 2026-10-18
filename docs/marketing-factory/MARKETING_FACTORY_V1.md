# JARVIS | Universal Marketing Factory, Golden Task V1

**State:** PREPARE_ONLY candidate in isolated GitHub feature branch. No marketing bot is deployed or autonomously publishing. Nothing was changed in the running JARVIS/Bridge/Hermes services.

## What this actually builds

A reusable deterministic content-planning capability accepting brand-specific product profiles. The first profile is **LUNARA**, personalized digital bedtime stories for children aged about 2-7, delivered as PDF with optional read-aloud audio. NOT a printed book, NOT a medical sleep aid.

V1 generates one 22-second 9:16 video storyboard (four shots), a hook, concept, clear call-to-action, and separate draft captions for TikTok, Instagram, Facebook, YouTube Shorts, and Snapchat Spotlight. Different dates and creative indexes select different angles; the same inputs produce the same plan ID.

## Execute smoke test

From repository root:

    node scripts/marketing-factory-golden-task-v1-smoke.mjs

Pass criteria: five channel drafts, deterministic IDs, 4-scene outline, invalid date and brand rejection, no fabricated analytics, no media claimed as generated, and no publish allowed even if caller reports all approvals/connections.

## Safety requirements

- The V1 module calls no network, AI/video provider, scheduling service, publishing API, or Shopify endpoint.
- Never claim any posts, generated media, views, orders, or real sales without independently verified provider receipts.
- No costs, advertisements, public release, production deploy, changes to VPS services, or auto-publishing.
- Human review of brand claims, copyright, child imagery and AI/media labels. No identifiable child data or customer order data in public content.
- Separate brand profiles, provider permissions and assets. Do not use JARVIS or HAMYREN private memory for marketing.
- JARVIS stays orchestrator. Reuse existing Bridge, approval gate and audit systems. No second privileged execution plane.
- Snapchat publishing is account/API-dependent: default to manual handoff until an official authorized route is proven.

## Next acceptance gates

1. G1 COMPLETE ON BRANCH: content plan only, static unit smoke, zero external writes.
2. G2 PENDING: choose/licence AI media provider, authorize costs, render first actual owned/right-cleared LUNARA video + still image, review quality and claims.
3. G3 PENDING: verify social account/API permissions; schedule owner-approved TikTok/Instagram/Facebook/YouTube Shorts drafts, Snapchat via supported route or manual handoff; record real platform IDs/URLs.
4. G4 PENDING: opt-in daily scheduler, seven-day approved content buffer, failure retries, idempotency, verified publication checks, and privacy-safe Shopify/UTM attribution.

**G1 is not end-to-end marketing automation.** End-to-end success requires a real, approved live post and independently observed results. This candidate cannot publish under any configuration.
