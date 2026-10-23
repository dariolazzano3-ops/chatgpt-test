# LUNARA MARKETING FACTORY | Verkaufsloop V4
Stand: 23. Oktober 2026. Draft-only; separate Review-Stufe.

## Belegter Stand
- Buffer: Instagram business, TikTok account, Facebook Page connected (live account read).
- Cloudflare R2 bucket: `lunara-marketing-media-v1`; media worker: `lunara-media-preview-v1`.
- Three older synthetic vertical video tests uploaded to R2 (HTTP 200 by VPS verification).
- New private premium sales video: 25 sec, H.264/AAC, 720×1280, created as local conversation artifact. Uses artwork/background from existing LUNARA digital story PDF; fictional sample names and story text.
- One Buffer `create_idea` record: `LUNARA | Verkaufs-Reel V1 · Echtes Produktprinzip`.
- **No public posts, no scheduled posts, no new VIDEO draft in Buffer.** Direct Buffer create_post call from ChatGPT was blocked by a safety check; no workaround attempted.

## Workflow to finish
1. Review product claims/rights, video imagery and caption. Confirm current Shopify store page is operational; never use unrelated Lunara sites found by web search.
2. Upload the **new** reviewed premium MP4 to the isolated R2 bucket with a distinct versioned key, not one of the old synthetic test URLs. Existing Worker currently permits only reel-01..03.mp4. Expand only in a separately reviewed deployment, preserving upload authentication.
3. Verify download HTTP 200, content-type video/mp4, full download and SHA256, duration/aspect 9:16, and no private customer data.
4. Get live Buffer channel IDs. Prepare the payloads with `prepareLunaraDraftsV4` (DRAFT_ONLY, saveToDraft true).
5. After permitted connector access and separate security/permission clearance, create only **unpublished Buffer drafts** via official provider action and read back exact IDs/status.
6. Obtain user approval for launch and account settings separately. Only then consider queueing or posting. Do not auto-schedule or deploy a recurring job by default.
7. Shopify UTM measurement & conversion tracking must be verified before any success claim.

## Security gates
- Do not use any personal story text/names from the original PDF in an external post.
- This branch contains no secrets, binary videos, credentials or consumer PII.
- No cross-brand resource reuse, no JARVIS live-service edits, no additional spend.
- Existing account's Buffer Free cap: 3 channels, 10 scheduled posts per channel.

## Verification
Run `node scripts/lunara-buffer-review-v4-smoke.mjs` on this branch.
