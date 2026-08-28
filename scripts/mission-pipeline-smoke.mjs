import assert from 'node:assert/strict';
import { runMissionPipeline, missionPipelineManifest } from '../src/mission-pipeline.js';

const prompt = 'Baue für Firma Müller eine Website, richte ein CRM ein, erstelle eine Support-KI und verbinde eingehende Leads automatisch damit.';
const manifest = missionPipelineManifest();
assert.equal(manifest.version, '5.0');
assert.deepEqual(manifest.engines, ['web', 'automation', 'ai', 'business']);
assert.equal(manifest.production_deploy, false);

const waiting = await runMissionPipeline({ prompt, project: 'mueller' });
assert.equal(waiting.ok, true);
assert.equal(waiting.stage, 'waiting_for_approval');
assert.equal(waiting.user_action_required, true);
assert.equal(waiting.production_deploy, false);

const approvals = Object.fromEntries(['web', 'automation', 'ai', 'business'].map((engine) => [engine, { authorized: true, production_deploy: false }]));
const result = await runMissionPipeline(
  { prompt, project: 'mueller', project_name: 'Firma Müller' },
  {
    activation: {
      adapter_approvals: approvals,
      ai: { runner_configured: true, credentials_configured: true, cost_approved: true },
      automation: { transport_configured: true, policy_authorized: true, allowed_hosts: ['example.com'] },
      business: { target_adapter_configured: true, external_write_approved: true },
      production_deploy: false
    },
    ai_runner: async ({ input }) => ({ ok: true, output: { support_system: 'configured', input }, provider: 'mock', model: 'mock-v1' }),
    dispatch_web: async ({ request }) => ({ job_id: `mock-${request.project_slug || 'web'}`, request_ref: 'mock://web-request', production_deploy: false }),
    observe_web: async ({ job_id }) => ({ status: 'READY_FOR_REVIEW', job_id, preview_url: 'https://preview.invalid/mueller', qa_status: 'passed', production_deploy: false }),
    persist: async () => {}
  }
);
if (result.stage !== 'completed') {
  console.error('mission-pipeline-debug', JSON.stringify({ stage: result.stage, status: result.mission?.status, tasks: result.mission?.tasks?.map(({ task_id, domain, engine, state, last_error }) => ({ task_id, domain, engine, state, last_error })), events: result.supervision?.events }, null, 2));
}
assert.equal(result.ok, true);
assert.equal(result.stage, 'completed');
assert.equal(result.completed, true);
assert.equal(result.delivery.structural_completion, true);
assert.equal(result.delivery.counts.failed, 0);
assert.equal(result.delivery.counts.pending, 0);
for (const engine of ['web', 'automation', 'ai', 'business']) assert.ok(result.delivery.by_engine[engine]?.length >= 1, `${engine} delivery missing`);
assert.equal(result.production_deploy, false);
console.log('mission-pipeline-smoke: ok');
