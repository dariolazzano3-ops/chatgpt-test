import assert from 'node:assert/strict';
import {
  buildFunctionalCompletionProjection,
  operatorFunctionalCompletionManifest,
  handleOperatorDashboard
} from '../src/operator-functional-completion-dashboard-v1.js';

const ok = (body) => ({ ok: true, status: 200, error: null, body });
const missionId = 'mission-functional-v1';
const sourceResults = {
  dashboard: ok({ metrics: { projects: 1 } }),
  projects: ok({ items: [{ project_id: 'synthetic-project', scope_key: 'synthetic:project', name: 'Synthetic Project', production_deploy: false }] }),
  missions: ok({ universal: [{ mission_id: missionId }], durable: [], live_staging: [] }),
  approvals: ok({ core: { pending_count: 0 }, mission_plans: [{ mission_id: missionId, plan_token: 'plan:1', status: 'APPROVAL_REQUIRED', risk: 'SYNTHETIC_STAGING_ONLY' }] }),
  factories: ok({ items: [{ factory: 'automation', status: 'READY' }, { factory: 'web', status: 'READY' }, { factory: 'business_crm', status: 'READY' }, { factory: 'ai', status: 'READY' }, { factory: 'analytics', status: 'READY' }, { factory: 'growth_gtm', status: 'READY' }] }),
  providers: ok({ activation_matrix: {}, active_runtime_providers: [{ name: 'make-core', reality: 'SYNTHETIC_ROUTE_ONLY', variable_cost_eur: 0 }] }),
  costs: ok({ spent_eur: 0, variable_cost_eur: 0, variable_cost_state: 'ESTIMATED_ZERO', daily_cost_eur: null, monthly_cost_eur: null, development_ceiling_eur: 20, remaining_development_budget_eur: 20, paid_execution_authorized: false }),
  deliveries: ok({ universal_missions: [{ mission_id: missionId }], durable_missions: [], live_staging_executions: [] }),
  system_health: ok({
    factory_control_api: { raw: 'VERIFIED_HEALTHY', label: 'legacy alias healthy' },
    control_plane: { raw: 'HEALTHY', label: 'legacy alias healthy' },
    ci: { raw: 'HEALTHY', label: 'legacy alias healthy' },
    production: { raw: 'LOCKED', label: 'legacy alias locked' },
    signals: {
      core_ci: { status: 'HEALTHY', label: 'exact-head core CI healthy' },
      integrated_regression_gate: { status: 'HEALTHY', label: 'integrated regression healthy' },
      dashboard_ci: { status: 'HEALTHY', label: 'dashboard CI healthy' },
      universal_mission_ci: { status: 'HEALTHY', label: 'universal mission CI healthy' },
      factory_readiness: { status: 'HEALTHY', label: 'factory readiness healthy' },
      provider_evidence_freshness: { status: 'NOT_VERIFIED', label: 'provider evidence missing' },
      runtime_persistence: { status: 'HEALTHY', label: 'runtime persistence healthy' },
      staging_availability: { status: 'HEALTHY', label: 'staging available' },
      activation_readiness: { status: 'NOT_VERIFIED', label: 'activation evidence missing' },
      production_readiness: { status: 'NOT_VERIFIED', label: 'production evidence missing' }
    }
  }),
  audit: ok({ items: [{ event: 'MISSION_PLAN_CREATED', mission_id: missionId, at: '2026-08-31T15:00:00.000Z' }, { event: 'MISSION_PLAN_APPROVED', mission_id: missionId, at: '2026-08-31T15:01:00.000Z' }, { event: 'QUALITY_GATE_PASSED', mission_id: missionId, at: '2026-08-31T15:02:00.000Z' }] }),
  actions: ok({ items: [] })
};

