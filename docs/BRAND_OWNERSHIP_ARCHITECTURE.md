# Canonical Brand & Ownership Architecture

Status: CANONICAL
Effective: 2026-08-31

This document is the repository source of truth for brand, ownership, and naming boundaries. If an older document, PR, branch, comment, or artifact conflicts with this document on brand positioning, this document wins.

## Canonical structure

YSRIO GROUP
→ strategic umbrella / ownership brand in the background
→ intended parent / holding / group layer for AURENTARA SYSTEMS and possible future companies or investments

AURENTARA SYSTEMS
→ visible operative Business Systems brand
→ customer communication
→ website and public brand
→ offers and sales material
→ operative communication
→ private Operator Dashboard / Control Plane presentation

Business Systems / customers / projects
→ delivered and operated through AURENTARA SYSTEMS

AURENTARA SYSTEMS uses the existing RIOSYSTEMS technical foundation.

The canonical architecture is:

`YSRIO GROUP → AURENTARA SYSTEMS → existing RIOSYSTEMS Technical Core`

## Layer boundaries

### Parent / ownership

**YSRIO GROUP** is the strategic umbrella and ownership brand in the background. It is the intended parent / holding / group level for AURENTARA SYSTEMS and possible future companies or investments.

This repository must not claim that a legally incorporated multi-company holding or group structure already exists unless that legal structure has actually been established and separately verified.

Canonical domain reserved for this layer: `ysrio.com`.

The compact wording **YSRIO** may be used only as a deliberate shorthand in a discreet endorsement or domain context, for example **A YSRIO Company**. It does not replace **YSRIO GROUP** as the canonical parent-brand name and must not compete with AURENTARA SYSTEMS for public attention.

### Operative brand

**AURENTARA SYSTEMS** is the visible operative Business Systems brand.

Use AURENTARA SYSTEMS for customer-facing and operator-facing presentation, including:

- public website
- branding and marketing
- customer communication
- proposals and offers
- operative business communication
- Operator Dashboard / Control Plane presentation

Canonical domain reserved for this layer: `aurentarasystems.com`.

Domain ownership does not authorize DNS changes, Production deployment, or traffic migration by itself.

### Internal technology

**RIOSYSTEMS** remains the internal technology and architecture name where renaming would add risk without functional value.

Keep existing technical identifiers unless a separate technical migration has a concrete benefit, including:

- RIOSYSTEMS Core
- Mission Engine
- Factories
- Capability Router
- Provider Router
- Approval Layer
- Quality Layer
- Execution Layer
- Delivery Layer
- `riosystems.*` schemas and contracts
- `RIOSYSTEMS_*` environment variables
- internal APIs, event namespaces, workflow names, file paths, package identifiers, migration identifiers and evidence schemas

A public or operator-facing surface may present AURENTARA SYSTEMS while still using RIOSYSTEMS identifiers internally.

## Superseded strategic naming

**SYNTROPIC is not the canonical operative main brand.** Older references that position SYNTROPIC as the selected operative brand are superseded and must not be used for new public, customer-facing, offer, website, branding, or Operator Control Plane material.

**RIOSYSTEMS is not the canonical visible customer brand.** It remains valid as internal technology terminology.

Older repository statements that made **YSRIO** the canonical parent-brand wording and treated **YSRIO GROUP** as superseded are themselves superseded by this document. The canonical parent-brand name is **YSRIO GROUP**.

Historical technical records do not need destructive rewriting solely to erase superseded names, provided they are not presented as current canonical brand guidance.

## Migration policy

Brand migration must be presentation-first and non-disruptive.

Change when the name is visible to customers or the operator as business identity. Do not rename stable internal contracts, schemas, environment variables, provider integrations, approval logic, cost controls, execution logic, factories, or evidence identifiers solely for branding consistency.

The rule is:

`YSRIO GROUP → AURENTARA SYSTEMS → Business Systems / Customers / Projects`

with

`AURENTARA SYSTEMS → uses → RIOSYSTEMS internal technology`

## Safety boundary

This naming migration does not authorize:

- Production changes
- DNS or domain changes
- customer-data migration
- provider changes
- paid execution
- variable cost above 0 EUR
- changes to approval, execution, quality, cost, delivery, or factory behavior

Any such action remains governed by the existing RIOSYSTEMS technical approval and safety architecture.
