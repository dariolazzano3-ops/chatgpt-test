import assert from 'node:assert/strict';
import { buildOperatorControlPlane, buildFactoryReadinessMatrix, buildMissionDeliveryRegistry, operatorControlPlaneManifest } from '../src/operator-control-plane-v1.js';
import { buildOperatorDashboardView, operatorDashboardManifest } from '../src/operator-dashboard-v1.js';

const scope = 'bakery-muller:digital-system-v1';
const portfolio = {
  operator_id: 'operator',
  projects: [{
    customer_id: 'bakery-muller',
    project_id: 'digital-system-v1',
    scope_key: scope,
    name: 'Bäckerei Müller',
    state: 'ACTIVE',
    budget_cost_units: 0,
    capability_count: 5,
    mission_count: 1,
    delivery_count: 1,
    priority: 1,
    blocked: false,
    blocker_count: 0,
    next_action: 'Review unified delivery',
    production_deploy: false
  }],
  production_deploy: false
};

const mission = {
  mission_id: 'block7-control-plane-smoke-001',
  orchestration_id: 'orchestration:block7:001',
  prompt: 'Synthetic operator-control-plane mission',
  project: { project_id: 'digital-system-v1', scope_key: scope },
  status: 'COMPLETED',
  tasks: [
    { task_id: 'web-1', domain: 'web', capability: 'website', state: 'COMPLETED', attempt: 1, outputs: { project_slug: 'bakery-muller', revision: 1, preview_url: 'https://example.invalid/preview', qa_status: 'PASS' } },
    { task_id: 'automation-1', domain: 'automation', capability: 'lead_flow', state: 'COMPLETED', attempt: 1, outputs: { result: { synthetic: true }, automation_trace: ['synthetic'] } },
    { task_id: 'business-1', domain: 'business', capability: 'crm', state: 'COMPLETED', attempt: 1, outputs: { business_system: { synthetic: true }, operation_count: 1 } },
    { task_id: 'ai-1', domain: 'ai', capability: 'classification', state: 'COMPLETED', attempt: 1, outputs: { ai_output: { synthetic: true }, provider: 'cloudflare-workers-ai-free', model: '@cf/zai-org/glm-4.7-flash', attempts: 1 } }
  ]
};
const activation = {
  status: 'SUPERVISED_STAGING_READY',
  ready_for_supervised_execution: true,
  ready_for_external_activation: false,
  blockers: [],
  warnings: []
};

assert.equal(buildOperatorControlPlane({}).error, 'CONTROL_PLANE_OPERATOR_REQUIRED');
const matrix = buildFactoryReadinessMatrix();
assert.equal(matrix.summary.core_live_staging_chain_ready, true);
assert.equal(matrix.summary.live_staging_verified, 4);
assert.equal(matrix.items.find((item) => item.factory === 'growth').status, 'STRATEGY_ENGINE_READY');
assert.equal(matrix.items.find((item) => item.factory === 'app').status, 'PLANNED');

const registry = buildMissionDeliveryRegistry([{ mission, activation }]);
assert.equal(registry.ok, true);
assert.equal(registry.summary.mission_count, 1);
assert.equal(registry.summary.structurally_complete, 1);
assert.equal(registry.summary.externally_ready, 0);
assert.equal(registry.summary.live_e2e_verified, true);
assert.equal(registry.summary.live_e2e_proof_count, 1);
assert.equal(registry.live_proofs[0].evidence.components.make.execution_id, '889cbc5111364a89b17faa0eba9c4165');
assert.equal(registry.live_proofs[0].evidence.components.posthog.event_count, 5);
assert.equal(registry.live_proofs[0].evidence.components.ai.inference_count, 1);
assert.equal(registry.live_proofs[0].variable_cost_eur, 0);

const control = buildOperatorControlPlane({
  operator_id: 'operator',
  portfolio,
  integration_health: { web: 'healthy', automation: 'healthy', ai: 'healthy', business: 'healthy', growth: 'healthy' },
  execution_runs: [{ run_id: 'block7-smoke-run', status: 'COMPLETED' }],
  missions: [{ mission, activation }],
  at: '2026-08-30T10:35:00Z'
});
assert.equal(control.ok, true);
assert.equal(control.schema, 'riosystems.operator-control-plane.v1');
assert.equal(control.readiness.status, 'LIVE_STAGING_CONTROL_READY');
assert.equal(control.readiness.live_staging_control_ready, true);
assert.equal(control.readiness.production_ready, false);
assert.equal(control.command_center.portfolio.project_count, 1);
assert.equal(control.factories.summary.live_staging_verified, 4);
assert.equal(control.deliveries.summary.live_e2e_verified, true);
assert.equal(control.deliveries.mission_reports[0].completion_class, 'STRUCTURALLY_COMPLETE_EXTERNAL_ACTIVATION_SEPARATE');
assert.equal(control.alerts.length, 0);
assert.equal(control.next_actions[0].kind, 'ready');
assert.equal(control.cost.development_ceiling_eur, 0);
assert.equal(control.cost.live_proof_variable_cost_eur, 0);
assert.equal(control.cost.automatic_paid_overflow, false);
assert.equal(control.safety.external_mutations_performed, false);
assert.equal(control.safety.real_customer_data_allowed, false);
assert.equal(control.safety.production_deploy, false);

const dashboard = buildOperatorDashboardView(control);
assert.equal(dashboard.ok, true);
assert.equal(dashboard.schema, 'riosystems.operator-dashboard-view.v1');
assert.equal(dashboard.hero.label, 'LIVE STAGING READY');
assert.equal(dashboard.metrics.projects, 1);
assert.equal(dashboard.metrics.live_factories, 4);
assert.equal(dashboard.metrics.strategy_factories, 1);
assert.equal(dashboard.metrics.live_e2e_proofs, 1);
assert.equal(dashboard.metrics.variable_cost_eur, 0);
assert.equal(dashboard.factory_cards.length, 6);
assert.equal(dashboard.delivery_feed.length, 2);
assert.equal(dashboard.safety_panel.production, 'LOCKED');
assert.equal(dashboard.production_deploy, false);

const attentionPortfolio = structuredClone(portfolio);
attentionPortfolio.projects[0].blocked = true;
attentionPortfolio.projects[0].blocker_count = 1;
const attention = buildOperatorControlPlane({
  operator_id: 'operator',
  portfolio: attentionPortfolio,
  approvals: [{ approval_id: 'approval-1', scope_key: scope, approval_type: 'external_write', granted: false }],
  missions: [{ mission, activation }]
});
assert.equal(attention.readiness.status, 'OPERATOR_ATTENTION_REQUIRED');
assert.equal(attention.alerts.some((item) => item.code === 'PROJECT_BLOCKERS_PRESENT'), true);
assert.equal(attention.alerts.some((item) => item.code === 'APPROVALS_PENDING'), true);
assert.equal(attention.next_actions[0].kind, 'approval');
assert.equal(buildOperatorDashboardView(attention).hero.label, 'ATTENTION REQUIRED');

const manifest = operatorControlPlaneManifest();
assert.equal(manifest.external_mutations, false);
assert.equal(manifest.production_deploy, false);
assert.equal(manifest.includes_growth_factory, true);
assert.equal(operatorDashboardManifest().direct_provider_calls, false);

console.log(JSON.stringify({ ok: true, suite: 'operator-control-plane-v1', readiness: control.readiness, metrics: dashboard.metrics }, null, 2));