const missionDetails = [{
  kind: 'universal_mission',
  mission: {
    mission: {
      mission_id: missionId,
      project_id: 'synthetic-project',
      customer_id: 'synthetic-customer',
      business_name: 'Synthetic Project',
      mission_text: 'Website, CRM, Automation und AI im synthetischen Staging verbinden.',
      environment: 'staging',
      data_policy: { synthetic_only: true, real_customer_data: false },
      production_authorized: false
    },
    plan: {
      selected_capabilities: [{
        task_id: 'synthetic-project:task:01:automation_followup',
        capability: 'automation_followup',
        factory: 'automation',
        dependencies: [],
        provider: { primary: 'make-core', fallback: 'activepieces-cloud-free', estimated_variable_cost_eur: 0, execution_mode: 'synthetic_staging' },
        approval_requirements: ['external_write_approval_if_real_dispatch'],
        quality_criteria: ['graph_valid'],
        expected_deliverable: 'automation_delivery_manifest'
      }],
      execution_order: ['synthetic-project:task:01:automation_followup'],
      production_deploy: false
    },
    preflight: { estimated_variable_cost_eur: 0, approval_summary: [], production_deploy: false },
    execution: {
      status: 'SYNTHETIC_STAGING_COMPLETED',
      variable_cost_eur: 0,
      results: [{
        task_id: 'synthetic-project:task:01:automation_followup',
        capability: 'automation_followup',
        factory: 'automation',
        provider: 'make-core',
        status: 'COMPLETED',
        retries: [],
        output: { synthetic: true, external_write_performed: false, production_deploy: false }
      }],
      production_deploy: false
    },
    quality: { status: 'PASS', quality_score: 100, failures: [], checks: { synthetic_only: true, zero_variable_cost: true, production_disabled: true } },
    delivery: {
      final_delivery_status: 'SIMULATED_HANDOFF_READY',
      deliverables: [{ capability: 'automation_followup', factory: 'automation', provider: 'make-core', status: 'COMPLETED', reference: 'riosystems.automation.synthetic-delivery.v1' }],
      execution_evidence: { mode: 'synthetic_staging', real_provider_calls: 0, external_writes: 0, variable_cost_eur: 0 },
      production_deploy: false
    }
  }
}];

const projection = buildFunctionalCompletionProjection({ source_results: sourceResults, mission_details: missionDetails });
assert.equal(projection.schema, 'riosystems.operator-functional-completion.v1');
assert.equal(projection.source_of_truth, 'existing_operator_runtime_and_core_projections');
assert.equal(projection.missions.length, 1);
assert.equal(projection.missions[0].mission_id, missionId);
assert.equal(projection.missions[0].actual_cost_eur, 0);
assert.equal(projection.missions[0].quality_score, 100);
assert.equal(projection.missions[0].delivery_state, 'SIMULATED_HANDOFF_READY');
assert.equal(projection.quality[0].quality_score, 100);
assert.equal(projection.quality[0].observability_completeness_pct, 20, 'quality and observability completeness must remain separate dimensions');
assert.equal(projection.executions.length, 1);
assert.equal(projection.executions[0].execution_id, null, 'must not invent an execution id');
assert.equal(projection.executions[0].task_id, 'synthetic-project:task:01:automation_followup');
assert.equal(projection.executions[0].started, null, 'must not infer execution start from mission/audit timestamps');
assert.equal(projection.executions[0].completed, null, 'must not infer execution completion from mission/audit timestamps');
assert.equal(projection.executions[0].duration_ms, null, 'must not invent execution duration');
assert.equal(projection.executions[0].cost_eur, null, 'must not allocate/fake per-task cost');
assert.equal(projection.executions[0].cost_state, 'NOT_RECONCILED');
assert.equal(projection.executions[0].mission_actual_cost_state, 'VERIFIED_ACTUAL');
assert.equal(projection.missions[0].estimated_cost_state, 'ESTIMATED');
assert.equal(projection.missions[0].actual_cost_state, 'VERIFIED_ACTUAL');
assert.equal(projection.cost_signals.daily_cost_eur, null, 'period cost must remain unknown without Core evidence');
assert.equal(projection.cost_signals.monthly_cost_eur, null, 'period cost must remain unknown without Core evidence');
assert.equal(projection.cost_signals.daily_cost_state, 'UNKNOWN');
assert.equal(projection.cost_signals.monthly_cost_state, 'UNKNOWN');
assert.equal(projection.cost_signals.variable_cost_eur, 0);
assert.equal(projection.cost_signals.variable_cost_state, 'ESTIMATED', '0 EUR from ESTIMATED_ZERO must not become verified actual zero');
assert.equal(projection.capabilities.source, 'universal_mission_router');
assert.equal(projection.capabilities.items.length, 6, 'canonical router introspection must expose the six registered V1 capabilities');
for (const id of ['growth_gtm', 'web_presence', 'business_crm', 'automation_followup', 'ai_assistance', 'analytics']) {
  assert.ok(projection.capabilities.items.some((item) => item.capability === id), `missing canonical capability ${id}`);
}
assert.ok(projection.providers.some((item) => item.name === 'make-core' && item.status === 'STAGING_ONLY'));
assert.ok(projection.alerts.some((item) => item.severity === 'UNKNOWN' && item.what.includes('Provider Evidence: NOT_VERIFIED')), 'authoritative missing provider evidence must remain NOT_VERIFIED despite legacy healthy aliases');
assert.ok(projection.alerts.some((item) => item.severity === 'UNKNOWN' && item.what.includes('Activation Readiness: NOT_VERIFIED')));
assert.ok(projection.alerts.some((item) => item.severity === 'UNKNOWN' && item.what.includes('Production Readiness: NOT_VERIFIED')));
assert.ok(projection.alerts.some((item) => item.severity === 'ACTION_REQUIRED' && item.what.includes('Approval required')));
assert.equal(projection.summary.operator_state, 'ACTION_REQUIRED');
assert.equal(projection.truth_rules.unknown_is_not_zero, true);
assert.equal(projection.truth_rules.unknown_is_not_healthy, true);
assert.equal(projection.truth_rules.null_timing_is_not_inferred, true);
assert.equal(projection.truth_rules.cost_evidence_states_explicit, true);
assert.equal(projection.truth_rules.authoritative_health_signals_only, true);
assert.equal(projection.truth_rules.unsupported_actions_exposed, false);
assert.equal(projection.safety.production, 'OFF');
assert.equal(projection.safety.external_writes, 'OFF');
assert.equal(projection.safety.real_customer_data, 'NONE');
assert.equal(projection.safety.additional_variable_cost_eur, 0);
assert.equal(projection.production_deploy, false);

