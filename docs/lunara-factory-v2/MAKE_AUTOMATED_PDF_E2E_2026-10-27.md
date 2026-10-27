# LUNARA V2 | Make PDF end-to-end verification | 27 Oct 2026

## Verified outcome
- Make on-demand scenario: 8208513 (LUNARA V2 | STORY→QA→PDF | SANDBOX NO EMAIL).
- New separate scenario with 27 modules, verified connected OpenAI and Google account permissions.
- End-to-end synthetic input: Nora, age 6, toy fox Fino, star painting, cloud-library dream world.
- Four executions (due to tool retry after an internal connector error), ALL FOUR successful, 25 Make credits/operations each, 100 total. Do not blindly retry.
- First confirmed execution id: e2aca03ba4d44d7699ede3db17efc7d1.
- QA result: true. Title: Nora in der Wolkenbibliothek der Sternenfarben.
- A new Google document was created with id 1jx6UNOye6RAfqCM9lFnk7ZgUxGjWYNkTRuj4BZwTW58.
- The Google Docs PDF export yielded a binary buffer of 69,790 bytes with %PDF header (hex 255044462d).
- Existing Google Slides template path still fails via the Make app's mergeTextArrayParameter/spec error.
- The earlier Google Drive copy action failed OAuth 403 insufficient authentication scopes. The Google Docs fallback succeeds using existing connected account.
- No Shopify, Gmail or external PDF-generation service in this Make scenario. No real emails.
- New PDF export exists as transient Make binary. It is NOT yet a durable/downloadable Drive PDF file.
- QA passed on synthetic data, not human visual layout QA.

## Safety and production blockers
- Main production scenario and all PDF-test scenarios remain inactive.
- Existing Stripe paid event→D1 transition still requires independent webhook validation.
- Create atomic order-id deduplication before triggering Make from a paid order. Four identical manual executions show why.
- Add secure durable PDF storage, access-controlled retrieval, retention, completion callback, and separate synthetic delivery test.
- Add visual layout QA and manage provider-usage costs before production.
