# Project Factory V3

Project Factory V3 adds a chat-driven control channel on top of the existing Factory generator and Cloudflare preview system.

## Control flow

1. ChatGPT creates a JSON request in `factory-requests/` on the `factory-control` branch.
2. `.github/workflows/factory-control.yml` detects the request.
3. `scripts/factory-control.mjs` generates or rebuilds the requested project.
4. The Factory writes the project to a dedicated `factory/...` branch and opens a draft pull request.
5. Factory Control validates the generated project and the repository JavaScript.
6. Factory Control deploys the generated project to the shared Cloudflare Pages preview project.
7. The generated commit receives the `factory-control/preview` success status and the draft pull request receives the real preview URL.
8. Production deployment remains manual and approval-gated.

## Safety rules

- Factory requests never deploy production directly.
- Generated output must stay below `projects/`.
- `index.html`, `styles.css`, and a valid `project.json` are required before preview deployment.
- Root JavaScript checks must pass before preview deployment.
- Every successful preview gets a commit status that is independent of a second workflow being triggered by the Factory bot.

## Request modes

### Generate

```json
{
  "mode": "generate",
  "project_name": "Example",
  "prompt": "Create a premium technology website",
  "production_deploy": false
}
```

### Rebuild

```json
{
  "mode": "rebuild",
  "project_name": "Example Rebuild",
  "source_url": "https://example.com",
  "max_pages": 6,
  "production_deploy": false
}
```

## Current V3 milestone

The first end-to-end chat control smoke request successfully created a generated branch, draft pull request and Cloudflare Pages preview. The V3 hardening step makes Factory Control itself the authoritative validation and preview gate for generated branches.
