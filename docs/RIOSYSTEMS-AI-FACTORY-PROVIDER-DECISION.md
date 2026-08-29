# RIOSYSTEMS AI Factory Provider Decision v1

Verified: 2026-08-29

## Decision

RIOSYSTEMS keeps model routing, retries, validation, budgets and audit policy in the native AI Factory. Inference providers remain replaceable.

- Primary paid intelligence provider: `openai-api`
- Default paid economy tier: `gpt-5.6-luna`
- Balanced escalation: `gpt-5.6-terra`
- Frontier escalation: `gpt-5.6-sol`
- Free staging/economy fallback: `cloudflare-workers-ai-free`
- Default free Workers AI model: `@cf/zai-org/glm-4.7-flash`

## Routing policy

Use the cheapest model that satisfies the mission quality requirement. Free Workers AI can handle appropriate staging, classification, extraction and low-risk generation before paid inference. OpenAI is used when quality, reasoning, structured output or coding requirements justify paid usage.

OpenAI's current official API page lists GPT-5.6 Luna at $0.20 / 1M input tokens and $1.20 / 1M output tokens, Terra at $2 / $12, and Sol at $4 / $20 under the current standard promotional rates. Prices must be reverified before real paid activation.

Cloudflare Workers AI currently includes 10,000 Neurons per day at no charge. On the Free Workers plan, exceeding the free allocation fails instead of automatically billing. Some resource-intensive models require a paid plan, so the default free model must stay on the verified free-model list.

## Budget posture

Every paid mission requires a mission-level budget and explicit paid-execution approval. RIOSYSTEMS does not automatically escalate from a free provider to a paid provider. Model escalation is a quality decision bounded by the operator budget policy.

## Safety

This decision does not create API credentials, execute inference, activate billing or deploy production. Runtime credentials remain secret references only. Production is a separate explicit approval boundary.

## Evidence

- OpenAI API: https://openai.com/api/
- OpenAI model documentation: https://developers.openai.com/api/docs/models
- Cloudflare Workers AI pricing: https://developers.cloudflare.com/workers-ai/platform/pricing/
- Cloudflare Workers AI model-plan changes: https://developers.cloudflare.com/changelog/post/2026-07-28-models-require-workers-paid/
