# LUNARA V2 — Make story handoff, protected importer and idempotency test

**Date:** 2026-10-28. **Environment:** synthetic-only private staging. **No customer data or real orders processed.**

## Concrete implemented changes
- Source: `src/lunara-factory-v2/make-story-qa-ingress.mjs`
- Existing isolated Worker: `lunara-v2-story-qa-import` (deployed, ES module) with a D1 binding only.
- One-time authenticated POST path: `/v1/import/<story_id>`. The expected input is a synthetic QA-passed story; accepts JSON or multipart form data, requiring `schema=lunara.story.qa.v1`, `mode=sandbox`, `qa_pass=true`, `synthetic=true`, `child_name`, `story_title`, `story_text` and optionally `ending_text`.
- Authorization header `X-Lunara-Story-Token` must be a one-use high-entropy token with only its SHA-256 value stored in `lunara_story_import_tokens` and an expiry.
- **Corrected atomic commit ordering:** `INSERT OR IGNORE ... SELECT ... WHERE EXISTS(valid unclaimed token)`, keyed by unique `story_id`, occurs *before* the token is marked claimed. On a failed story insertion, the token is not prematurely consumed. Replay or reused story ID cannot insert again.
- Source attribution is `make_qa_original` except an explicitly synthetic pipeline test using `source=synthetic_transport_test`. The preview remains owner-only and its UI is scoped to the user-supplied `original-mia` story.
- Old Make 90-module original: `5464576`, inactive and unchanged. Make V2 29-module sandbox: `8209196`, inactive and unchanged.

## Verified database behavior
Using a synthetic ID `lunara-bridge-qa-20261028-01` with a 10-minute token and made-up child/story data:
- token reservation in D1: **1 row**
- first guarded insert: **1 row**
- identical second insert: **0 rows**
- token consumption: **1 row**
- another attempt after token consumption: **0 rows**
- unissued story ID: **0 rows**
- stored row checked for synthetic source and text size
- both temporary test rows **deleted** after verification

**Result: PASS** for D1 idempotency logic.

## Still not done
- A new Make-to-Cloudflare handoff scenario was previously blocked by tool security checks; it was **not** created or activated, and this operation was not retried or routed around the restriction.
- The Cloudflare tool's direct HTTP fetch to this Worker is disallowed; **no network end-to-end authenticated import test was performed** in this run. API deployment and D1 state were verified through the Cloudflare account tool separately.
- This does not establish that the original Make post-QA story automatically appears in the iPad. Only the user-provided historical Mia story is currently rendered dynamically.
- Do not activate live Stripe, take money, send customer email, or route child information through the synthetic-only testing endpoint.
- Next authorized integration must start **after original QA and repair**, get its short-lived token from a trusted server-side order service, send the full original text and optional ending with a unique order/story ID, and only then expose an entitled story. Never use the preview browser as token issuer.

## Operator safety rule
Only use the permitted connected Make integration path after access is explicitly available; do not bypass tool or policy denials via another interface.
