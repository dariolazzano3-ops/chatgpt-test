# AURENTARA Web Execution Bridge V1

## Purpose

Connect the approved AURENTARA website work order to actual private WebFactory work without putting GitHub write credentials inside the Cloudflare Worker.

## Runtime flow

1. Owner prepares a website order in AURENTARA.
2. Existing durable mission preflight and approval gates remain authoritative.
3. After the owner approves staging execution, the Operator Runtime creates an idempotent `live_staging_run`.
4. The Web Execution Bridge marks that run `QUEUED`.
5. An outbound-only VPS poller claims the run using a short lease.
6. The poller resolves the project through the allowlisted project binding.
7. A bounded website executor changes only files inside that project's path.
8. Project acceptance runs before any preview deployment.
9. The candidate is pushed to an isolated `factory/aurentara-exec-*` branch.
10. A guarded GitHub workflow deploys the exact candidate SHA to the already-existing Cloudflare Access protected preview Worker.
11. Cloudflare Access is re-verified after deployment.
12. The poller completes the durable run with exact candidate SHA, QA result and private preview URL.
13. Project Preview Access reads that verified runtime result and makes the Preview available in AURENTARA.

## Security boundary

The Cloudflare Worker stores no GitHub credential. It only stores a dedicated random bridge bearer secret.

GitHub write authority remains on the private VPS through the existing authenticated `gh` CLI. The poller makes outbound HTTPS requests to the private bridge endpoint. No inbound VPS port is introduced.

Claims are lease-based and bounded to three attempts. An abandoned claim can be recovered after lease expiry.

## Project binding

The first authoritative binding connects:

- Operator scope: `gelato-donatello:gelato-donatello-website-v1`
- Current website source: `projects/gelato-donatello-premium-v6`
- Seed revision: `a723e0e193c6663ad98bddf9e61c1bafe46bbf02`
- Private preview Worker: `gelato-donatello-private-preview-v2`
- Private preview URL: `https://gelato-donatello-private-preview-v2.gelato-donatello-dario-a5a5376c.workers.dev`

The staging-only working branch accumulates successful private edits. It is not merged to `main` or `factory-control` automatically.

## V1 edit capability

V1 deliberately fails closed when an instruction cannot be transformed safely.

The zero-cost deterministic executor supports bounded website edits including the currently requested Gelato header-logo depth treatment, headline/CTA text edits, explicit accent color changes and mobile safety corrections.

For the logo-depth task, only CSS is changed. The logo image asset is not modified.

Unsupported instructions return `WEB_TASK_REQUIRES_ADVANCED_BUILDER` instead of inventing or pretending that work happened.

## Hard locks

The bridge does not authorize:

- production deploy
- public deploy
- DNS changes
- billing activation
- checkout
- public indexing
- automatic merge
- real end-customer data
- automatic paid overflow

Private preview deployment is the only deployment side effect of V1.
