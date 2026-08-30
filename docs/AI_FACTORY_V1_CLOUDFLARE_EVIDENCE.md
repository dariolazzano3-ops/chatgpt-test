# AI Factory V1 - Cloudflare Workers AI staging evidence

Verified: 2026-08-30

Scope: one minimal synthetic inference only. No customer data. No Production. No paid overflow.

Provider: Cloudflare Workers AI

Model: `@cf/zai-org/glm-4.7-flash`

Request intent: synthetic connectivity/inference proof with a maximum of four completion tokens.

Observed response:

- HTTP status: `200`
- API success: `true`
- prompt tokens: `10`
- completion tokens: `4`
- total tokens: `14`
- neurons reported by provider: `0.2006`
- errors: none

Cloudflare documentation checked on the same date states that Workers AI includes a daily free allocation of 10,000 Neurons and that Workers Free does not bill overage; requests fail after the free allocation instead of automatically creating paid usage. The selected model is listed as available on Workers Free.

Factory interpretation:

- `cloudflare-workers-ai` may be marked `zero_cost_verified=true` for synthetic staging when the surrounding runtime/account policy still guarantees hard fail above the free allocation.
- `data_sensitivity=customer` and `data_sensitivity=sensitive` remain blocked by AI Factory V1 hard safety.
- Automatic paid overflow remains `false`.
- OpenAI paid execution remains separately gated and disabled while the global variable-cost ceiling is `0 EUR`.

The model response content is not used as a product-quality evaluation. This evidence verifies only provider connectivity, permission, execution, and tiny free-tier usage.
