# RIOSYSTEMS Zero-Cost Staging

The canonical `factory-control` runtime has a dedicated Cloudflare environment named `riosystems-staging`.

## Hard boundaries

- no production route or custom domain
- no production D1 binding
- no Workers AI binding before a separately approved cost-controlled AI block
- no external writes
- no secrets stored in Wrangler variables
- Workers Logs and tracing disabled for staging
- generic `npm run deploy` fails closed
- staging deployment requires an exact confirmation plus an independently configured zero-cost confirmation variable

## Commands

- `npm run deploy:staging:dry-run` validates and bundles without deployment.
- `npm run deploy:staging` can deploy only after all guard environment variables are present.
- `npm run deploy` is intentionally disabled for production safety.

## Current activation status

Configuration and dry-run validation may proceed automatically. Actual staging deployment remains blocked until the Cloudflare plan is verifiably zero-cost. The currently connected Cloudflare token cannot read account subscription details, so repository variable `RIOSYSTEMS_CLOUDFLARE_ZERO_COST_CONFIRMED` must not be set without independent confirmation.
