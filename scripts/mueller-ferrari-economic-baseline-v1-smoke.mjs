import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildOperatorProjectDetail } from '../src/operator-dashboard-projections-v1.js';

const root = new URL('../projects/mueller-elektrotechnik-digital-customer-system-v1/', import.meta.url);
const baseline = JSON.parse(await readFile(new URL('ferrari-economic-baseline-v1.json', root), 'utf8'));
const providerEvidence = JSON.parse(await readFile(new URL('ferrari-provider-linked-evidence-v1.json', root), 'utf8'));

assert.equal(providerEvidence.acceptance.full_cross_factory_e2e, 'PASS');
assert.equal(baseline.economic_evidence.estimated_variable_cost_eur, 6.18);
assert.equal(baseline.economic_evidence.approved_cost_ceiling_eur, 0);
assert.equal(baseline.economic_evidence.actual_variable_cost_eur.total, 0);
assert.equal(baseline.provider_usage.make.live_runs, 1);
assert.equal(baseline.provider_usage.posthog.live_batches, 1);
assert.equal(baseline.retry_repair_evidence.additional_make_live_runs, 0);
assert.equal(baseline.retry_repair_evidence.provider_retry_count, 0);
assert.equal(baseline.retry_repair_evidence.deliberate_idempotency_validation_retry_count, 1);
assert.equal(baseline.review_approval_evidence.normal_revision_count, 1);
assert.equal(baseline.operator_efficiency.operator_touch_count_state, 'MEASUREMENT_GAP');
assert.equal(baseline.operator_efficiency.operator_minutes_state, 'MEASUREMENT_GAP');
assert.equal(baseline.crm_operator_assessment.mueller_open_task_count, 0);
assert.equal(baseline.economic_readiness.verdict, 'PASS_WITH_OPERATOR_OVERHEAD');
assert.equal(baseline.gelato_ready.recommendation, 'YES');

const scopeKey = baseline.project.scope_key;
const runtime = {
  command_center_state: {
    portfolio: {
      projects: [{
        customer_id: baseline.project.customer_id,
        project_id: baseline.project.project_id,
        scope_key: scopeKey,
        name: 'Müller Elektrotechnik',
        state: 'ACTIVE',
        blocked: false
      }]
    }
  },
  universal_runs: [{
    mission: {
      customer_id: baseline.project.customer_id,
      project_id: baseline.project.project_id,
      mission_id: 'mueller-elektrotechnik:ferrari-economic-baseline-v1',
      environment: 'staging',
      data_policy: { synthetic_only: true }
    },
    plan: {
      selected_capabilities: [
        { capability: 'web_presence', factory: 'web', dependencies: [] },
        { capability: 'business_crm', factory: 'business', dependencies: ['web_presence'] },
        { capability: 'automation_followup', factory: 'automation', dependencies: ['business_crm'] },
        { capability: 'analytics', factory: 'automation', dependencies: ['web_presence'] }
      ],
      execution_order: ['web_presence','business_crm','automation_followup','analytics']
    },
    execution: {
      status: 'SYNTHETIC_STAGING_COMPLETED',
      variable_cost_eur: 0,
      results: [
        { capability: 'web_presence', factory: 'web', provider: 'local-web', status: 'COMPLETED', retries: [] },
        { capability: 'business_crm', factory: 'business', provider: 'supabase-free', status: 'COMPLETED', retries: [] },
        { capability: 'automation_followup', factory: 'automation', provider: 'make-core', status: 'COMPLETED', retries: [] },
        { capability: 'analytics', factory: 'automation', provider: 'posthog-free', status: 'COMPLETED', retries: [] }
      ]
    },
    quality: { status: 'PASS', quality_score: 100, failures: [] },
    delivery: {
      final_delivery_status: 'SIMULATED_HANDOFF_READY',
      execution_evidence: { synthetic: true, production_deploy: false }
    }
  }],
  audit: []
};

const projected = buildOperatorProjectDetail({
  runtime,
  scope_key: scopeKey,
  crm_snapshot: {
    ...providerEvidence.operator_snapshot,
    open_task_count: 0,
    next_task: null
  }
});

assert.equal(projected.ok, true);
assert.equal(projected.results.crm.lead_id, providerEvidence.supabase_crm.lead_id);
assert.equal(projected.results.crm.pipeline_key, 'inquiries');
assert.equal(projected.results.crm.stage_key, 'qualification');
assert.equal(projected.results.crm.last_activity, providerEvidence.supabase_crm.last_activity);
assert.equal(projected.results.crm.next_action, 'CONTACT_SYNTHETIC_LEAD');
assert.equal(projected.results.crm.open_task_count, 0);
assert.equal(projected.results.crm.next_task, null);
assert.equal(projected.results.crm.automation_status, 'succeeded');
assert.equal(projected.results.crm.review_status, 'CUSTOMER_APPROVED');
assert.equal(projected.results.crm.delivery_status, 'SIMULATED_HANDOFF_READY');

console.log('PROJECT FERRARI Müller economic baseline + CRM operator gap assessment: PASS');
console.log(JSON.stringify({
  status: 'PASS',
  economic_readiness: baseline.economic_readiness.verdict,
  actual_variable_cost_eur: baseline.economic_evidence.actual_variable_cost_eur.total,
  operator_touch_count_state: baseline.operator_efficiency.operator_touch_count_state,
  operator_minutes_state: baseline.operator_efficiency.operator_minutes_state,
  crm_operator_verdict: baseline.crm_operator_assessment.verdict,
  open_task_count: projected.results.crm.open_task_count,
  delivery_status: projected.results.crm.delivery_status,
  gelato_ready: baseline.gelato_ready.recommendation,
  production_deploy: false
}, null, 2));
