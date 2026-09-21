# Private Internal Autonomy V1

This is the canonical execution-governance rule for current and future YSRIO,
JARVIS, AURENTARA, RIOSYSTEMS, HAMYREN, and internal projects.

The executable source of truth is:
`src/jarvis/execution-risk-policy-v1.js`.

## Default

A target that is machine-verified as PRIVATE or INTERNAL may execute bounded,
reversible, zero-cost engineering actions without a fresh human approval:

- code/workspace writes;
- tests and verification;
- Git writes to non-protected feature branches;
- deploys to an existing private target;
- private service reloads;
- private live verification;
- rollback to an available prior private revision.

Private deployment requires both verified private access and a rollback path.
Unknown or incompletely classified targets fail closed toward approval.
## Approval boundary

A fresh explicit approval remains required for:

- public or production deployment/release/activation;
- DNS mutation;
- billing or any positive variable-cost external action;
- secret-value access or secret mutation;
- destructive actions;
- merge or protected-branch mutation;
- force push.

Existing secret references may be consumed by an already-authorized private
execution path without exposing the secret value to the operator or worker.

## Invariants

Private autonomy must never be implemented by disabling global safety controls.
Consumers call the shared risk policy and provide target facts. Generic
`cloudflare.deploy` and generic remote-write capabilities stay gated; private
callers use the explicitly scoped `cloudflare.private_deploy` and
`github.feature_branch.write` capabilities.

A deployment is not considered private merely because its name says staging or
preview. Runtime paths must also carry evidence that public access is disabled
and private access is verified. Deployment paths must preserve exact-source
evidence and a usable rollback candidate.
