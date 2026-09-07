# JARVIS Cloudflare Pages Activation V1

Status: ACCESS FOUNDATION ACTIVE / DEPLOYMENT GATED

Verified GitHub source before this activation update:
- branch: `factory/jarvis-personal-assistant-v1`
- exact source head: `a8f738e4110166d62e8941635fd0347fdf1d3ca7`

Cloudflare state supplied by the operator after the dedicated setup:
- Pages project: `jarvis-private-core`
- host: `jarvis-private-core.pages.dev`
- deployments: 0 at handoff
- production branch: `production-disabled`
- dedicated Access application: active
- dedicated Access audience: active and not reused
- owner-only Allow policy: active
- App Launcher: off
- HttpOnly Access cookie: active
- preview fail_open: false
- production fail_open: false
- custom domain: none
- `ysrio.com`: not used
- workers.dev: not used
- DNS: unchanged
- external writes: off outside the requested Cloudflare configuration

Repository activation contract:
- all real deployments are exact-source-sha pinned
- deploy target is preview branch `private-staging` only
- production deployment is forbidden
- Pages project and fail-closed settings are rechecked against the Cloudflare API before deploy
- required runtime secrets must already exist as encrypted preview bindings
- secret values are never printed or committed
- generic shared Cloudflare GitHub secret names are not accepted
- deploy credentials use only `JARVIS_CLOUDFLARE_API_TOKEN` and `JARVIS_CLOUDFLARE_ACCOUNT_ID`

Required encrypted Pages preview bindings before first deployment:
- `JARVIS_ACCESS_AUD`
- `JARVIS_ACCESS_TEAM_DOMAIN`
- `JARVIS_OPERATOR_EMAIL`
- `JARVIS_PERSONAL_MEMORY_SUPABASE_SERVICE_ROLE_KEY`

Google OAuth secrets are intentionally excluded from the first Pages deployment. Calendar OAuth activation remains a later bounded step.