const manifest = operatorFunctionalCompletionManifest();
assert.equal(manifest.projection_only, true);
assert.equal(manifest.existing_mission_engine_reused, true);
assert.equal(manifest.existing_capability_router_reused, true);
assert.equal(manifest.existing_approval_engine_reused, true);
assert.equal(manifest.unsupported_retry_cancel_actions_exposed, false);
assert.equal(manifest.external_writes, false);
assert.equal(manifest.variable_cost_eur, 0);
assert.equal(manifest.production_deploy, false);

const response = await handleOperatorDashboard(
  new Request('https://operator.example.test/operator'),
  {},
  {},
  { authorize: async () => ({ ok: true, operator_id: 'operator:test', email: 'operator@example.test' }) }
);
assert.equal(response.status, 200);
const html = await response.text();
for (const required of ['Missionen', 'Ausführungen', 'Capabilities', 'Qualität', 'Blocker / Hinweise', 'Quick Jump', '/functional-completion', 'Observability Completeness', 'Technische Details / Execution Evidence']) {
  assert.ok(html.includes(required), `missing dashboard functional surface ${required}`);
}
assert.doesNotMatch(html, /data-action=["']retry["']/i);
assert.doesNotMatch(html, /data-action=["']cancel["']/i);

console.log(JSON.stringify({
  ok: true,
  suite: 'operator-functional-completion-v1',
  canonical_capabilities: projection.capabilities.items.length,
  mission_projection: projection.missions.length,
  execution_projection: projection.executions.length,
  operator_state: projection.summary.operator_state,
  unknown_period_costs_preserved: true,
  null_execution_timing_preserved: true,
  unreconciled_task_cost_preserved: true,
  authoritative_health_signals_only: true,
  unsupported_actions_exposed: false,
  production_deploy: false,
  external_writes: false,
  real_customer_data: false,
  variable_cost_eur: 0
}, null, 2));
