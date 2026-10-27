# LUNARA V2 | Atomic claim → AI story → QA → private R2 PDF acceptance

Date: 2026-10-27. Sandbox only. No live payments, email or Shopify.

## Deployed architecture and proof
- Make Scenario 8209196: LUNARA V2 | ATOMIC CLAIM → AI STORY → QA → PDF → PRIVATE R2 | OFF. 29 modules, on-demand, inactive after tests.
- First filter requires schema=lunara.order.paid.v2, mode=sandbox, product=story_pdf.
- Before OpenAI, Make HTTP POST /v1/claim/<orderId> atomically inserts into lunara_production_claims with a UNIQUE PRIMARY KEY order_id. Duplicate attempt fails 409 without triggering OpenAI.
- Output is made with existing Make OpenAI/GPT + Google Docs create and PDF export. Binary PDF is PUT to a separate Cloudflare upload Worker with a one-time, SHA-256-backed token.
- Cloudflare upload Worker: lunara-v2-one-time-pdf-upload; repository source src/lunara-factory-v2/pdf-upload-one-time-worker.mjs. D1 binding DB and private R2 binding PDFS only.
- Claim tokens are generated only for synthetic staging via authorized Cloudflare tooling and saved as hashes in D1. Upload token revoked after single usage. No token stored in GitHub or printed in reports.
- D1 tables: lunara_pdf_jobs with unique order_id, object key and single-use upload token hash; lunara_production_claims with order_id unique. SQL committed to docs/lunara-factory-v2/staging-schema.sql.
- R2 bucket: lunara-v2-private-pdfs-eu, Standard storage. R2.dev managed domain disabled; no custom public domain. Prefix sandbox/ expires automatically after 30 days. The previous default abort-multipart rule remains.
- Owner-only Cloudflare Access private PDF review Worker: lunara-v2-pdf-review-private; repository source src/lunara-factory-v2/pdf-review-owner-only-worker.mjs. Anonymous GET of /health and PDF path returned 302 to Access login.

## Actual tests (not simulations)
1. Atomic D1 INSERT OR IGNORE test: first insert changed 1 row, same order ID again changed 0.
2. HTTP negative test: PDF upload with no token returned 403.
3. One-time synthetic upload test: 621-byte PDF PUT returned 201; replay of identical request returned HTTP 409; D1 status stored and R2 object metadata confirms existence.
4. Make 5-module claim/export/upload scenario 8209139: successful execution 10182cc0a75c4d9c9c8f7a8af8902f20, 3 Make credits. Cloudflare D1 row stored, private R2 object 69,790 bytes, claim count 1 and secret null.
5. Make full 29-module sandbox scenario 8209196: successful execution a3ec9466197c4bf6a59bde5541e41ade, 27 Make credits; QA=true. Story title 'Nora in der Wolkenbibliothek der leisen Farben'. Google Docs created source document and Make exported PDF; R2 object sandbox/lunara-e2e-stored-qa-20261027-01.pdf recorded with 72,872 bytes.
6. Simultaneous/repeated scenario_run call e5ccacf003fa4af6bacee8256f81f1c8 stopped with 409 Conflict at claim, just 2 Make credits; no repeated AI production.
7. All Make scenarios used in staging were left inactive. Original premium product scenarios not modified.

## Protected QA download
https://lunara-v2-pdf-review-private.gelato-donatello-dario-a5a5376c.workers.dev/v1/pdf/lunara-e2e-stored-qa-20261027-01

## Gates before customers
- The verified Stripe sandbox payment -> D1 automatic payment-status webhook remains separately unresolved; do not claim payment-to-delivery E2E completed.
- Currently one-time token issuance is manual with privileged Cloudflare tools, not yet integrated automatically into trusted paid-order flow.
- No Gmail customer delivery or outbox success callback implemented or tested.
- The PDF export was checked for %PDF header and actual R2 object existence, but the visual premium layout has not been independently reviewed against the legacy Slides template.
- Sandbox R2 objects expire after 30 days; D1 rows and Google Docs source files require separate data-retention and cleanup policies.
- A duplicate claim stops subsequent AI, but a failed single run needs secure manual review / explicit controlled retry; no automatic destructive reset is implemented.
- Privacy compliance for child data, contract/widerruf, imprint, monitoring and launch authorization remain open.
- Cloudflare R2 Standard free allowances are usage-based and not a guarantee of no charges if account quota is exhausted; no paid service upgrade was requested.
