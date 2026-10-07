# AURENTARA Web Project Control V2

## Goal

AURENTARA becomes the simple operator surface for website projects. The existing infrastructure remains authoritative underneath it.

The operator should not need to think in Git branches, J7, J9, J11, J12, J13, provider bindings or deployment internals during normal work.

## Human flow

1. Auftrag
2. Material
3. Build
4. Prüfung
5. Preview
6. Freigabe

The interface uses the existing project scope as the binding key across all of these stages.

## Reused infrastructure

- Durable AURENTARA Operator Runtime
- Premium Project Workspace
- Project Source Intake
- Project Knowledge Review
- J11 WebFactory Control Plane
- J12 Next Best Action
- J13 Delivery Lifecycle
- Project Preview Access
- Mission preflight and approval store
- RIOSYSTEMS WebFactory
- Autonomous Delivery Loop V1 engine

V2 is deliberately a presentation and orchestration surface over those systems. It does not fork a second project database or a second project-state model.

## Website work order

The project workspace contains one plain-language website work-order composer.

Submitting it uses the existing project-scoped mission preflight. This creates a reviewable, durable approval plan. It does not claim that a build, deploy or production action already happened.

The direct dispatch binding from the UI into the accepted Autonomous Delivery Loop remains a separate runtime binding and is explicitly not fabricated by V2.

## UX simplification

Primary navigation is expressed as:

- Übersicht
- Webseiten
- Freigaben
- System

Advanced infrastructure pages remain available as secondary controls for diagnosis and administration.

Inside a website project, the working tabs are:

- Übersicht
- Material
- Projektwissen
- Auftrag & Bau
- Website bauen
- Preview
- Freigabe
- Technik

## Safety

V2 does not authorize:

- production deployment
- public launch
- DNS changes
- billing activation
- automatic merge
- external customer writes

The private staging deployment remains a separate governed operation.
