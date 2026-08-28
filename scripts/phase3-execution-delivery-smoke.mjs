import assert from 'node:assert/strict';
import { createExecutionRun, checkpointExecution, recordExecutionIncident, evaluateExecutionQA, finalizeOperationalDelivery } from '../src/execution-delivery-operations.js';
import { evaluatePhase3Readiness } from '../src/phase3-readiness.js';

const project = {
  customer_id: 'customer-a',
  project_id: 'project-a',
  scope_key: 'customer-a:project-a',
  name: 'Project A',
  capabilities: [
    { id: 'website', required: true },
    { id: 'crm', required: true }
  ],
  missions: [{ mission_id: 'mission-1' }],
  deliveries: []
};

const created = createExecutionRun(project, { run_id: 'run-1', max_attempts: 3 });
assert.equal(created.ok, true);
let run = checkpointExecution(created.run, { status: 'RUNNING', actor: 'operator' }).run;
assert.equal(run.attempt, 1);
const incident = recordExecutionIncident(run, { code: 'TEMP_PROVIDER_ERROR', retryable: true });
assert.equal(incident.recovery_available, true);
run = checkpointExecution(incident.run, { status: 'RUNNING', actor: 'operator', reason: 'resume' }).run;
assert.equal(run.attempt, 2);
const qa = evaluateExecutionQA(run, {
  mission_completed: true,
  capability_outputs_present: true,
  regression_passed: true,
  scope_verified: true,
  costs_reconciled: true
});
assert.equal(qa.ready_for_delivery, true);
const finalized = finalizeOperationalDelivery(project, qa.run, {
  capabilities: [{ id: 'website', completed: true }, { id: 'crm', completed: true }],
  mission_completed: true,
  capability_outputs_present: true,
  regression_passed: true,
  scope_verified: true,
  costs_reconciled: true,
  actor: 'operator'
});
assert.equal(finalized.ok, true);
assert.equal(finalized.run.status, 'DELIVERED');
assert.equal(finalized.production_deploy, false);
const readiness = evaluatePhase3Readiness();
assert.equal(readiness.ready, true);
assert.equal(readiness.status, 'ARCHITECTURE_COMPLETE');
console.log(JSON.stringify({ ok: true, suite: 'phase3-execution-delivery', readiness }, null, 2));
