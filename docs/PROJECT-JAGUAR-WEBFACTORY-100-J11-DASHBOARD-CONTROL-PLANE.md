# PROJECT JAGUAR — WEBFACTORY 100% — WAVE J11

## Dashboard WebFactory Control Plane V1

J11 makes the canonical WebFactory state visible and operable inside the existing AURENTARA Premium Project Workspace.

It does not create a second dashboard, a second project runtime or a new source of truth.

The existing Premium Masterdashboard remains the shell.

## Reused authorities

J11 reuses:

- existing project runtime and project-detail API
- existing Project Source Intake / Knowledge Review truth
- existing Reference Studio
- existing Visual Foundry / J7 visual closure
- J8 multi-viewport reference closure
- J9 browser / accessibility / performance acceptance
- J10 versioning / diff / rollback
- existing Preview engine
- existing Approval Hub
- existing Delivery state

Missing evidence is shown as NOT_VERIFIED.

J11 never converts missing or unrelated evidence into PASS.

## Workspace integration

The existing Project Workspace receives one additional tab:

WebFactory

The tab is injected into the existing Premium Masterdashboard. It does not replace the existing tabs:

- Übersicht
- Quellen
- Projektwissen
- Umsetzung
- Preview
- Prüfungen
- Aktivität

The control plane is responsive on Desktop and iPhone layouts.

## Required control fields

The WebFactory tab exposes exactly the required control surfaces:

1. Build Profile
2. Jaguar Version
3. Knowledge Revision
4. Reference Status / Version
5. Visual Score
6. Build / QA
7. Performance
8. Accessibility
9. Preview
10. Cost
11. Delivery State

Every field contains a value plus an evidence state.

When the current project payload does not contain authoritative evidence, the value remains NOT_VERIFIED.

## Operator actions

J11 exposes:

- Sketch
- Reference
- Variant
- Approval
- Build
- Visual QA
- Delta Closure
- Rebuild
- Preview
- Changes
- Delivery

Every action has one of four states:

- AVAILABLE
- BLOCKED
- REVIEW_REQUIRED
- NOT_VERIFIED

Action states are evidence-gated.

Examples:

- Build requires approved Knowledge and Approved Reference.
- Visual QA / Delta Closure require an accepted build and Approved Reference.
- Rebuild is available only when J10 change impact says PARTIAL_REBUILD or FULL_REBUILD.
- Delivery requires Delivery Ready + visual acceptance + J9 acceptance + Preview.
- Missing J10 change-impact evidence keeps Rebuild NOT_VERIFIED.

## No automatic execution

The Dashboard Control Plane is operator-initiated.

Clicking an action in the J11 UI does not automatically:

- run a provider
- merge a branch
- deploy production
- publish public
- modify DNS
- activate billing
- call a paid provider
- write customer data

The UI prepares or opens the existing bounded workspace area and emits an operator action event.

Actual execution remains subject to the existing execution, approval and safety contracts.

## Technical Detail Drawer

The WebFactory tab includes a collapsed Technical Details drawer.

The drawer exposes the current evidence surfaces behind the human-readable control plane, including where available:

- Project Truth
- Knowledge Truth
- Reference Truth
- J9 evidence
- J10 evidence
- Build / QA
- Preview
- Delivery

This keeps the default interface decision-oriented while preserving inspectable evidence.

## WebFactory capability

Canonical capability:

web.dashboard.control-plane.v1

Supported operations:

- manifest
- project
- actions

The capability projects existing truth into the J11 control plane.

It does not create a new runtime truth.

## Action gating

The control-plane projection applies these deterministic gates.

### Sketch

Available when a project scope exists.

### Reference

Requires an approved Knowledge revision.

If Knowledge is ready but Reference is not approved, state is REVIEW_REQUIRED.

### Variant

Requires Approved Reference.

### Approval

Uses the existing Approval Hub.

### Build

Requires:

Approved Knowledge + Approved Reference.

### Visual QA / Delta Closure

Require:

Accepted Build + Approved Reference.

The underlying authority remains the existing Visual Foundry and J7/J8 closure stack.

### Rebuild

Requires a J10 change-impact result of:

- PARTIAL_REBUILD
- FULL_REBUILD

If J10 impact is absent, Rebuild remains NOT_VERIFIED.

### Preview

Uses the existing private Preview path.

### Changes

Available as an operator-prepared change request against the current project scope.

J10 remains the impact/diff authority.

### Delivery

Requires evidence-backed:

- Delivery Ready
- Visual Acceptance
- J9 Acceptance
- Preview Available

No individual metric can override another blocked delivery prerequisite.

## Gelato Donatello dogfood

J11 runs read-only dogfood against the existing Gelato Donatello repository evidence.

The dogfood intentionally preserves the real current state.

Evidence-backed values include:

- Build Profile = PREMIUM
- Jaguar system version = J11
- Cost = 0 EUR
- Delivery State = CUSTOMER_INPUT_CLOSURE
- Preview = NOT_AVAILABLE under the current private local-only policy

The current repository evidence does not establish a J11-consumable canonical:

- Knowledge Revision
- Approved Reference version
- Visual Acceptance score
- J9 Performance acceptance
- J9 Accessibility acceptance
- accepted Build / QA identity

Those fields therefore remain NOT_VERIFIED.

The dogfood explicitly proves that older partial scores or unrelated technical evidence do not become J11 PASS evidence.

The existing Gelato states remain unchanged:

- seven human questions remain
- full dogfood is NOT_YET_PASS
- premium delivery ready = false
- public launch ready = false

This is intentional evidence integrity, not a failure of J11.

## Browser acceptance

Real Chromium acceptance verifies:

- existing Premium Project Workspace opens
- exactly one WebFactory tab is added
- all 11 control fields render
- all 11 operator actions render
- Technical Details drawer exists
- Desktop has no horizontal overflow
- iPhone 390 layout has no horizontal overflow
- mobile control cards collapse responsively
- Sketch and Changes reuse existing workspace areas
- clicking J11 operator actions causes zero network writes
- no page errors occur

## Safety

Production/Public/DNS/Billing/Paid/External Writes remain OFF.

Automatic merge remains OFF.

Automatic execution remains OFF.

## Canonical closure rule

J11 is accepted only after:

Remote Truth
→ implementation
→ unit/smoke acceptance
→ real Gelato read-only dogfood
→ real browser acceptance
→ J1–J10 regression
→ Premium Masterdashboard regression
→ PR merge
→ exact post-merge verification

No fake PASS.
