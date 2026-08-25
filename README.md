# chatgpt-test

Cloudflare Worker project managed through a protected GitHub delivery flow.

## Delivery flow

`feature branch → develop → staging → main → Cloudflare`

- `develop`: integration branch for active development
- `staging`: validation branch with a Cloudflare preview URL
- `main`: protected production branch

## Runtime checks

- `/` returns the service summary
- `/health` returns JSON health data for deployment verification

## Secrets

Never commit real credentials or API keys.

- Local development: copy `.dev.vars.example` to `.dev.vars`
- Cloudflare runtime: store sensitive values as Worker secrets
- Non-sensitive configuration may be stored as runtime variables

The `.gitignore` blocks common local secret files and build artifacts.
