# RIOSYSTEMS Automation Factory Provider Decision v1

Verified: 2026-08-29

## Decision

RIOSYSTEMS keeps automation intent, policy and supervision in its native Automation Factory. External workflow engines are replaceable runtimes.

- Primary control engine: `riosystems-native-automation`
- Primary external runtime for the current single-operator stage: `make-core`
- Strategic secondary runtime: `activepieces-cloud-free`
- Future self-hosted option: `activepieces-community`
- Technical specialist runtime: `n8n-client-owned`
- Lightweight code/webhook runtime: `cloudflare-workers-free`

## Why Make first

The operator already uses Make, so choosing it as the primary external automation runtime reduces activation friction and lets RIOSYSTEMS focus on business workflows immediately instead of adding another platform before it is needed.

Make is the default for broad business automation such as CRM, email, forms, shops, spreadsheets, lead routing and connector-heavy workflows. RIOSYSTEMS still owns the mission, policy, approval, audit and cost gates, so Make remains a replaceable execution engine rather than becoming the system of record.

Make can create usage costs. Provider connection, paid execution and every real external write therefore remain separately gated. Automatic paid overflow is disabled.

## Activepieces as strategic second motor

Activepieces stays in the architecture because it provides an open-source path and a future self-hosting option. We activate it when ownership, portability or self-host control becomes more valuable than the speed advantage of the existing Make setup.

## n8n as technical specialist

n8n is reserved by default for complex API, code-heavy and developer-oriented workflows, preferably on a client-owned instance when client workflows or credentials are involved. It is not required for the first RIOSYSTEMS operating stage.

## Cloudflare micro-automations

Small deterministic webhook transforms and code-first event handlers can stay directly on Cloudflare Workers, avoiding a full workflow platform when visual orchestration adds no value.

## Routing policy

Default: `RIOSYSTEMS Automation Factory -> Make`

Strategic secondary: `RIOSYSTEMS Automation Factory -> Activepieces`

Technical specialist: `RIOSYSTEMS Automation Factory -> n8n client-owned`

Micro flow: `RIOSYSTEMS Automation Factory -> Cloudflare Workers`

## Safety

Provider selection never activates or runs a real workflow. External execution still requires explicit external-write and supervised-execution approval. Paid execution requires an explicit cost approval. Automatic paid overflow and production deployment remain disabled.

## Evidence

- Operator decision: 2026-08-29, Make selected as primary because it is already part of the operating toolset
- Make pricing: https://www.make.com/en/pricing
- Make Scenario API: https://developers.make.com/api-documentation/api-reference/scenarios
- Activepieces pricing: https://www.activepieces.com/pricing
- Activepieces license: https://www.activepieces.com/docs/about/license
- n8n pricing: https://n8n.io/pricing/
- n8n licensing guidance: https://support.n8n.io/article/can-i-use-your-license-for-my-use-case
- Cloudflare Workers pricing: https://developers.cloudflare.com/workers/platform/pricing/
