# RIOSYSTEMS Phase 2 Project Operating Layer

Phase 2 turns the governed Phase 1 runtime into a customer-project operating system.

This block adds:

- explicit customer project identity and lifecycle
- deterministic capability blueprint compilation from a project objective
- capability-to-factory portfolio binding
- project readiness evaluation
- project-to-mission binding
- mission result and delivery history backpropagation into the project record
- Phase 1 runtime governance enabled by default for customer project missions
- Bäckerei Müller four-factory reference smoke

Project lifecycle:

`DRAFT -> READY -> ACTIVE -> DELIVERED -> ARCHIVED`, with safe PAUSED transitions.

A customer project is now a first-class runtime object rather than only a mission name or repository directory. It owns scope, objective, budget, capabilities, mission history, delivery history and audit events.

The Bäckerei Müller reference flow proves that a project objective containing Website, CRM, Support AI and Lead Flow is decomposed across Web, Business, AI and Automation and then reaches the existing Phase 1 runtime governance gate fail-closed when providers have not been authorized.

Production deployment and implicit external activation remain disabled.
