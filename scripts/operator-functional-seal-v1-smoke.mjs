import assert from 'node:assert/strict';
import { buildFinalFunctionalSeal, operatorFunctionalSealManifest } from '../src/operator-functional-seal-v1.js';

const base = {
  schema: 'riosystems.operator-functional-completion.v1',
  summary: { operator_state: 'NORMAL', pending_approvals: 0 },
  missions: [{ mission_id: 'mission-known', project_id: 'project-1', status: 'SIMULATED_HANDOFF_READY', execution_state: 'SYNTHETIC_STAGING_COMPLETED', quality_state: 'PASS', production_deploy: false }],
  factories: { items: [{ factory: 'automation', status: 'READY', role: 'automation', production_deploy: false }] },
  capabilities: {
    source: 'universal_mission_router',
    status: 'REGISTERED',
    items: [{ capability: 'automation_followup', factory: 'automation', status: 'REGISTERED', provider_primary: 'make-core', provider_fallback: 'activepieces-cloud-free', requirements: [], production_deploy: false }]
  },
  providers: [{ name: 'make-core', status: 'STAGING_ONLY', capabilities: ['automation_followup'], production_deploy: false }],
  executions: [{ task_id: 'task-1', mission_id: 'mission-known', project_id: 'project-1', factory: 'automation', provider: 'make-core', state: 'COMPLETED', completed: '2026-08-31T15:00:00.000Z', production_deploy: false }],
  alerts: [],
  truth_rules: {},
  safety: { production: 'OFF', external_writes: 'OFF', real_customer_data: 'NONE', additional_variable_cost_eur: 0 },
  production_deploy: false
};

const missionList = {
  universal: [
    { mission_id: 'mission-known', project_id: 'project-1', status: 'SIMULATED_HANDOFF_READY', quality_score: 100, variable_cost_eur: 0 },
    { mission_id: 'mission-detail-missing', project_id: 'project-2', status: 'SIMULATED_HANDOFF_READY', quality_score: 100, variable_cost_eur: 0 }
  ],
  live_staging: [],
  durable: []
};

const sealed = buildFinalFunctionalSeal({ base_projection: base, mission_list: missionList });
assert.equal(sealed.schema, 'riosystems.operator-functional-v1-sealed');
assert.equal(sealed.seal.status, 'READY_FOR_FINAL_ACCEPTANCE');
assert.equal(sealed.seal.mission_detail_complete, false);
assert.equal(sealed.seal.mission_detail_fallback_count, 1);
assert.equal(sealed.missions.length, 2, 'canonical mission summary must remain visible when detail read is unavailable');
const fallback = sealed.missions.find((item) => item.mission_id === 'mission-detail-missing');
assert.equal(fallback.reality, 'SUMMARY_ONLY_DETAIL_UNAVAILABLE');
assert.equal(fallback.errors[0], 'MISSION_DETAIL_NOT_AVAILABLE');
assert.ok(sealed.alerts.some((item) => item.key === 'mission:mission-detail-missing:detail-unavailable'));

const factory = sealed.factories.items.find((item) => item.factory === 'automation');
assert.equal(factory.execution_count, 1);
assert.equal(factory.completed_runs, 1);
assert.equal(factory.failed_runs, 0);
assert.equal(factory.success_rate_percent, 100);
assert.equal(factory.current_workload, null, 'workload must remain UNKNOWN when mission detail projection is incomplete');
assert.equal(factory.current_workload_state, 'UNKNOWN');
assert.equal(factory.last_execution, '2026-08-31T15:00:00.000Z');

const capability = sealed.capabilities.items.find((item) => item.capability === 'automation_followup');
assert.equal(capability.registration_state, 'REGISTERED');
assert.equal(capability.availability_state, 'ACTIVE');
assert.equal(capability.provider_primary_state, 'STAGING_ONLY');
assert.notEqual(capability.registration_state, capability.availability_state, 'registration must not be treated as availability');

for (const provider of ['cloudflare-workers-free','cloudflare-workers-ai-free','supabase-free','posthog-free','openai-api']) {
  assert.ok(sealed.providers.some((item) => item.name === provider), `missing canonical registered provider ${provider}`);
}
const openai = sealed.providers.find((item) => item.name === 'openai-api');
assert.equal(openai.status, 'NOT_VERIFIED', 'provider inventory registration alone must not invent availability');
assert.equal(openai.cost_mode, 'paid_usage');
assert.equal(openai.credentials_exposed, false);

assert.equal(sealed.summary.operator_state, 'UNKNOWN', 'missing mission detail must prevent a falsely NORMAL state');
assert.equal(sealed.truth_rules.mission_summary_never_hidden_when_detail_missing, true);
assert.equal(sealed.truth_rules.capability_registration_is_not_availability, true);
assert.equal(sealed.truth_rules.unused_registered_providers_remain_visible, true);
assert.equal(sealed.truth_rules.factory_zero_workload_requires_complete_execution_projection, true);
assert.equal(sealed.safety.production, 'OFF');
assert.equal(sealed.safety.external_writes, 'OFF');
assert.equal(sealed.safety.real_customer_data, 'NONE');
assert.equal(sealed.safety.additional_variable_cost_eur, 0);
assert.equal(sealed.production_deploy, false);

const manifest = operatorFunctionalSealManifest();
assert.equal(manifest.projection_only, true);
assert.equal(manifest.existing_capability_router_reused, true);
assert.equal(manifest.existing_provider_inventory_reused, true);
assert.equal(manifest.duplicate_core_engine, false);
assert.equal(manifest.unsupported_actions_exposed, false);
assert.equal(manifest.production_deploy, false);
assert.equal(manifest.variable_cost_eur, 0);

console.log(JSON.stringify({
  ok: true,
  suite: 'operator-functional-seal-v1',
  mission_fallback_visible: true,
  factory_truth_metrics: true,
  capability_registration_separate_from_availability: true,
  canonical_provider_inventory_visible: true,
  unknown_not_green: true,
  production_deploy: false,
  external_writes: false,
  variable_cost_eur: 0
}, null, 2));
