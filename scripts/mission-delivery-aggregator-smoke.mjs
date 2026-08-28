import assert from 'node:assert/strict';
import { compileMissionPackage } from '../src/mission-compiler.js';
import { superviseMission } from '../src/mission-supervisor.js';
import { evaluateMissionActivation } from '../src/mission-activation-gate.js';
import { aggregateMissionDelivery, missionDeliveryAggregatorManifest } from '../src/mission-delivery-aggregator.js';

const compiled = compileMissionPackage({
  prompt: 'Baue für Firma Müller eine Website, richte ein CRM ein, erstelle eine Support-KI und verbinde eingehende Leads automatisch damit.',
  project: 'mueller'
});
assert.equal(compiled.ok, true);
const pkg = compiled.package;
const byCapability = Object.fromEntries(pkg.mission.tasks.map((task) => [task.capability, task.task_id]));

const execution = await superviseMission(pkg.mission, {
  web: { authorized: true }, business: { authorized: true }, ai: { authorized: true }, automation: { authorized: true }
}, {
  ...pkg.contracts,
  web: { ...pkg.contracts.web, project_slug: 'mueller' },
  ai: { runner: async () => ({ output: 'Support AI ready', provider: 'mock', model: 'mock-v1', external_side_effects: false, production_deploy: false }) },
  dispatch_web: async () => ({ job_id: 'delivery-web-job', request_ref: 'factory-requests/delivery.json', production_deploy: false }),
  observe_web: async ({ job_id }) => ({ status: 'READY_FOR_REVIEW', job_id, project_slug: 'mueller', revision: 3, commit_sha: 'abc123', preview_url: 'https://example.invalid/mueller', qa_status: 'passed', qa_attempt: 1 })
});
assert.equal(execution.completed, true);

const activation = evaluateMissionActivation(pkg, {
  adapter_approvals: { web: { authorized: true }, automation: { authorized: true }, ai: { authorized: true }, business: { authorized: true } }
});
assert.equal(activation.ready_for_supervised_execution, true);
assert.equal(activation.ready_for_external_activation, false);

const delivery = aggregateMissionDelivery(execution.mission, { activation });
assert.equal(delivery.ok, true);
assert.equal(delivery.structural_completion, true);
assert.equal(delivery.external_activation_ready, false);
assert.equal(delivery.completion_class, 'STRUCTURALLY_COMPLETE_EXTERNAL_ACTIVATION_SEPARATE');
assert.equal(delivery.counts.total, 4);
assert.equal(delivery.counts.completed, 4);
assert.equal(delivery.unresolved.length, 0);
assert.equal(delivery.by_engine.web[0].evidence.preview_url, 'https://example.invalid/mueller');
assert.equal(delivery.by_engine.business[0].evidence.external_writes, false);
assert.equal(delivery.by_engine.ai[0].evidence.output, 'Support AI ready');
assert.equal(delivery.by_engine.automation[0].evidence.result.supervised_activation_required, true);
assert.ok(delivery.by_engine.automation[0].evidence.result[byCapability.web_generate]);
assert.ok(delivery.by_engine.automation[0].evidence.result[byCapability.business_system_build]);
assert.ok(delivery.by_engine.automation[0].evidence.result[byCapability.ai_system_build]);
assert.equal(delivery.safeguards.production_deploy, false);

const manifest = missionDeliveryAggregatorManifest();
assert.equal(manifest.version, '4.12');
assert.equal(manifest.aggregates_web_business_ai_automation, true);
assert.equal(manifest.distinguishes_structural_completion_from_external_activation, true);
assert.equal(manifest.mutates_external_systems, false);
console.log('mission-delivery-aggregator-smoke: ok');
