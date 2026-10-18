# JARVIS | Universal Marketing Factory V3

Date: October 19, 2026. State: **PRIVATE PREPARE / VPS EXECUTION ACCEPTED**. This is an isolated CLI task capability, not a live route in the protected JARVIS remote operator process. No social posting, ads, billing, DNS, production deployment or paid AI API calls.

## Confirmed

- Existing JARVIS 24/7 remote operator, Bridge process, and Hermes process observed on Netcup VPS. No modification or restart.
- Existing Cloudflare account has R2 bucket `riosystems-staging-transfer-d141a73c`. It belongs to shared RIOSYSTEMS staging and was **NOT** altered, publicly exposed, or used for LUNARA.
- New isolated task adapter: `src/marketing-factory/jarvis-marketing-task-v3.mjs`.
- CLI: `scripts/jarvis-marketing-operator-v3.mjs`, safe task allowlist: `plan_day`, `plan_week`, `render_private`, `status`. All other tasks rejected.
- Private VPS code snapshot (not a Git checkout): `/home/jarvis/marketing-factory-v2/worktree-v3`.
- Private media/job store: `/home/jarvis/marketing-factory-v2/job-state`. Product namespaces are per brand; no JARVIS/HAMYREN personal data access.
- Real, isolated render for LUNARA, October 19, 2026: 22-second MP4, 720x1280, local SHA-256 `445f513acec6996538652d4e4a07c55255b6fe7fd5d31f826757d50ff36ddd24`. Verified via SHA-256 + full FFmpeg decode. Artwork is **synthetic internal test artwork**, not approved launch art.
- Repeating `plan_day` does not overwrite an already verified video receipt. Verified by rerunning the CLI.
- A seven-day private backlog was prepared, without media publication.
- V3 unit smoke passed: unsafe task blocked, artwork rights gate, invalid brand/date, read-only Buffer account/channel checks with mock provider, and unbound provider reporting.
- No Buffer API key or authorized LUNARA channel IDs proven. The read-only checker cannot provide a real login session without the user's Buffer account.

## Execute the private task

Commands on the authorized VPS (already provisioned, do not run against unrelated repos):

    ROOT=/home/jarvis/marketing-factory-v2/worktree-v3
    node "$ROOT/scripts/jarvis-marketing-operator-v3.mjs" capabilities
    node "$ROOT/scripts/jarvis-marketing-operator-v3.mjs" plan_day lunara 2026-10-19
    node "$ROOT/scripts/jarvis-marketing-operator-v3.mjs" plan_week lunara 2026-10-19
    node "$ROOT/scripts/jarvis-marketing-operator-v3.mjs" status lunara 2026-10-19

For private rendering, put a rights-approved source image in the separate `/home/jarvis/marketing-factory-v2/job-state/approved-artwork/` directory and explicitly set `MARKETING_FACTORY_ARTWORK_RIGHTS_CONFIRMED=yes`. This means only the operator-approved source is eligible for private rendering, not publication.

## Production activation barriers

1. Connect real LUNARA social accounts to Buffer through the account owner's own login/consent. Buffer currently supports Instagram, TikTok, Facebook Pages, and YouTube Shorts. Buffer Free allows three connected channels. Snapchat not supported.
2. Make a brand-isolated media bucket and controlled HTTPS delivery route with approved data access and budget. Do not repurpose the RIOSYSTEMS staging bucket by default.
3. Store account tokens in a server secret host, never this public repository or GitHub PR.
4. Verify access with `inspectBufferAccountV3` and `inspectBufferChannelsV3`, restrict returned channels to the intended LUNARA brand account and confirm media upload validity.
5. Verify the first authorized Buffer *draft* via remote receipt, then obtain separate operator GO before publishing. Ensure any public media and content have product/claim/rights/child-privacy approval.
6. Only then implement a supervised and fail-closed daily scheduler, idempotency ledger, 7-day approved content buffer, status checks, retries and a kill switch. No scheduler is enabled here.
7. Attach the CLI to the existing JARVIS Bridge task dispatcher only through a separately approved, branch-scoped capability/approval binding. This repository branch alone does **not** bind the running JARVIS process.

## Not claimed

No direct JARVIS autonomous dispatch of this marketing CLI; current execution was invoked from the authorized remote tool. No actual social platform OAuth or account connection; no real Buffer API mutation; no CDN media publication; no public post or verified purchases; no background monitoring or automated daily execution.

## Tests

    node scripts/marketing-factory-golden-task-v1-smoke.mjs
    node scripts/social-dispatch-v2-smoke.mjs
    node scripts/marketing-backlog-v2-smoke.mjs
    node scripts/jarvis-marketing-operator-v3-smoke.mjs

The above tests are offline and make **zero** external social platform calls.
