# Factory Requests

This folder is the control queue for ChatGPT-driven Project Factory jobs.

A new JSON file committed to the `factory-control` branch triggers `.github/workflows/factory-control.yml`.

Supported modes:

```json
{
  "mode": "generate",
  "project_name": "Example",
  "prompt": "Create a premium technology website"
}
```

```json
{
  "mode": "rebuild",
  "project_name": "Example Rebuild",
  "source_url": "https://example.com",
  "max_pages": 6
}
```

Each request is isolated in its own file. The workflow generates the project, creates a dedicated `factory/...` branch, opens a draft pull request and deploys a Cloudflare Pages preview. Production deployment remains approval-gated.
