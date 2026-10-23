# LUNARA AUTOPILOT V1 · SMALL PILOT (2026-10-23)

## Purpose
One 25-second daily vertical sales Reel for LUNARA. Only 5 seconds of generated cinematic video from Runway Gen-4 Turbo, plus owned LUNARA logo, verified product PDF preview, German voiceover, subtitles, and licensed soundtrack. Distribute to Instagram, TikTok and Facebook via Buffer **only after test and written approval**.

This branch does **not** implement an unattended publisher, does **not** configure cron and makes **no external provider calls on its own**. No secrets, media binaries or customer data committed. Existing JARVIS service untouched.

## Verified current state
- Existing Buffer organization **My organization**: all three LUNARA social accounts connected on 2026-10-23.
- Cloudflare isolated R2 bucket/Worker already exist for earlier **synthetic** clips, not the new premium original-asset Reel. R2 delivery is public by design only for reviewed media.
- Runway ChatGPT plugin status not installed/connected as of 2026-10-23; no RUNWAYML_API_SECRET found in the isolated process env.
- BUFFER_API_TOKEN not available in isolated process environment; Buffer ChatGPT connection does **not** imply a transferable Buffer API key.
- No verified final Shopify product URL. `https://lunara-geschichten.de/` failed TLS handshake and previous `https://lunara-10245.myshopify.com/` returned HTTP 404 from VPS at review time; investigate current store domain and products.
- Actual original LUNARA logo and approved voiceover file have **not** yet been found, imported, or verified.
- Earlier Buffer video draft creation through ChatGPT connector was blocked by a security check; do not circumvent that decision.

## Implemented
- `src/marketing-factory/lunara-autopilot-pilot-v1.mjs`:
  - deterministic daily 7-topic creative planner, each 25 seconds;
  - Runway `gen4_turbo` image-to-video request and opt-in API submitter;
  - only 5/10-second clips with owned source PNG/JPEG data URI;
  - generation reservation ledger, up to two attempts/day, at most $0.50/day and $10/month in **local planned Runway requests**; provider billing remains authoritative;
  - official Buffer post payloads for three verified LUNARA channels, default `saveToDraft=true`. Queue prep requires extra approval, verified shop, QA and permission.
- `scripts/lunara-autopilot-pilot-v1-cli.mjs`: offline `plan` and `status` only. Exits code 2 if preflight not ready.
- `scripts/lunara-autopilot-pilot-v1-smoke.mjs`: mock provider/network tests, zero external generation or posts.

## Minimum next execution sequence (no long new infrastructure build)
1. In Runway developer portal, confirm the account's separately billed API credits and manually provision secret `RUNWAYML_API_SECRET` in the isolated JARVIS service's secret store. Do not paste credentials into chat or commit them.
2. In Buffer API settings, create an API key and store it securely as `BUFFER_API_TOKEN` on the isolated runner; inspect provider write permissions, honour any denied connector action. Avoid introducing personal keys into git or logs.
3. Verify the current Shopify sales landing page/checkout is HTTPS reachable. Set one verified product URL with UTM parameters and confirm lawful product marketing.
4. Import exact LUNARA original logo, authentic product PDF sample with fictional details, and licensed German voiceover. Confirm media rights before enabling generation.
5. Execute **one** manually approved 5-second Runway image-to-video job (est. 25 credits, $0.25) via provider API, check task completion, render the full 25-second video and QA inspect.
6. Make **one** test Buffer video draft, read it back, then test single public scheduled post only after approved.
7. Only after all checks pass, add scheduler at once daily with fail-closed monitoring and an operational kill switch; turn on autopost only if user wants it after test.

## Smoke commands
```sh
node scripts/lunara-autopilot-pilot-v1-smoke.mjs
node scripts/lunara-autopilot-pilot-v1-cli.mjs plan 2026-10-23 0
node scripts/lunara-autopilot-pilot-v1-cli.mjs status 2026-10-23
```
Status must report NOT_READY until prerequisites are truly met. No production env or service changes until next explicit deployment GO.

## Cost scope
Runway Gen-4 Turbo 5 credits/sec, API credit $0.01, thus $0.25 per 5s clip before VAT. No guarantee retries or other fees are included in $10; billing must be monitored separately. Creator API and Runway web-app plan credits are separate.
