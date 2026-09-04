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
assert.equal(evidence.posthog.credential_state, 'PRESENT_IN_GITHUB_ENVIRONMENT_RIOSYSTEMS_STAGING');
assert.equal(evidence.posthog.presence_check, 'PASS');
assert.equal(evidence.posthog.live_batch_result, 'PASS');
assert.equal(evidence.posthog.batch_executed, true);
assert.equal(evidence.posthog.status_code, 200);
assert.deepEqual(evidence.posthog.event_names, ['page_view','cta_clicked','lead_submitted','automation_started','lead_persisted']);
assert.equal(evidence.posthog.event_count, 5);
assert.equal(evidence.posthog.distinct_event_names, 5);
assert.equal(evidence.posthog.distinct_project_scopes, 1);
assert.equal(evidence.posthog.cross_project_events, 0);
assert.equal(evidence.posthog.non_staging_events, 0);
assert.equal(evidence.posthog.non_synthetic_events, 0);
assert.equal(evidence.posthog.pii_or_freetext_events, 0);
assert.equal(evidence.posthog.retries_performed, 0);
assert.equal(evidence.posthog.person_profiles_created, false);
assert.equal(evidence.posthog.real_customer_data, false);
assert.equal(evidence.posthog.variable_cost_eur, 0);
assert.equal(evidence.posthog.scope_key, evidence.project.scope_key);
assert.equal(evidence.posthog.project_id, evidence.project.project_id);
assert.equal(evidence.posthog.direct_posthog_readback_verified, true);
assert.equal(evidence.acceptance.live_posthog, 'PASS');
assert.equal(evidence.acceptance.full_cross_factory_e2e, 'PASS');
assert.deepEqual(evidence.delivery_evidence, {
  website: 'PASS',
  form: 'PASS',
  lead: 'PASS',
  crm: 'PASS',
  pipeline: 'PASS',
  make_automation: 'PASS',
  posthog_analytics: 'PASS',
  operator: 'PASS',
  human_outcome: 'PASS',
  private_preview: 'PASS',
  customer_review: 'PASS',
  customer_approval: 'PASS',
  delivery_gate: 'PASS',
  delivery_evidence: 'PASS'
});

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
      execution_evidence: {
        synthetic: true,
        make_execution_id: evidence.make.execution_id,
        posthog_flow_id: evidence.posthog.flow_id,
        posthog_event_count: evidence.posthog.event_count,
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
