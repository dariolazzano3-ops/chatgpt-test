# RIOSYSTEMS Automation Factory V1

Automation Factory V1 is the provider-abstracted workflow runtime for RIOSYSTEMS. It turns a structured automation mission into a validated trigger/action graph, routes nodes through the approved provider hierarchy, executes only deterministic synthetic staging behavior in this V1 surface, records an observable run, and returns a delivery manifest.

## Provider hierarchy

1. Make (`make-core`) is the primary external runtime.
2. Activepieces Cloud is the secondary runtime.
3. n8n is reserved for customer-owned technical specialist instances.
4. Cloudflare Workers is the small-code/webhook runtime.
5. `riosystems-native-automation` handles deterministic repository-owned steps.

Fallback is never automatic. A fallback must preserve the action capability and side-effect semantics, stay at 0 EUR variable cost, and carry explicit fallback approval. Paid overflow is disabled.

## Runtime pipeline

`Mission -> Contract validation -> Workflow plan -> Provider route -> Approval classification -> Provider plans -> Synthetic staging execution -> Retry/repair/fail-closed recovery -> Observability -> Delivery manifest`

The implementation is split into small modules under `src/automation-v1/`:

- `contracts.js`: mission and action contracts plus graph validation.
- `planner.js`: workflow inference, node graph compilation and cycle rejection.
- `router.js`: provider hierarchy, capability routing and fallback validation.
- `approval.js`: READ_ONLY, SAFE_SYNTHETIC_WRITE, EXTERNAL_WRITE, PRODUCTION_CHANGE and PAID_EXECUTION policy.
- `idempotency.js`: stable idempotency keys and a pluggable in-memory test store.
- `recovery.js`: bounded retry, one repair attempt, optional approved fallback and fail-closed behavior.
- `observability.js`: run records and recursive secret redaction.
- `adapters.js`: Make staging bridge integration plus provider-neutral plans for Activepieces, n8n, Workers and native deterministic execution.
- `runtime.js`: end-to-end synthetic staging execution engine.
- `delivery.js`: final delivery manifest and QA summary.
- `manifest.js`: V1 capability and hard-safety manifest.

## Make integration

V1 reuses the existing repository Make staging contracts through `makeStagingActivationManifest()`, `bakeryMullerMakeStagingSpec()` and `makeStagingExecutionRunnerManifest()`.

The Automation Factory does not modify existing operator scenarios. Its Make adapter requires isolated staging scenarios, synthetic data, create/test/restore-inactive semantics, and marks existing operator scenarios `DO_NOT_TOUCH`. The V1 runtime does not execute provider HTTP calls or paid Make operations. Existing separately gated Make staging runners remain available for explicitly approved supervised staging execution outside this zero-variable-cost acceptance path.

## Hard safety

The mission contract rejects any request that violates the V1 safety envelope:

- Production = false
- Real customer data = false
- Mass email = false
- Payments = false
- Paid execution = false in this V1 runtime
- Automatic paid overflow = false
- Variable cost ceiling = 0 EUR
- Existing Make operator scenarios = do not touch

External actions are simulated in the acceptance runtime. Their idempotency keys are claimed before synthetic execution, so repeated runs cannot create duplicate lead, CRM, email or analytics side effects in the test engine.

## Supported action contracts

Standard actions: webhook, schedule, HTTP, database read, database write, email, analytics, AI call, file processing and CRM event. Internal deterministic nodes include transform, condition and output.

Built-in workflow recipes support lead intake, form to CRM, CRM to email, scheduled follow-up, AI-assisted workflow and file-processing flows. Custom workflow graphs can also be supplied in the mission contract.

## Observability

Every V1 run produces:

- `run_id`
- `project_id`
- `workflow_id`
- providers used
- step records and status
- duration
- retry count
- errors
- 0 EUR cost estimate
- simulated side-effect records

Fields whose names resemble tokens, credentials, authorization headers, passwords, cookies or API keys are recursively redacted before they enter the run record.

## Reference acceptance workflows

### 1. Bäckerei Müller lead intake

Synthetic website lead -> Make-routed webhook plan -> deterministic normalization -> Make-routed Supabase staging write plan -> Make-routed PostHog-compatible analytics plan -> output.

The acceptance test verifies normalized input, a synthetic staging record ID, no actual persistence, a PostHog-compatible event plan, Make bridge reuse, restore-inactive semantics, 0 EUR variable cost and duplicate prevention on a repeated run.

### 2. Scheduled file processing

Synthetic schedule -> deterministic database read -> file processing plan -> analytics plan -> output.

This exercises a materially different trigger and action topology from the lead-intake flow.

## Recovery

Transient failures use a bounded retry count. Validation errors receive one repair attempt. Provider failures may use one approved compatible fallback. Permanent failures fail closed and downstream nodes are skipped. There are no unbounded loops.

## Acceptance

`node scripts/automation-factory-v1-smoke.mjs` covers mission safety, planning, routing, Make integration, two reference workflow types, idempotency, retry, repair, fallback gates, observability, secret redaction, cost control, external execution lockout and delivery manifest QA.

The dedicated `Automation Factory V1` workflow also runs the existing Automation Factory, executor, external-action, provider-selection, Make staging bridge, Make staging execution and Make-to-Supabase executor regression suites before merge.
