# FollowClean | Apify Token Live Acceptance | 13 November 2026

## Scope
Read-only verification of user-created restricted Apify API token held as Cloudflare Secret FC_APIFY_TOKEN. No actor run, no follower list, no Instagram API scan, no billing request and no token value disclosed.

## Evidence
- Cloudflare Worker `followclean-mvp-preview` has `FC_APIFY_TOKEN` (secret_text), `FC_IG_SESSION_SECRET` (secret_text), `FC_APIFY_BUDGET_DB` (D1).
- Cloudflare Browser Rendering could invoke Worker safely. In-Worker outbound GET to Apify was initially a TypeError when `redirect:'error'` and explicit `cf` caching settings were used. Plain Worker `fetch` resolved network access.
- `GET https://api.apify.com/v2/users/me` with restricted token returned **403**. This commonly means insufficient account-level permission and does not by itself prove invalid credentials.
- `GET https://api.apify.com/v2/actors/lance_api~instagram-followers-following-scraper/runs?limit=1` returned **404**.
- Public `GET https://api.apify.com/v2/acts/lance_api~instagram-followers-following-scraper` resolved Actor ID **cwcr3CoSbucMVwFsF**.
- After retesting `GET https://api.apify.com/v2/acts/cwcr3CoSbucMVwFsF/runs?limit=1` with scoped token, the response remained **404**. Actor exists; the read-run permission for this token/account is not proven.
- Last one-shot test stored `state=complete, user_auth_http=403, actor_runs_http=404` in D1 diagnostics table, no API response body stored.
- Confirmed no `POST` to Apify and no billable Actor starts. Browser Rendering diagnostic calls may consume a small amount of the existing Cloudflare usage allowance; no new Cloudflare service contracted.
- Temporary `verify-once` endpoint, temporary `FC_APIFY_DIAG_KEY` Worker secret and temporary Cron schedule removed. No diagnostic code is present in the current Worker.
- Final worker release accepted at 100% by Cloudflare: `8fb68377-038e-4818-985d-ae6f0d64f4e4`.
- Existing ZIP analysis, Stripe sandbox, website and protections are unchanged.

## Outcome
- Cloudflare-to-Apify **network path verified** and two authentic Apify HTTP responses recorded.
- Authorization to read runs of the selected third-party Actor remains **NOT VERIFIED**.
- Correct immutable Actor ID is now used for the internal unpaid Apify dry-run plan. Paid execution flag remains false.
- No evidence of an actual follower relationship or Instagram profile photo; no unsupported live features exposed.

## Required next step
On Apify Console > Settings > API & Integrations, **edit Followclean restricted token permissions**:
1. In *Resource-specific permissions*, set Actor ID to `cwcr3CoSbucMVwFsF` instead of a copied slug if the token currently refers to `lance_api/instagram-followers-following-scraper`.
2. Select only Actor `Run` and `List runs` (as available). Do not expand to `Build`, `Write`, broad account permissions, or unrestricted running token scope.
3. Keep running Actors `Restricted access` and token expiry date 2026-12-13; only grant run-default-storage access once exact output-reading requirements are demonstrated.
4. Save token permissions. If Apify changes the token string on editing, update the secure `FC_APIFY_TOKEN` binding in Cloudflare without sharing the value in chat.
5. Only after successful permission read-test and explicit authorization for test profile should a real test be considered, with strict per-run and global caps plus legal review.

Source: https://docs.apify.com/api/v2/actors-runs-get and https://docs.apify.com/integrations/api .
