import assert from 'node:assert/strict';
import { bakeryMullerLiveE2EEvidence, isBakeryMullerLiveE2EVerified } from '../src/bakery-muller-live-e2e-evidence.js';

const evidence = bakeryMullerLiveE2EEvidence();
assert.equal(isBakeryMullerLiveE2EVerified(), true);
assert.equal(evidence.schema, 'riosystems.bakery-muller-live-e2e-evidence.v1');
assert.equal(evidence.project_scope, 'bakery-muller:digital-system-v1');
assert.equal(evidence.trace_id, 'block6-e2e-staging-001');
assert.equal(evidence.provider_chain.length, 5);

assert.equal(evidence.components.web.http_status, 200);
assert.equal(evidence.components.web.deploy_performed_for_block6, false);
assert.equal(evidence.components.make.scenario_id, 7149691);
assert.equal(evidence.components.make.execution_id, '889cbc5111364a89b17faa0eba9c4165');
assert.equal(evidence.components.make.scenario_restored_inactive, true);
assert.equal(evidence.components.make.retries_performed, 0);

assert.equal(evidence.components.supabase.contact_count, 1);
assert.equal(evidence.components.supabase.lead_count, 1);
assert.equal(evidence.components.supabase.event_count, 1);
assert.equal(evidence.components.supabase.provider_ref_count, 1);
assert.equal(evidence.components.supabase.audit_count, 1);
assert.equal(evidence.components.supabase.idempotent_write, true);

assert.deepEqual(evidence.components.posthog.event_counts, {
  page_view: 1,
  cta_clicked: 1,
  lead_submitted: 1,
  automation_started: 1,
  lead_persisted: 1
});
assert.equal(evidence.components.posthog.event_count, 5);
assert.equal(evidence.components.posthog.automation_failed_count, 0);
assert.equal(evidence.components.posthog.exact_once_readback_verified, true);
assert.equal(evidence.components.posthog.make_execution_id_readback, '889cbc5111364a89b17faa0eba9c4165');
assert.equal(evidence.components.posthog.pii_properties_present, false);
assert.equal(evidence.components.posthog.lead_persisted_geoip_disable_readback, true);

assert.equal(evidence.components.ai.model, '@cf/zai-org/glm-4.7-flash');
assert.equal(evidence.components.ai.inference_count, 1);
assert.equal(evidence.components.ai.prompt_tokens, 49);
assert.equal(evidence.components.ai.completion_tokens, 4);
assert.equal(evidence.components.ai.total_tokens, 53);
assert.equal(evidence.components.ai.neurons, 0.1937);
assert.equal(evidence.components.ai.direct_rest_preflight.http_status, 401);
assert.equal(evidence.components.ai.direct_rest_preflight.inference_executed, false);
assert.equal(evidence.components.ai.openai_paid_fallback_used, false);

assert.equal(evidence.qa.passed, true);
assert.equal(evidence.unified_delivery.ok, true);
assert.equal(evidence.unified_delivery.status, 'LIVE_STAGING_E2E_VERIFIED');
assert.equal(evidence.safety.synthetic_test_data_only, true);
assert.equal(evidence.safety.real_customer_data, false);
assert.equal(evidence.safety.variable_cost_eur, 0);
assert.equal(evidence.safety.automatic_paid_overflow, false);
assert.equal(evidence.safety.production_deploy, false);

console.log('RIOSYSTEMS Block 6 bakery live E2E evidence smoke: OK');
