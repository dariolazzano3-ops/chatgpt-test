# RIOSYSTEMS Automation Factory Provider Decision v1

Verified: 2026-08-29

## Decision

RIOSYSTEMS keeps automation intent, policy and supervision in its native Automation Factory. External workflow engines are replaceable runtimes.

- Primary control engine: `riosystems-native-automation`
- Primary external runtime for the current single-operator stage: `activepieces-cloud-free`
- Future self-hosted runtime: `activepieces-community`
- Paid connector fallback: `make-core`
- n8n default posture: `client-owned specialist`, not a shared RIOSYSTEMS client-hosting core
- Lightweight code/webhook runtime: `cloudflare-workers-free`

## Why Activepieces first

Activepieces Free currently includes unlimited flows, API access and a hard daily credit cap instead of automatic overage. That makes it useful for a safe staging bridge. The Community Edition core is MIT licensed and free to self-host, which gives RIOSYSTEMS a future ownership path, although Community Edition currently omits platform API access and several governance features.

The paid Plus tier is currently $16/month billed yearly and enables additional credits and BYO AI keys. It is not activated by this decision.

## Why Make is fallback

Make has a mature scenario API that can create, run, inspect and manage scenarios. API access starts on the current Core plan at $12/month for 10k credits. It is a strong connector fallback, but its credit-based SaaS model is not the default because RIOSYSTEMS wants lower lock-in and hard cost control.

## Why n8n is not the shared default

n8n is technically strong, but its licensing guidance states that hosting and managing client workflows and credentials in a shared internal n8n instance can require an Enterprise commercial license, while embedding requires an Embed license. RIOSYSTEMS therefore routes n8n primarily when the client owns the instance or a commercial license is intentionally approved.

## Cloudflare micro-automations

Small deterministic webhook transforms and code-first event handlers can stay directly on Cloudflare Workers, avoiding a full workflow platform when visual orchestration adds no value.

## Safety

Provider selection never activates or runs a real workflow. External execution still requires explicit external-write and supervised-execution approval. Paid overflow and production deployment remain disabled.

## Evidence

- Activepieces pricing: https://www.activepieces.com/pricing
- Activepieces license: https://www.activepieces.com/docs/about/license
- Activepieces install options: https://www.activepieces.com/docs/install/overview
- Make pricing: https://www.make.com/en/pricing
- Make Scenario API: https://developers.make.com/api-documentation/api-reference/scenarios
- n8n pricing: https://n8n.io/pricing/
- n8n licensing guidance: https://support.n8n.io/article/can-i-use-your-license-for-my-use-case
- Cloudflare Workers pricing: https://developers.cloudflare.com/workers/platform/pricing/
