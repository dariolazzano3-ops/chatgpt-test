import assert from 'node:assert/strict';
import { compileMissionPackage, missionCompilerManifest } from '../src/mission-compiler.js';
import { superviseMission } from '../src/mission-supervisor.js';

const compiled = compileMissionPackage({
  prompt: 'Baue für Firma Müller eine Website, richte ein CRM ein, erstelle eine Support-KI und verbinde eingehende Leads automatisch damit.',
  project: 'mueller'
});
assert.equal(compiled.ok, true);
const pkg = compiled.package;
assert.equal(pkg.compiler_version, '4.10');
assert.equal(pkg.mission.status, 'READY');
assert.equal(pkg.mission.tasks.length, 4);
assert.equal(pkg.mission.tasks.some((task) => task.state === 'BLOCKED'), false);
const byCapability = Object.fromEntries(pkg.mission.tasks.map((task) => [task.capability, task.task_id]));
for (const capability of ['web_generate', 'business_system_build', 'ai_system_build', 'automation_build']) assert.ok(byCapability[capability]);
assert.ok(pkg.contracts.business_contracts[byCapability.business_system_build]);
assert.ok(pkg.contracts.automation_contracts[byCapability.automation_build]);
assert.ok(pkg.contracts.ai_contracts[byCapability.ai_system_build]);
assert.deepEqual(new Set(pkg.approvals.required_engines), new Set(['web', 'business', 'ai', 'automation']));
assert.equal(pkg.safeguards.production_deploy, false);
assert.equal(pkg.safeguards.automatic_multi_factory_execution, false);
assert.equal(pkg.activation_requirements.some((item) => item.type === 'provider_activation'), true);
assert.equal(pkg.activation_requirements.some((item) => item.type === 'external_integration_activation'), true);
assert.equal(pkg.activation_requirements.some((item) => item.type === 'external_crm_write_activation'), true);

let aiCalls = 0;
const execution = await superviseMission(pkg.mission, {
  web: { authorized: true }, business: { authorized: true }, ai: { authorized: true }, automation: { authorized: true }
}, {
  ...pkg.contracts,
  web: { ...pkg.contracts.web, project_slug: 'mueller' },
  ai: {
    runner: async (request) => {
      aiCalls += 1;
      assert.ok(request.input[byCapability.business_system_build]);
      return { output: 'Support AI specification ready', provider: 'mock', model: 'mock-v1', production_deploy: false, external_side_effects: false };
    }
  },
  dispatch_web: async () => ({ job_id: 'compiler-web-job', request_ref: 'factory-requests/compiler.json', production_deploy: false }),
  observe_web: async ({ job_id }) => ({ status: 'READY_FOR_REVIEW', job_id, project_slug: 'mueller', revision: 1, commit_sha: 'mocksha', preview_url: 'https://example.invalid/mueller', qa_status: 'passed', qa_attempt: 1 })
});
assert.equal(execution.ok, true);
assert.equal(execution.completed, true);
assert.equal(execution.mission_status, 'COMPLETED');
assert.equal(aiCalls, 1);
const automation = execution.mission.tasks.find((task) => task.task_id === byCapability.automation_build);
assert.equal(automation.outputs.result.automation_spec.external_activation_required, true);
assert.equal(automation.outputs.result.supervised_activation_required, true);
assert.equal(execution.production_deploy, false);

const manifest = missionCompilerManifest();
assert.equal(manifest.input, 'single_high_level_prompt');
assert.equal(manifest.deterministic_safe_contract_synthesis, true);
assert.equal(manifest.explicit_adapter_approvals_required, true);
assert.equal(manifest.production_deploy, false);
console.log('mission-compiler-smoke: ok');
