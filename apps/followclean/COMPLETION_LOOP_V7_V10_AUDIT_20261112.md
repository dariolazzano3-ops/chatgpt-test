# FollowClean | Completion Loop V7–V10 · Release Audit

Stand: 2026-11-12 · Branch: `factory/followclean-mvp-v1-20261109`
Main file: `apps/followclean/index.html`
No changes to Lunara, Gelato Donatello, Lukas Paff or any other project.
No new VPS, SaaS subscription, live payments or browser tracking.

## Status by the ten prioritized levers

| # | Lever | Status | Evidence / outstanding |
| --- | --- | --- | --- |
| 1 | Account-specific cleanup status | **Implemented** | `followclean:progress:v2:<instagram-account>`; prior v1 export-hash status can be imported only after explicit user confirmation; other accounts remain isolated. |
| 2 | Truthful Smart Cleanup | **Implemented** | Instagram profile return = **Angesehen**, not **Erledigt**; explicitly clicking Done/Keep changes decisions; viewed-state Undo works; fast double-taps protected. |
| 3 | Faster import | **Implemented** | Local ZIP/JSON handling, actionable error diagnosis, built-in retry-to-guide action, official Meta export path, mobile instructions. |
| 4 | WebKit/Safari regression coverage | **Test script committed, execution pending** | `tests/webkit-smoke.mjs` runs synthetic iPhone-context checks with Playwright WebKit. WebKit browser binary is not installed in this tool runtime, and Desktop Commander hosts are offline. Browser Rendering is Chromium, not Safari. No false WebKit PASS. |
| 5 | Premium dashboard | **Implemented** | Mutual/non-mutual proportion, honest cleanup status, account-scoped net deltas against last saved stand; no inferred historical event times. |
| 6 | Local cleanup session resume | **Implemented** | Per-account session cursor and skipped list using `followclean:cleanup-session:v1:<account>`; resumes after re-importing the ZIP. The file itself is **never persisted** to browser storage. |
| 7 | Stripe E2E sandbox orders/webhooks | **Partially implemented; paid-event verification pending** | FollowClean-only Stripe sandbox payment link active, promo `RIO` 100% active, test card 4242; current read shows one **open/unpaid** Checkout Session, zero completed. No verified webhook delivery/entitlement, no live keys, no production payments. |
| 8 | Free vs premium differentiator | **Implemented as transparent beta UX** | Basic features shown separately from planned 1€ one-off convenience features. All beta features remain free. Purchase simulation is explicitly **not** an entitlement unlock. Production entitlement remains contingent on secure backend verification. |
| 9 | Mobile UX and accessibility | **Implemented with remaining device gate** | 44px touch surfaces, readable 16px inputs, responsive layout, dark-mode and reduced-motion CSS, visited-state feedback, focus and aria. True iOS WebKit/dark screenshot verification pending. |
| 10 | Public launch and SEO | **Prepared, not legally authorized** | Retain `noindex,nofollow` and incomplete legal notices until legitimate operator details, legal review, tax configuration, and production payment authorization are supplied. Do not pretend launch is ready or enable indexing. |

## User-visible reliability rules

1. ZIP is processed locally only. The account name must be entered manually because the official follower export does not independently authenticate whose account it is.
2. Without selecting an account, the checklist remains ephemeral in the current tab. It is **not** silently bound to the prior account or inherited from a previous upload.
3. Selecting account A loads only account A's statuses and session. Switching to account B closes any open guide, clears pending profile context, and loads B's own statuses.
4. Legacy `followclean:progress:v1:...` records remain unchanged unless consciously imported; the user confirms the selected account name before migration. Global delete removes v1/v2 status, session, optional history snapshots and export-request indicators.
5. A profile **visit** does not confirm an unfollow. Returning from Instagram marks only **Angesehen**. Undo reverses the viewed state. Only an explicit user choice makes **Erledigt** or **Behalten**.
6. Reimport the current ZIP after a page reload, choose the same account name, and the local session cursor and existing decisions resume. Uploaded ZIP data are never copied to server-side persistence.
7. Charts show net differences between an actual selected export and a saved snapshot of the same manually identified account. They cannot determine active unfollow actions, their causes, or precise timestamps.

## Synthetic test evidence

- **22/22 mobile** Chromium tests on account-specific markers, re-import continuity, visit status/explicit Done, account-local clearing, 320px layout.
- **10/10 mobile** Chromium tests for session cursor restoration, account switch isolation, and resume CTA.
- **29/29 mobile** Chromium tests for combined import diagnostics, history deltas, paid sandbox retention, visited-state Undo, free lists and regression.
- **17/17 mobile** Chromium tests with 1,200 synthetic accounts, 400 mutual, 800 non-mutual, paginated 48 rows, local scoped progress and 390px responsive typography.
- Chromium desktop validation of this **latest** release attempted but HTTP 429 rate limited; unverified for this release.
- The GitHub test file uses synthetic data only, no Instagram real-world login and no checkout traffic.

## Stripe sandbox scope (verified)

- Account `acct_1UUVycB93JLuapUu` in `livemode:false`.
- Link `plink_1Ub2JrB93JLuapUuL2lhsegH` remains active and accepts promotion codes.
- Code `RIO` remains active on promo `promo_1Ub2JfB93JLuapUuAQu69Z7q`.
- Checkout sessions in this link so far: **1 open/unpaid, 0 complete** (verified 2026-11-12). No false claim of a successful test order.
- Next paid-engineering gate: test checkout complete, server-side verified webhook, idempotent order record and sandbox entitlement with no secrets in frontend. Do not touch other Stripe products or initiate live payment activation.
- No changes were made to Stripe product, price, coupon, promotion code, link, tax settings or account.

## Final external gates

- A real WebKit/Safari execution (iPhone or Playwright WebKit after installing WebKit locally), including Safari return, deep links and backgrounding.
- Actual business operator information and legal review of imprint, privacy policy, purchase terms, VAT/tax status and production payments.
- An independently completed Stripe sandbox Checkout through the existing payment link, then secure webhook and backend reconciliation proof.
- Only after those gates, consider indexed, public monetized launch. Keep private beta/noindex until then.

## WebKit smoke test instructions

In a local clone with Node 18+ and the Playwright package available:

```bash
npm install --no-save playwright
npx playwright install webkit
node apps/followclean/tests/webkit-smoke.mjs
```

This downloads browser test binaries, not any user's Instagram ZIP. Prefer an already installed Playwright/WebKit instead of downloading when possible. It is **not** run from the GitHub connector and is not claimed PASS today.
