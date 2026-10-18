# JARVIS Marketing Factory V2 | Verified execution & activation

Date: 2026-10-18. State: PRIVATE DEV. Production, paid providers, ad spend and external public posting OFF.

## Verified

- Reusable planning kernel plus dedicated LUNARA digital bedtime-story brand profile.
- Seven-day deterministic editorial backlog (Oct 19-25), five channel handoffs per day, zero actual posts.
- 22s original LUNARA test MP4 made from newly AI-generated art, slow motion graphics and synthesised ambient soundtrack. Video SHA-256: 824f056d411ba45f1788f3c2aec1fd8c0b0a5264f3bdcc0feb0c580bcefaab4b. Conversation artifact only, not hosted as public HTTPS media.
- Second 22s video render completed successfully on netcup VPS, with a synthetic local test background. SHA-256: 445f513acec6996538652d4e4a07c55255b6fe7fd5d31f826757d50ff36ddd24.
- Dedicated non-service runtime at /home/jarvis/marketing-factory-v2/.venv with Pillow 11.3.0, NumPy 2.2.6, imageio-ffmpeg 0.6.0. No system-wide changes or restarts.
- Social/Buffer adapter smoke PASS with mocked network: missing approval/token blocked, duplicate blocked, Snapchat manual, Buffer saveToDraft true, no public post.
- JARVIS operator, Hermes, and private Bridge remain running, but the V2 marketing task has not yet been wired to autonomous JARVIS mission dispatch.

## Execute tests

    node scripts/marketing-factory-golden-task-v1-smoke.mjs
    node scripts/social-dispatch-v2-smoke.mjs
    node scripts/marketing-backlog-v2-smoke.mjs

## Render in isolated VPS environment

From repository root, with an owned or approved image and the reviewed JSON plan:

    PATH="/home/jarvis/marketing-factory-v2/.venv/bin:$PATH" /home/jarvis/marketing-factory-v2/.venv/bin/python scripts/marketing-video-compositor-v2.py --plan projects/marketing-factory/drafts/lunara-2026-10-19.json --art /ABSOLUTE/OWNED_IMAGE.png --out /home/jarvis/marketing-factory-v2/lunara-final.mp4

Results stay PRIVATE unless separately released. No marketing daemon or production deploy started.

## Official social integration

Buffer GraphQL endpoint: https://api.buffer.com (see https://developers.buffer.com/examples/create-video-post.html).
Buffer expects a publicly accessible HTTPS video URL in assets.video.url. Existing video artifact is NOT a publicly hosted media URL.
Four available Buffer target types in this adapter: TikTok, Instagram, Facebook, YouTube Shorts.
Actual supported posting options need verified account/channel configuration and may require special metadata or manual review. Snapchat Spotlight remains a manual handoff.

Code offers prepareSocialHandoffV2 and tightly gated saveBufferDraftApprovedV2:
- A verified video SHA and exact plan ID must match an explicit owner approval.
- A brand-scoped channel ID and Buffer access token must be injected through an appropriate secret host, never hardcoded.
- Buffer mutation can only save an unscheduled draft with saveToDraft:true. No autopublish and no automatic retry.
- A draft ID is NOT evidence of a public post; public posts require separate provider receipts/status checks.

## Remaining mandatory activation gates

1. Owner approval of media quality, claims, rights, labeling and child privacy.
2. Stable hosted media URL, e.g. explicitly approved Cloudflare R2 media serving route.
3. Buffer account and LUNARA-specific social channel authorization. No active Buffer key/channel IDs were found in the tested isolated VPS environment.
4. Human-approved live draft and provider response, then a separately authorized test publication.
5. UTM and consent-safe Shopify attribution; no fabricated sales, views or financial metrics.
6. Independent daily runner (after GO) with idempotency, preapproved 7-day content buffer, retries, observability, budget limits and kill switch.
7. JARVIS program-controller binding, after verifying existing approval and Bridge policy for the isolated marketing workspace.

No merge to protected branches, paid AI video generation, public posting, DNS, billing, or service changes without approval. 
