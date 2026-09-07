# PROJECT JAGUAR — WEBFACTORY 100% — WAVE J12

## Next Best Action Engine V1

J12 turns the existing WebFactory evidence graph into one deterministic operator instruction.

The goal is not to add another workflow engine.

The goal is to answer:

> What is the single most important next action for this project right now?

J12 reuses the existing project, Knowledge, Reference, Build, Visual, J9, Preview and Approval truth.

It creates no parallel project state.

## Core rule

Exactly one primary action is shown.

The dashboard must not present a default button wall that asks the operator to interpret the whole state machine manually.

Secondary bounded WebFactory controls from J11 remain available behind a disclosure.

The primary action remains in the Project Workspace header.

## Supported Next Best Actions

J12 can deterministically choose:

1. REVIEW_PROJECT_KNOWLEDGE
2. CONFIRM_CONTACT_DETAILS
3. APPROVE_PROJECT_KNOWLEDGE
4. CREATE_REFERENCE
5. APPROVE_REFERENCE
6. BUILD_WEBSITE
7. CLOSE_VISUAL_DELTA
8. RUN_BROWSER_QUALITY
9. CHECK_PREVIEW
10. APPROVE_WEBSITE
11. READY_FOR_DELIVERY_LIFECYCLE

## Deterministic priority

Earlier unresolved truth always wins over later production work.

Priority order:

1. unresolved Project Knowledge / conflicts
2. contact-detail confirmation
3. other human project inputs
4. Knowledge approval
5. Reference creation
6. Reference approval
7. Build
8. Visual Delta Closure
9. J9 browser / accessibility / performance acceptance
10. Preview review
11. final Website approval
12. Delivery Lifecycle handoff

This prevents the dashboard from asking the operator to build or approve downstream work while upstream truth is still unresolved.

## Evidence gates

### Project Knowledge

If Project Knowledge has unresolved, ambiguous or conflicting facts, J12 chooses:

REVIEW_PROJECT_KNOWLEDGE

### Contact confirmation

If contact details are specifically unresolved, J12 chooses:

CONFIRM_CONTACT_DETAILS

This outranks generic human-input review because contact truth can directly affect visible content and conversion paths.

### Knowledge approval

If Knowledge is staged/ready but has no approved revision:

APPROVE_PROJECT_KNOWLEDGE

### Reference

Approved Knowledge with no Reference:

CREATE_REFERENCE

Existing non-approved Reference:

APPROVE_REFERENCE

### Build

Approved Knowledge + Approved Reference with no accepted Build:

BUILD_WEBSITE

### Visual closure

Accepted Build + Approved Reference but visual acceptance incomplete:

CLOSE_VISUAL_DELTA

### Browser quality

Visual acceptance complete but J9 incomplete:

RUN_BROWSER_QUALITY

### Preview

Visual + J9 accepted but Preview missing or not reviewed:

CHECK_PREVIEW

### Website approval

Reviewed Preview with technical gates accepted but final approval missing:

APPROVE_WEBSITE

### Delivery handoff

Only after every pre-delivery gate is evidence-backed:

READY_FOR_DELIVERY_LIFECYCLE

J12 does not itself perform delivery.

That belongs to J13.

## Dashboard integration

J12 upgrades the existing Premium Project Workspace.

The existing header area:

NÄCHSTER SCHRITT

becomes the single J12 primary-action surface.

The existing J11 WebFactory tab receives an explanatory Next Best Action card, but it does not create a second primary button.

J11's bounded operator actions remain available behind:

Weitere WebFactory Aktionen

This preserves inspectability and manual bounded control without turning the default interface into a button wall.

## Operator action behavior

Clicking the J12 primary action only navigates to an existing bounded workspace target:

- knowledge
- approvals
- webfactory
- preview

The click does not itself:

- execute a provider
- rebuild
- merge
- deploy
- publish
- change DNS
- activate billing
- call paid providers
- write customer data

Execution remains governed by the existing capability and approval contracts.

## WebFactory capability

Capability:

web.next-best-action.v1

Operations:

- manifest
- derive

The capability returns:

- exactly one primary action
- deterministic priority
- evidence snapshot
- evaluation trace
- target workspace
- safety state

## Gelato Donatello dogfood

J12 runs read-only against the existing Gelato Donatello repository evidence.

Current real Gelato state remains:

- seven human questions remaining
- full dogfood = NOT_YET_PASS
- premium delivery ready = false
- public launch ready = false

The real customer-delivery contract includes current contact details among the unresolved inputs.

Therefore J12 selects:

CONFIRM_CONTACT_DETAILS

This demonstrates that J12 does not jump ahead to Build, Visual QA, Preview or Delivery while a higher-priority business-truth dependency remains unresolved.

No real Gelato data is mutated by the dogfood.

## Browser acceptance

Real Chromium acceptance verifies:

- existing Premium Project Workspace opens
- the workspace header gets exactly one J12 primary button
- a deterministic J12 action code is attached to the workspace
- J11 WebFactory remains available
- the J12 explanatory card appears in WebFactory
- no duplicate J12 primary button exists in the WebFactory panel
- all 11 J11 bounded actions remain present
- secondary actions are collapsed by default
- clicking the J12 primary action causes zero network writes
- navigation stays inside an existing bounded workspace target
- Desktop has no horizontal overflow
- iPhone 390 has no horizontal overflow
- no browser page errors occur

## Regression

J12 must preserve:

- J11 Dashboard Control Plane
- J10 Versioning / Diff / Rollback
- J9 Browser / Accessibility / Performance
- J8 Multi-Viewport Reference Closure
- J7 Visual Closure
- J1–J6
- Premium Masterdashboard
- WebFactory V1
- Web OS V2
- integrated safety gates

## Safety

Automatic execution = OFF

Automatic merge = OFF

Production deploy = OFF

Public launch = OFF

DNS changes = OFF

Billing activation = OFF

Automatic paid activation = OFF

External customer writes = OFF

## Canonical closure rule

J12 is accepted only after:

Remote Truth
→ implementation
→ deterministic action-stage acceptance
→ Gelato read-only dogfood
→ real browser acceptance
→ J1–J11 regression
→ PR merge
→ exact post-merge verification

No fake PASS.
