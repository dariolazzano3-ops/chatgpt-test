# Project Factory v1.5

Project Factory turns the existing ChatGPT Test infrastructure into a reusable website/app production layer.

## Modes

### GENERATE
Create a new website or app from a prompt, business brief, screenshots or structured requirements.

### REBUILD
Analyze a public existing website, extract business facts and information architecture, identify UX/SEO/conversion gaps, and create an improved independent rebuild brief. The goal is not to copy protected creative expression from third-party sites.

### EVOLVE
Improve an existing project without rebuilding from zero. Existing routes, APIs and project contracts are protected unless the requested change explicitly replaces them.

## Execution modes

- Manual: no autonomous loop. ChatGPT/user drives every step.
- Assist: one or a small bounded set of automated checks/iterations.
- Auto Loop: optional autonomous iterations with hard limits.

## Cost controls

Every plan supports:

- `max_iterations`
- `api_budget_eur`
- `auto_deploy`
- `require_approval_before_production`

Defaults are intentionally conservative: one assist iteration, zero API budget, no automatic production deploy, and production approval required.

## API

### GET /factory
Service metadata and endpoint discovery.

### GET /factory/capabilities
Supported modes, execution levels and safeguards.

### POST /factory/plan
Creates a deterministic execution plan before any expensive generation or external API work is performed.

GENERATE example:

```json
{
  "mode": "generate",
  "project": "example-shop",
  "prompt": "Build a premium local retail website",
  "limits": {
    "max_iterations": 1,
    "api_budget_eur": 0,
    "auto_deploy": false
  }
}
```

REBUILD example:

```json
{
  "mode": "rebuild",
  "project": "example-rebuild",
  "source_url": "https://example.com",
  "prompt": "Keep the verified business facts but improve mobile UX and conversion"
}
```

EVOLVE example:

```json
{
  "mode": "evolve",
  "project": "existing-project",
  "prompt": "Improve the mobile hero and keep all existing APIs"
}
```

## Next milestones

1. persistent project/job model in D1
2. website acquisition/scraper adapter for REBUILD
3. reusable project templates
4. GitHub project/branch adapter
5. preview deployment adapter
6. quality scoring and bounded iteration engine
7. optional AI provider adapter with per-job budget accounting
8. production approval and rollback gates

## Architectural rule

Classical software performs deterministic work such as routing, scraping orchestration, storage, validation, deployment and budget enforcement. AI is invoked only for tasks that require interpretation, generation or judgment. This keeps the Lean V3 cost profile low.
