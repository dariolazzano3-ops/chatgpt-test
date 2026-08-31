# ChatGPT Test Worker

## Canonical brand & ownership identity

The repository currently separates business identity from technical identity:

- **YSRIO GROUP**: strategic parent / ownership brand in the background. This does not assert that a legally incorporated multi-company group already exists.
- **AURENTARA SYSTEMS**: visible operative Business Systems brand for customers, website, offers, communication, and the private Operator Control Plane.
- **RIOSYSTEMS**: existing internal technology foundation, including stable schemas, APIs, workflows, Factories, routers, approvals, execution, quality, cost and delivery layers.

Canonical naming and migration rules: [`docs/BRAND_OWNERSHIP_ARCHITECTURE.md`](docs/BRAND_OWNERSHIP_ARCHITECTURE.md).

Version 1 is the ChatGPT Plus-compatible operating path for this project.

## Architecture

ChatGPT -> GitHub -> GitHub Actions CI -> Cloudflare Builds -> Worker

The custom MCP endpoint remains in the codebase as the prepared Version 2 layer for a future ChatGPT Business setup.

## Branch flow

- `develop` - integration work
- `staging` - Cloudflare preview/staging validation
- `main` - production

Standard release path:

1. Make changes on a feature branch.
2. Merge into `develop` after CI passes.
3. Promote validated changes to `staging`.
4. Run smoke tests on staging.
5. Promote the exact validated release to `main`.
6. Verify the Cloudflare production deployment and repeat smoke tests.

## CI safety gate

GitHub Actions runs on `develop`, `staging`, and `main` and checks:

- JavaScript syntax via `npm run check`
- Cloudflare Worker bundling via `npx wrangler deploy --dry-run`

A failed CI run must block promotion to the next environment.

## Smoke tests

Validate these endpoints after staging and production deployments:

- `GET /health`
- `GET /db-check`
- `GET /openapi.yaml`
- `/mcp` reachability

For authenticated API or MCP calls, never paste secrets into commits, screenshots, issues, or chat messages.

## Production URL

`https://chatgpt-test.gelato-donatello-dario-a5a5376c.workers.dev`

## Version naming

- Version 1: ChatGPT Plus workflow through GitHub and automatic Cloudflare deployment
- Version 2: direct ChatGPT-to-custom-MCP control when a compatible ChatGPT Business setup is used

## Daily operating rule

For normal changes, the intended workflow is: describe the change in ChatGPT, let ChatGPT prepare the GitHub change, validate through CI and staging, then promote to production only after the staging smoke tests pass.
