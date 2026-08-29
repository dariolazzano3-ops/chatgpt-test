# RIOSYSTEMS Staging Release Budget Control

This block formalizes the operator monthly budget ceiling and combines it with preview and D1 staging gates.

## Operator budget policy

`src/operator-budget-policy.js` supports a configurable monthly ceiling, warning threshold, paid-action approval gate, reservation and settlement accounting. Automatic paid overflow is disabled.

The reference smoke uses an 80 EUR monthly ceiling. The ceiling is a maximum, not a spending target. Any action with a positive estimated cost still requires explicit cost approval.

## Staging release control

`src/staging-release-control.js` combines:

- preview deployment readiness
- D1 staging readiness
- operator monthly budget policy
- source revision evidence
- provider health evidence

A successful package reaches `STAGING_RELEASE_PACKAGE_READY`. After smoke, scope, cost, revision and provider-health evidence it can reach `STAGING_OPERATOR_REVIEW_READY`.

Neither state authorizes production or automatic deployment.

## Safety

- production disabled
- automatic deployment disabled
- automatic migration application disabled
- automatic paid overflow disabled
- positive-cost actions require approval
- external writes remain approval-gated
