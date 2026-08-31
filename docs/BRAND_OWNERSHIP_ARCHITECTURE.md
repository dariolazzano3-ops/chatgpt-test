# Canonical Brand & Ownership Architecture

Status: CANONICAL
Effective: 2026-08-31

This document is the repository source of truth for brand, ownership, and naming boundaries. If an older document or comment conflicts with this document on brand positioning, this document wins.

## Canonical structure

YSRIO GROUP
→ strategic parent / ownership brand

AURENTARA SYSTEMS
→ visible operative Business Systems brand
→ customer communication
→ website and public brand
→ offers and sales material
→ operative communication
→ private Operator Dashboard / Control Plane

Business Systems / customers / projects
→ delivered and operated through AURENTARA SYSTEMS

AURENTARA SYSTEMS uses the existing RIOSYSTEMS technical foundation.

## Layer boundaries

### Parent / ownership

**YSRIO GROUP** is the strategic parent and ownership brand in the background. It is intended as the umbrella for AURENTARA SYSTEMS and possible future companies or investments.

YSRIO GROUP is currently a strategic brand and ownership architecture. This repository must not claim that a legally incorporated multi-company group or holding structure already exists unless that legal structure has actually been established and separately verified.

Canonical domain reserved for this layer: `ysrio.com`.

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

## SYNTROPIC status

SYNTROPIC is not the canonical operative main brand.

Older references that position SYNTROPIC as the selected operative brand are superseded by this document and must not be used for new public, customer-facing, offer, website, branding, or Operator Control Plane material.

Historical technical records do not need destructive rewriting solely to erase the old name, provided they are not presented as current canonical brand guidance.

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
