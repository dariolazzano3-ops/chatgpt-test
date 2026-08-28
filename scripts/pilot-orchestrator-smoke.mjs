import assert from 'node:assert/strict';
import { prepareZeroCostPilot, evaluateZeroCostMissionPackage, pilotOrchestratorManifest } from '../src/pilot-orchestrator.js';
import { evaluatePilotAction } from '../src/zero-cost-pilot.js';

const prepared = prepareZeroCostPilot({
  customer_id: 'baeckerei-mueller',
  project_id: 'digital-system-v1',
  name: 'Bäckerei Müller Digital System',
  objective: 'Website mit CRM, Support KI und automatischem Lead Flow.',
  source_revision: '603b50bafe15cd4357bfe7706851b4e28aec509e',
  actor: 'operator'
});
assert.equal(prepared.ok, true);
assert.equal(prepared.pilot.monthly_paid_budget, 0);
assert.equal(prepared.environment.environment, 'staging-local');
assert.equal(prepared.providers.length, 4);

const pkg = {
  mission: {
    mission_id: 'pilot-baeckerei-mueller-001',
    project: 'digital-system-v1',
    tasks: [
      { task_id: 'web-1', domain: 'web' },
      { task_id: 'automation-1', domain: 'automation' },
      { task_id: 'ai-1', domain: 'ai' },
      { task_id: 'business-1', domain: 'business' }
    ]
  }
};

const runtime = evaluateZeroCostMissionPackage(pkg, prepared);
assert.equal(runtime.ok, true);
assert.equal(runtime.stage, 'zero_cost_runtime_ready');
assert.equal(runtime.runtime.ready_for_supervised_execution, true);
assert.equal(runtime.runtime.blockers.length, 0);
assert.equal(runtime.cost_units_reserved, 0);
assert.equal(runtime.external_side_effects_allowed, false);
assert.equal(runtime.production_deploy, false);
for (const task of runtime.runtime.tasks) {
  assert.equal(task.route.provider.external, false);
  assert.equal(task.route.provider.paid, false);
  assert.equal(task.route.provider.estimated_cost_units, 0);
}

const paidAttempt = evaluatePilotAction(prepared.pilot, { type: 'paid-ai', paid: true, estimated_cost: 0.01 });
assert.equal(paidAttempt.ok, false);
assert.equal(paidAttempt.user_action_required, true);

const manifest = pilotOrchestratorManifest();
assert.equal(manifest.paid_budget, 0);
assert.equal(manifest.production_deploy, false);
console.log(JSON.stringify({ ok: true, suite: 'pilot-orchestrator', stage: runtime.stage, providers: prepared.providers.map((p) => p.id), cost_units_reserved: runtime.cost_units_reserved }, null, 2));
