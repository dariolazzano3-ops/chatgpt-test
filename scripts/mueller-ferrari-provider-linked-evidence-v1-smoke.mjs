import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildOperatorProjectDetail } from '../src/operator-dashboard-projections-v1.js';

const evidence = JSON.parse(await readFile(
  new URL('../projects/mueller-elektrotechnik-digital-customer-system-v1/ferrari-provider-linked-evidence-v1.json', import.meta.url),
  'utf8'
));

assert.equal(evidence.make.result, 'PASS');
assert.equal(evidence.make.execution_id, '4c41a3d4716541bc8747cea8b0f03b25');
assert.equal(evidence.make.scenario_restored_inactive, true);
assert.equal(evidence.make.variable_cost_eur, 0);
assert.equal(evidence.idempotency.additional_make_run_performed, false);
assert.equal(evidence.idempotency.lead_count_after_retry, 1);
assert.equal(evidence.supabase_crm.cross_project_leak_count, 0);
assert.equal(evidence.supabase_crm.pii_present, false);
assert.equal(evidence.pipeline.allowed_transition_applied, true);
assert.equal(evidence.pipeline.invalid_transition_blocked, true);
assert.equal(evidence.posthog.credential_state, 'MISSING_IN_GITHUB_ENVIRONMENT_RIOSYSTEMS_STAGING');
assert.equal(evidence.posthog.batch_executed, false);
assert.equal(evidence.acceptance.full_cross_factory_e2e, 'INCOMPLETE');

const project = evidence.project;
const runtime = {
  command_center_state: {
    portfolio: {
      projects: [{
        customer_id: project.customer_id,
        project_id: project.project_id,
        scope_key: project.scope_key,
        name: 'Müller Elektrotechnik',
        state: 'ACTIVE',
        blocked: false
      }]
    }
  },
  universal_runs: [{
    mission: {
      customer_id: project.customer_id,
      project_id: project.project_id,
      mission_id: 'mueller-elektrotechnik:ferrari-provider-linked-v1',
      environment: 'staging',
      data_policy: { synthetic_only: true }
    },
    plan: {
      selected_capabilities: [
        { capability: 'web_presence', factory: 'web', dependencies: [] },
        { capability: 'business_crm', factory: 'business', dependencies: ['web_presence'] },
        { capability: 'automation_followup', factory: 'automation', dependencies: ['business_crm'] }
      ],
      execution_order: ['web_presence','business_crm','automation_followup']
    },
    execution: {
      status: 'SYNTHETIC_STAGING_COMPLETED',
      variable_cost_eur: 0,
      results: [
        { capability: 'web_presence', factory: 'web', provider: 'local-web', status: 'COMPLETED', retries: [] },
        { capability: 'business_crm', factory: 'business', provider: 'supabase-free', status: 'COMPLETED', retries: [] },
        { capability: 'automation_followup', factory: 'automation', provider: 'make-core', status: 'COMPLETED', retries: [] }
      ]
    },
    quality: { status: 'PASS', quality_score: 100, failures: [] },
    delivery: {
      final_delivery_status: 'SIMULATED_HANDOFF_READY',
      execution_evidence: {
        synthetic: true,
        make_execution_id: evidence.make.execution_id,
        production_deploy: false
      }
    }
  }],
  audit: []
};

const projected = buildOperatorProjectDetail({
  runtime,
  scope_key: project.scope_key,
  crm_snapshot: evidence.operator_snapshot
});
assert.equal(projected.ok, true);
assert.equal(projected.results.crm.lead_id, evidence.supabase_crm.lead_id);
assert.equal(projected.results.crm.pipeline_key, 'inquiries');
assert.equal(projected.results.crm.stage_key, 'qualification');
assert.equal(projected.results.crm.next_action, 'CONTACT_SYNTHETIC_LEAD');
assert.equal(projected.results.crm.automation_status, 'succeeded');
assert.equal(projected.results.crm.pii_present, false);

const wrongScope = buildOperatorProjectDetail({
  runtime,
  scope_key: project.scope_key,
  crm_snapshot: { ...evidence.operator_snapshot, scope_key: 'other:project' }
});
assert.equal(wrongScope.blockers.includes('CRM_OPERATOR_SNAPSHOT_SCOPE_OR_PRIVACY_REJECTED'), true);

const serialized = JSON.stringify(evidence).toLowerCase();
assert.equal(serialized.includes('@'), false);
assert.equal(serialized.includes('phone_number'), false);

console.log('PROJECT FERRARI Müller provider-linked evidence + operator projection: PASS');
