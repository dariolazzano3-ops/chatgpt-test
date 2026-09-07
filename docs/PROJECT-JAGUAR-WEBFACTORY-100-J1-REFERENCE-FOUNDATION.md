# PROJECT JAGUAR — WEBFACTORY 100% — WAVE J1

## Reference Creation Foundation V1

Status: feature implementation candidate. Production, public launch, DNS and billing remain disabled.

### Architecture fit

J1 extends the existing WebFactory as a project-scoped Reference Studio subsystem. It does not create a second Visual Foundry, Project Truth, approval engine, preview engine, provider registry or deployment engine.

The existing Visual Foundry remains the only visual-comparison engine. The Reference Studio only creates and governs the visual source-of-truth lifecycle that Visual Foundry may consume after human approval.

### Lifecycle

DRAFT → SKETCH → WIREFRAME → CANDIDATE → APPROVED

Human review may move SKETCH, WIREFRAME or CANDIDATE to CHANGES_REQUESTED. Iteration creates a new candidate version. An approved reference is immutable and hash-locked. A later approved reference for the same project scope and viewport may supersede it without mutating the locked payload.

Supported states:

- DRAFT
- SKETCH
- WIREFRAME
- CANDIDATE
- CHANGES_REQUESTED
- APPROVED
- SUPERSEDED

### Required approved-reference metadata

Every approved reference carries:

- reference_id
- version
- SHA-256 hash
- project_scope
- viewport
- source provenance
- created_at
- approved_at
- approved_by
- design intent
- asset intent
- motion intent

### Human approval rule

Candidate references are never auto-approved. Approval requires an explicit human actor. System, agent, automation and AI actor names are rejected. Unresolved reference items block approval.

Only an APPROVED reference with a valid hash lock may set visual_source_of_truth=true.

### Project Knowledge binding

Reference briefs bind to a project knowledge snapshot hash and knowledge revision. Confirmed/approved/derived-safe facts are separated from prohibited/rejected facts. The Reference Studio therefore cannot silently turn prohibited project knowledge into reference truth.

### Dashboard readiness

The subsystem provides a serializable dashboard projection with:

- reference status
- reference ID/version/hash
- viewport
- human approval requirement
- visual source-of-truth state
- allowed operator actions
- deterministic next best action

The WebFactory adapter exposes capability web.reference.studio.v1 so the future dashboard control plane can call the subsystem without GitHub-specific operator steps.

### Safety

- production_deploy=false
- public_launch=false
- dns_change=false
- paid_activation=false
- external provider execution is not performed by J1 contracts
- automatic approval is forbidden

### Acceptance

The J1 smoke covers:

1. reference brief generation from Project Knowledge
2. sketch contract
3. wireframe contract
4. candidate contract
5. explicit human change request
6. versioned iteration
7. automatic-approval rejection
8. human approval
9. SHA-256 lock verification
10. tamper detection
11. approved-reference immutability
12. multi-viewport registry
13. dashboard projection
14. WebFactory adapter operation
15. supersession by a later valid approved reference

Existing Jaguar, WebFactory V1 and Web OS V2 smoke suites run as regression gates in the J1 workflow.
