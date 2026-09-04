import assert from 'node:assert/strict';
import { runSimulatedPilotE2E, pilotE2EManifest } from '../src/pilot-e2e.js';

const result = await runSimulatedPilotE2E({
  customer_id: 'baeckerei-mueller',
  project_id: 'digital-system-v1',
  name: 'Bäckerei Müller Digital System',
  objective: 'Website mit CRM, Support KI und automatischem Lead Flow.',
  source_revision: 'e4daa2cfa7f503329b38d41ab51432c17941e4c0',
  actor: 'operator'
});

assert.equal(result.ok, true);
assert.equal(result.stage, 'SIMULATED_HANDOFF_READY');
assert.equal(result.project.delivery_contract.customer_review_required, false);
assert.equal(result.outputs.length, 4);
assert.deepEqual(new Set(result.outputs.map((item) => item.domain)), new Set(['web','automation','ai','business']));
assert.equal(result.qa.passed, true);
assert.equal(result.delivery_gate.ready_for_structural_delivery, true);
assert.equal(result.delivery_gate.customer_review_required, false);
assert.equal(result.handoff.structural_delivery_ready, true);
assert.equal(result.handoff.customer_review.required, false);
assert.equal(result.handoff.simulation_only, true);
assert.equal(result.cost_units, 0);
assert.equal(result.external_side_effects, false);
assert.equal(result.production_deploy, false);
for (const output of result.outputs) {
  assert.equal(output.simulated, true);
  assert.equal(output.result.external_side_effect, false);
  assert.equal(output.result.cost_units, 0);
}

const manifest = pilotE2EManifest();
assert.equal(manifest.four_factory_execution, true);
assert.equal(manifest.qa_gate, true);
assert.equal(manifest.structural_handoff, true);
assert.equal(manifest.cost_units, 0);
assert.equal(manifest.production_deploy, false);

console.log(JSON.stringify({ ok: true, suite: 'pilot-e2e', stage: result.stage, outputs: result.outputs.map((item) => item.domain), cost_units: result.cost_units }, null, 2));
