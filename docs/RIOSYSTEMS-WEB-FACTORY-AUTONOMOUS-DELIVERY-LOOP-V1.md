# RIOSYSTEMS Web Factory — Autonomous Delivery Loop V1

## Purpose

This closes the highest-leverage gap between the already accepted WebFactory/JAGUAR layers and real operator use.

The repository already had the hard parts:

- J7: approved-reference screenshot comparison, root-cause analysis, bounded visual repair, regression protection.
- J9: real browser, accessibility and performance acceptance.
- J10: versioning and rollback.
- J11/J12: control plane and one Next Best Action.
- J13: private preview and delivery lifecycle.
- J14: full synthetic dogfood closure.

The missing piece was a single bounded orchestration loop that keeps working after the first build instead of waiting for the owner to say "continue" after every step.

## Runtime flow

Owner mission -> build -> technical QA -> J7 visual closure -> J9 browser acceptance -> bounded repair -> repeat -> private preview -> owner review.

The loop may repair and retry at most four outer cycles. J7 retains its own bounded visual-repair rounds inside that flow.

## Source of truth

Every accepted build or repair must return a Git commit SHA. The preview must prove that it was built from the exact final accepted commit.

Writes are limited to the declared project path. The loop refuses main, master and factory-control as write targets.

## Safety boundary

Allowed automatically:

- build on a non-canonical project branch
- tests and browser acceptance
- bounded repairs inside the project path
- private preview deployment
- evidence collection
- J9 automated accessibility may advance to private owner preview while its separate human accessibility review remains pending; final delivery never treats that pending review as full acceptance

Never automatic:

- merge
- production deployment
- public launch
- DNS changes
- billing activation
- paid-provider activation unless a future explicitly approved policy changes the zero-cost ceiling
- external customer writes

Owner review remains the final gate after the private preview.

## Why this matters

Before V1, the owner often had to trigger the next iteration manually: build, inspect, ask for another fix, inspect again.

After V1, one mission can continue through the full bounded internal loop until either:

1. PRIVATE_PREVIEW_READY, where the owner only reviews the result, or
2. HUMAN_DECISION_REQUIRED, where the system stops because the bounded loop cannot safely resolve the remaining issue.

This is intentionally an orchestration layer, not a second visual engine. It reuses J7 and J9 as authoritative acceptance contracts.
