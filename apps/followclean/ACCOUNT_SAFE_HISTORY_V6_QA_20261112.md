# FollowClean | Account-safe Private History V6

**Release scope:** `apps/followclean/index.html` on branch `factory/followclean-mvp-v1-20261109`
**Date:** 2026-11-12

## Implemented

- Manual Instagram account name input associated with the **current uploaded export**. The account cannot be reliably determined from the followers/following JSON alone; this is a **user assertion**, not verified login.
- Explicit account label included on newly saved local history snapshots only after the existing opt-in consent.
- Existing legacy snapshots without account labels remain saved and appear as **not assigned**. No automatic migrations, guesses or account linkage. The owner can explicitly assign an unassigned snapshot only after entering the current account name, ticking the same-account confirmation, and approving a confirmation dialog.
- History SVG chart filters snapshots exclusively to the selected current account. An unrelated account's snapshots are never joined into the chart.
- Saved historical comparisons require a valid **matching account label** plus the same-account confirmation. Wrong-account and unassigned snapshots have disabled Compare buttons.
- Direct older ZIP comparison now also requires a manually entered current account name and an explicit same-account assertion. The ZIP comparison itself remains local and ephemeral. A mid-import account change invalidates the comparison request.
- Changing account identity clears the previous comparison and confirmation. Loading a new ZIP **clears the prior account selection** to prevent accidental reuse.
- Backups preserve optional snapshot account labels; legacy backups without labels continue to import. Invalid account labels in imported JSON are rejected. Backup deduplication is account-aware.
- Same 4-snapshot device-wide limit remains. No additional accounts, logins, server storage, third-party scripts, or services.

## Limits / user transparency

The account label is **not automatically verified**. FollowClean cannot prove which Instagram account a ZIP belongs to without authentication; users must identify and confirm the account. Already stored local progress from older releases is keyed by export-content hash rather than the manual account name; this particular upgrade isolates **saved history and charts**, not a complete authenticated multi-account workspace.

The user can still choose to compare wrong ZIPs deliberately by making a false confirmation. The product does not claim cryptographic identity verification.

Saved snapshots and backup JSON files contain account names and follower/following handles **in plaintext**. Local files should not be shared publicly. Privacy and existing deletion controls remain in place.

## Synthetic QA

- Mobile Chromium, 320px: **18/18 passed**. Legacy records preserved and unassigned, saving requires account, chart separation, explicit migration confirmation, account switch clears prior comparison, wrong-account compare disabled, width fits.
- Mobile Chromium, 390px: **18/18 passed**. Accounts A and B, clearing selected account on new import, direct compare blocked without acknowledgement and allowed after it, chart separation, labeled backup export and restoration, deduplication, invalid backup labels rejected, width fits.
- Browser Rendering from literal HTML uses an opaque origin that denies `localStorage`; predeployment tests used a controlled localStorage mock, preserving real production behavior. Real-origin live checks should use actual browser localStorage.
- No physical Safari device test in this run.
- Stripe test checkout + RIO unchanged, no real payments, free ZIP analyzer/list intact, noindex remains.

## Release gates

1. Verify GitHub HEAD, file content SHA and expected markers.
2. Deploy only the FollowClean Cloudflare worker.
3. Verify 100% deployment, HTTP 200, release header, and live mobile acceptance.
4. If live QA fails, report it rather than claiming success.
