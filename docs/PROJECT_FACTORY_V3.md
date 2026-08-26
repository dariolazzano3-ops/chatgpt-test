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

## Project Editing Mode

After a Factory project is created or explicitly selected, ChatGPT treats it as the active project until the user switches projects, creates a new project, or ends the editing session.

### Routing rules

- Natural-language modification requests such as `make the hero darker`, `make the rocket larger`, `add pricing`, or `change the animation` are edits to the active project's source code.
- Editing requests must target the active `factory/...` branch and the existing project folder under `projects/`.
- An editing request must not create a new project unless the user explicitly asks for a new project.
- An editing request must not invoke image generation merely because it contains visual language. Image generation is used only when the user explicitly asks to create/generate a standalone image or an image asset is deliberately required for the website implementation.
- Every committed project edit automatically triggers Factory Preview through changes under `projects/**`.
- The same preview alias remains the canonical review URL for the active project, so iterative edits update one review destination.
- Production remains disabled during editing. A production deployment requires an explicit production instruction and the existing approval gate.

### Active project state

The editing session tracks at minimum:

- project name and project slug
- `projects/<slug>` source path
- active `factory/...` branch
- draft pull request
- canonical Cloudflare preview alias
- production state

For the current V3 editing smoke project, the active state is:

```text
project: Aetheron AI
slug: aetheron-ai
source: projects/aetheron-ai
branch: factory/aetheron-ai-1787769583100
pull request: #46
preview: https://factory-aetheron-ai-17877695.chatgpt-factory-preview.pages.dev
production: disabled
```

### Editing loop

```text
chat instruction
  -> resolve active project
  -> modify existing project source
  -> commit to active factory branch
  -> CI validation
  -> automatic Factory Preview deployment
  -> review at canonical preview URL
  -> next chat instruction
```

This makes the default V3 interaction an iterative `Chat -> Edit -> Validate -> Preview -> Edit` loop rather than a sequence of disconnected generation jobs.

## Current V3 milestone

The first end-to-end chat control smoke request successfully created a generated branch, draft pull request and Cloudflare Pages preview. Factory Control is the authoritative validation and preview gate for generated branches. Auto-preview now also reacts to normal project edits, and Project Editing Mode defines how follow-up chat instructions remain attached to the active Factory project while production stays approval-gated.
