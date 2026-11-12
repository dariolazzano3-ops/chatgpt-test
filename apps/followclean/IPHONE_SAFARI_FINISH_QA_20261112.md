# FollowClean | iPhone Safari Finishing Pass · 12 November 2026

Scope: apps/followclean/index.html · branch factory/followclean-mvp-v1-20261109

## Specific fixes

1. **Accidental double-tap protection.** In Smart Cleanup, a rapid second tap on Done, Keep or Skip does not apply the action to the next account. A fresh action is available immediately after Undo.
2. **Skip is reversible.** The Guide's Undo button now correctly restores a skipped account, rather than undoing an unrelated previous status change.
3. **Visible return feedback.** After a profile visit and return, the Guide shows a green, accessible status explanation and offers the next account. It explicitly says that visiting a profile is *not* proof of unfollowing.
4. **Readable phone controls.** At <=650 px, guide buttons use a two-column arrangement and 12px labels; the optional Skip action spans a full row. The search input and filter selects use 16px fonts to avoid input-focus zoom in iPhone Safari.
5. **Safe areas.** On narrow viewports, horizontal shell gutters and bottom footer spacing respect iOS `env(safe-area-inset-*)`. Accessibility touch targets remain >=44px and motion-reduction style remains intact.

## QA performed

- Independent extracted-JavaScript action-unit tests: **18/18 PASS**.
- Cloudflare Chromium mobile rendering, 320px: **10/10 PASS** including ZIP, double tap, Skip Undo, immediate Keep, 16px form fonts and no overflow.
- Cloudflare Chromium mobile rendering, 390px: **12/12 PASS** with 1,200 synthetic accounts, 48 rendered rows, immediate undo actions, no horizontal scroll, preserved RIO Stripe test link and private history.
- Screenshot reviewed at 320 px. Guide controls, feedback, Undo and next-account state visually checked.
- Other projects and Stripe account were untouched; checkout remains Sandbox only with RIO.
- Privacy remains browser-local for Instagram ZIP processing.

## Unverified external device

This work **does not establish a real physical iPhone Safari pass**. Browser rendering here uses mobile Chromium, not WebKit. Final user validation: Open the live URL in Safari; load a personal export locally; start Smart Cleanup; tap Done twice rapidly, Undo, Skip, Undo; open an Instagram profile and return; confirm status feedback, next profile and local progress after a page refresh. Report any issue without sharing a private ZIP or screenshots containing real account names.

## Reference

Apple safe-area guidance: https://developer.apple.com/videos/play/wwdc2021/10029/

No unverified 100% device-completion claim.
