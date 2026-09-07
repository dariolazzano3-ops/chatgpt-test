# PROJECT JAGUAR — WEBFACTORY 100% — WAVE J8

## Multi-Viewport Reference Closure V1

J8 extends the canonical J7 Full Visual Closure Loop across the complete required responsive reference set.

Required viewport identities:

- `1440_DESKTOP`
- `1024_TABLET`
- `390_MOBILE`
- `320_SMALL_MOBILE`

The width is part of the contract. The height remains reference-specific and must match the approved PNG exactly.

## Core rule

Desktop is not a master image that may be blindly scaled down.

Every required viewport owns its own:

1. Approved Reference
2. region locks
3. responsive / layout constraints
4. browser screenshot
5. Visual Foundry metrics
6. delta report
7. acceptance result

A multi-viewport PASS exists only when all four required viewports pass on the same final implementation commit.

## Relationship to J7

J8 does not create a second comparator or a second repair engine.

Each viewport delegates visual closure to the canonical J7 pipeline:

Approved Reference
→ Screenshot
→ Visual Foundry
→ Delta
→ Root Cause
→ Repair
→ Recompare
→ Semantic Gate
→ Functional / Responsive / Accessibility Regression
→ Region Locks

J8 is the orchestration and convergence layer above J7.

## Independent Approved References

Each viewport must provide a distinct Approved Reference identity.

The reference must remain:

- state `APPROVED`
- hash locked
- `visual_source_of_truth=true`
- bound to the exact viewport identity
- backed by its own PNG path and SHA-256
- dimensionally equal to the closure viewport

Reusing one reference identity across multiple viewport targets is blocked.

## Viewport contracts

The required width contract is:

- Desktop: 1440 px
- Tablet: 1024 px
- Mobile: 390 px
- Small Mobile: 320 px

J8 does not invent one universal reference height. The approved reference PNG defines the height for that target, and J7 verifies exact dimensions.

Each target must explicitly provide its own `constraints` object. This is not documentary metadata only. J8 wraps the functional regression gate with a viewport-specific constraint gate, so a constraint failure becomes an acceptance failure.

## Locks

Each viewport has its own lock set.

A passing desktop region cannot substitute for a tablet/mobile region, and a global visual score cannot override a viewport-specific locked-region regression.

J8 preserves the J7 soft-lock and region-regression model inside every viewport closure.

## Convergence model

Responsive repair is shared implementation work. A repair for one viewport can affect another viewport.

Therefore one sequential pass through the four viewports is not sufficient evidence.

J8 performs bounded convergence cycles in deterministic order:

1. 1440 Desktop
2. 1024 Tablet
3. 390 Mobile
4. 320 Small Mobile

Each viewport starts from the current shared implementation commit.

If any viewport performs a repair, J8 requires another full revalidation cycle.

Final PASS requires one complete cycle where:

- all four viewports PASS
- every viewport needs zero repair rounds
- every viewport reports the same final commit
- no viewport-specific constraint fails
- no semantic / functional / responsive / accessibility regression exists
- all locked regions remain accepted

This prevents a late mobile repair from silently breaking an already-passing desktop reference.

Default maximum convergence cycles: 3.

Hard maximum convergence cycles: 6.

There is no infinite loop. If convergence is not stable within the bound, J8 returns `HUMAN_DECISION_REQUIRED`.

## Required evidence per viewport

J8 emits these evidence classes for every target:

- `REFERENCE`
- `LOCKS`
- `CONSTRAINTS`
- `SCREENSHOT`
- `METRICS`
- `DELTA_REPORT`
- `ACCEPTANCE`

The metrics and deltas come from the existing Visual Foundry through J7. AI is not the visual acceptance authority.

## Real browser acceptance

The J8 acceptance fixture uses real Chromium screenshots for all four required widths.

The fixture intentionally defines different responsive layouts rather than a scaled desktop copy:

- desktop three-column composition
- tablet two-column composition
- mobile stack
- small-mobile compact stack

The initial implementation intentionally uses a wrong shared desktop-like layout.

The acceptance run must prove that:

1. all four Approved References are separately hash locked
2. a missing required viewport blocks
3. reusing a reference identity across viewports blocks
4. blind desktop scaling fails viewport constraints
5. each viewport can repair against its own reference through J7
6. the first cycle performs viewport-specific repairs
7. a second full cycle is required
8. the second cycle passes with zero repair rounds
9. all four viewports finish on the same shared commit
10. final pixel difference is 0 for all four fixture references
11. final SSIM is 1 for all four fixture references
12. semantic and functional gates remain PASS

## Additive implementation rule

J8 is implemented as an additive module, smoke acceptance, workflow and documentation layer on top of canonical J7.

It does not delete, reset, revert, truncate or blindly replace existing J1–J7 files, scripts, reports or workflows.

## Safety

J8 cannot:

- deploy production
- launch public
- alter DNS
- activate billing
- automatically activate paid providers
- perform external customer writes

Production/Public/DNS/Billing/Paid/External Writes remain OFF.
