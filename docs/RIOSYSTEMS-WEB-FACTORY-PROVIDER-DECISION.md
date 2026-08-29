# RIOSYSTEMS Web Factory Provider Decision v1

Verified: 2026-08-29

## Decision

RIOSYSTEMS Web Factory uses a repository-first default instead of making a visual SaaS builder the permanent core.

- Primary build engine: `riosystems-native-web`
- Primary staging/hosting provider: `cloudflare-workers-free`
- Optional visual accelerator: `lovable-github`
- Optional platform-hosted visual specialist: `framer-server-api`
- Optional client-editable CMS specialist: `webflow-api`

This is a capability routing decision, not a permanent vendor lock. LEAN asks for capabilities and the Web Factory chooses the provider path.

## Why the native engine is primary

The repository already owns the Web Factory generation path (`builder.js`, `generator.js`, `materializer.js`, `preview.js`). Making that path primary preserves source-code ownership, GitHub as source of truth, provider portability and low fixed cost. Cloudflare is used as the preferred edge/staging host, not as the source-code owner.

Cloudflare Workers Free currently documents 100,000 requests/day and hard free-tier limits. Workers Paid starts at a $5 monthly account minimum. Pricing must still be reverified immediately before any paid activation.

## External builders

### Lovable

Lovable is the first optional accelerator because its official GitHub integration provides repository export and two-way synchronization. It is useful when visual iteration speed beats the native route. It must never replace GitHub as RIOSYSTEMS source of truth. Credit-based paid use remains approval-gated.

### Framer

Framer now has a Server API capable of updating and publishing projects programmatically. It is attractive for high-polish marketing sites and designer workflows, but RIOSYSTEMS treats it as a specialist because platform hosting and portability constraints may conflict with repository-first ownership. Use only when the mission explicitly values the Framer visual workflow over hosting independence.

### Webflow

Webflow provides Data and Designer APIs and can programmatically manage design/CMS workflows. Code export is tied to paid Workspace tiers and dynamic CMS content is not fully exportable, so Webflow is routed for client-editable CMS/design-system use cases rather than the default path.

## Safety gates

Selection does not authorize activation. Real staging writes require an explicit external-write approval plus supervised-execution approval. Custom-domain changes and production deployment remain separate approval boundaries. Automatic paid overflow is disabled.

## Evidence

- Cloudflare Workers pricing: https://developers.cloudflare.com/workers/platform/pricing/
- Lovable GitHub sync: https://docs.lovable.dev/integrations/github
- Framer Server API: https://www.framer.com/developers/server-api-introduction
- Framer pricing: https://www.framer.com/pricing
- Webflow APIs: https://developers.webflow.com/reference
- Webflow pricing: https://webflow.com/pricing
