# PROJECT JAGUAR — WEBFACTORY 100% — WAVE J13

## Delivery Lifecycle V1

J13 takes over only after J12 proves:

READY_FOR_DELIVERY_LIFECYCLE

J13 does not replace the existing customer review, approval, project delivery gate, handoff or runtime systems.

It orchestrates them into one explicit WebFactory delivery lifecycle.

## Reused authorities

J13 reuses:

- J12 Next Best Action as the entry gate
- Customer Review Lifecycle V1
- Customer Feedback classification
- existing runtime approval records
- Project Delivery Gate
- Project Handoff
- existing premium / QA / scope / cost evidence
- J10 revision identities when packaged
- J9 acceptance evidence when packaged
- visual acceptance evidence when packaged

No second customer-review engine is created.

No second approval engine is created.

No second delivery gate is created.

## Lifecycle states

J13 supports:

- PRE_DELIVERY_BLOCKED
- AWAITING_PRIVATE_PREVIEW
- CUSTOMER_REVIEW
- REVISION_REQUIRED
- SCOPE_REASSESSMENT_REQUIRED
- CUSTOMER_APPROVED
- STRUCTURAL_DELIVERY_READY
- HANDOFF_READY
- DELIVERY_PACKAGE_READY

## Entry gate

A project cannot enter J13 merely because a Build exists.

J13 requires J12 to select:

READY_FOR_DELIVERY_LIFECYCLE

If J12 still selects:

- Project Knowledge review
- Contact confirmation
- Reference work
- Build
- Visual Delta Closure
- J9 Browser Quality
- Preview review
- Website approval

then J13 remains:

PRE_DELIVERY_BLOCKED

## Private Preview

The first lifecycle stage is a private customer-review preview.

The existing Customer Review Lifecycle requires:

- private preview URL
- source revision
- private access verification
- QA PASS
- Real Human Outcome Acceptance

Without Human Outcome Acceptance, J13 blocks the preview.

Public preview is not implied.

## Customer Review

After a valid private preview:

CUSTOMER_REVIEW

The customer may:

- approve
- report a bug
- identify a quality gap
- request a content correction
- request a normal revision
- request scope expansion

J13 uses the existing customer feedback classifier.

## Normal revision loop

Normal feedback enters:

REVISION_REQUIRED

A revision records:

- revision identity
- source revision
- change summary
- resolved feedback IDs

After the revision, the old preview and approval are invalidated.

The lifecycle returns to:

AWAITING_PRIVATE_PREVIEW

A fresh private preview is required.

## Scope expansion

SCOPE_EXPANSION is not treated as a normal revision.

It moves the lifecycle to:

SCOPE_REASSESSMENT_REQUIRED

The existing Delivery Contract must be reassessed.

Cost re-estimation and new scope approval remain required.

J13 refuses to silently implement a scope expansion as a normal revision.

## Customer approval

Customer approval uses the existing runtime approval system.

A customer approval is valid only for the reviewed private preview and its current review revision.

Unresolved feedback blocks approval.

After approval:

CUSTOMER_APPROVED

## Structural Delivery Gate

J13 then calls the existing Project Delivery Gate.

The gate continues to verify, as applicable:

- required capability completion
- mission history
- QA
- scope verification
- cost reconciliation
- Premium Website Standard
- Customer Review evidence

Only when the existing gate is green does J13 enter:

STRUCTURAL_DELIVERY_READY

## Handoff

J13 creates no new handoff model.

It calls the existing:

riosystems.project-handoff.v1

After a successful handoff:

HANDOFF_READY

External activation remains separate.

A structural handoff is not a Production deploy.

## Immutable Delivery Package

After handoff, J13 can create a delivery package.

The package requires at least one accepted artifact with:

- artifact reference
- SHA-256

The package may additionally bind:

- source revision
- Knowledge revision
- Reference version
- J10 revision ID
- J9 acceptance reference
- Visual acceptance reference

The complete package receives a deterministic SHA-256.

The package is immutable evidence.

Tampering changes the calculated package hash and fails verification.

## Package verification

verifyJ13DeliveryPackage checks:

- schema
- package SHA-256
- artifact references
- artifact SHA-256 format

A modified package fails as:

J13_DELIVERY_PACKAGE_TAMPERED

## WebFactory capability

Capability:

web.delivery.lifecycle.v1

Operations:

- manifest
- create
- register_private_preview
- submit_feedback
- record_revision
- approve_customer_review
- evaluate
- handoff
- package
- verify_package
- inspect

All state is explicitly passed through the bounded operation.

J13 does not create a hidden parallel runtime truth.

## Dashboard integration

The existing J11 WebFactory tab receives a J13 Delivery Lifecycle projection.

The projection shows:

Private Preview
→ Customer Review
→ Revision
→ Approval
→ Handoff
→ Delivery Package

The dashboard derives whether the project is:

PRE_DELIVERY_BLOCKED

or:

READY_TO_START_CUSTOMER_REVIEW

from the existing J12 state.

The projection creates no automatic execution button.

## Gelato Donatello dogfood

The real Gelato repository evidence currently has:

- seven human questions remaining
- full dogfood = NOT_YET_PASS
- premium delivery ready = false
- public launch ready = false
- current contact details still unresolved

Therefore J12 selects:

CONFIRM_CONTACT_DETAILS

J13 correctly remains:

PRE_DELIVERY_BLOCKED

The dogfood proves:

- Customer Review is not started early
- no Handoff is created
- no Delivery Package is created
- Gelato is not falsely marked ready
- no real project state is mutated

## Browser acceptance

Real Chromium acceptance verifies:

- existing Premium Workspace
- existing J11 WebFactory tab
- existing J12 state
- J13 Delivery Lifecycle card
- six visible lifecycle stages
- fresh project remains PRE_DELIVERY_BLOCKED
- no automatic J13 execution button
- Desktop no horizontal overflow
- iPhone 390 no horizontal overflow
- no browser page errors

## Safety

External Activation remains separate.

Automatic customer communication = OFF

Automatic execution = OFF

Automatic merge = OFF

Production deploy = OFF

Public launch = OFF

DNS changes = OFF

Billing activation = OFF

Automatic paid activation = OFF

External customer writes = OFF

## Canonical closure rule

J13 is accepted only after:

Remote Truth
→ implementation
→ lifecycle acceptance
→ revision and scope-expansion acceptance
→ delivery gate acceptance
→ handoff acceptance
→ package tamper acceptance
→ Gelato read-only dogfood
→ real browser acceptance
→ J1–J12 regression
→ PR merge
→ exact post-merge verification

No fake PASS.
