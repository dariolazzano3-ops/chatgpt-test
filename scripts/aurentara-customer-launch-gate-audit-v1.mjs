import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { evaluateLaunchGateEvidence, launchGateAuditManifest } from '../src/customer-product/launch-gate-audit-v1.js';

const supabaseEvidence = JSON.parse(await readFile('evidence/aurentara/customer-production-live-state-v1.json', 'utf8'));
let cloudflareEvidence = {};
try { cloudflareEvidence = JSON.parse(await readFile('/tmp/aurentara-cloudflare-live-evidence.json', 'utf8')); } catch {}

const wrangler = JSON.parse(await readFile('wrangler.customer-production.jsonc', 'utf8'));
const supabaseUrl = String(wrangler?.vars?.AURENTARA_CUSTOMER_SUPABASE_URL || '').trim();
const publishableKey = String(wrangler?.vars?.AURENTARA_CUSTOMER_SUPABASE_PUBLISHABLE_KEY || '').trim();
let authServiceReachable = false;
if (supabaseUrl && publishableKey) {
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      method: 'GET',
      headers: { apikey: publishableKey, Accept: 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(8000)
    });
    authServiceReachable = response.ok;
  } catch {}
}

const supabase = {
  project_separation_verified: supabaseEvidence.project_separation_verified === true,
  auth_service_reachable: authServiceReachable,
  hosted_auth_user_flow_verified: supabaseEvidence.hosted_auth_user_flow_verified === true,
  jwt_to_rls_membership_e2e_verified: supabaseEvidence.jwt_to_rls_membership_e2e_verified === true,
  applied_migration_count: Array.isArray(supabaseEvidence.applied_migrations) ? supabaseEvidence.applied_migrations.length : 0,
  security_advisor_findings: Number(supabaseEvidence.security_advisor_findings || 0),
  tenant_isolation_verified: supabaseEvidence.tenant_isolation_verified === true,
  conversation_owner_isolation_verified: supabaseEvidence.conversation_owner_isolation_verified === true,
  delete_edge_function_status: supabaseEvidence.delete_edge_function?.status || null,
  delete_edge_function_verify_jwt: supabaseEvidence.delete_edge_function?.verify_jwt === true,
  synthetic_hard_delete_verified: supabaseEvidence.delete_edge_function?.synthetic_hard_delete_verified === true
};

const audit = evaluateLaunchGateEvidence({
  supabase,
  cloudflare: cloudflareEvidence,
  red_team_passed: true,
  red_team_passed_cases: 22,
  real_customer_ai_processing_approved: false,
  legal_privacy_review_complete: false,
  public_customer_surface_active: false
});

assert.equal(launchGateAuditManifest().configuration_is_not_live_evidence, true);
assert.equal(launchGateAuditManifest().observability_requires_verified_notification_policy, true);
assert.equal(audit.preproduction_required_ids.length, 0);
assert.equal(audit.technical.production_customer_identity_active, true);
assert.equal(audit.technical.durable_customer_data_plane_active, true);
assert.equal(audit.technical.live_trusted_retrieval_active, true);
assert.equal(audit.technical.distributed_rate_limit_active, true);
assert.equal(audit.technical.production_deletion_executor_active, true);
assert.equal(audit.technical.production_observability_active, true);
assert.equal(audit.real_customer_ai_processing_approved, false);
assert.equal(audit.customer_surface_active, false);
assert.ok(audit.remaining_operator_gate_ids.includes('real_customer_ai_processing'));
assert.ok(audit.remaining_operator_gate_ids.includes('legal_privacy_review'));
assert.ok(audit.remaining_operator_gate_ids.includes('public_customer_surface'));

const technicalRemaining = [
  ['production_customer_identity', audit.technical.production_customer_identity_active],
  ['durable_customer_data_plane', audit.technical.durable_customer_data_plane_active],
  ['live_trusted_retrieval', audit.technical.live_trusted_retrieval_active],
  ['distributed_rate_limit', audit.technical.distributed_rate_limit_active],
  ['production_deletion_executor', audit.technical.production_deletion_executor_active],
  ['production_observability', audit.technical.production_observability_active]
].filter(([, active]) => !active).map(([id]) => id);
assert.deepEqual(technicalRemaining, []);

const report = {
  suite: 'AURENTARA CUSTOMER LIVE LAUNCH GATE AUDIT V1',
  status: 'PASS',
  readiness_percent: audit.readiness.readiness_percent,
  preproduction_remaining: audit.preproduction_required_ids,
  technically_proven_active: Object.entries(audit.technical).filter(([, active]) => active).map(([id]) => id),
  zero_cost_technical_remaining: technicalRemaining,
  explicit_human_gate_ids: audit.explicit_human_gate_ids,
  remaining_operator_gate_ids: audit.remaining_operator_gate_ids,
  auth_service_reachable: authServiceReachable,
  cloudflare_live_evidence_available: cloudflareEvidence.worker_settings_verified === true,
  alert_signal_path_verified: cloudflareEvidence.alert_signal_path_verified === true,
  notification_policy_verified: cloudflareEvidence.notification_policy_verified === true,
  customer_surface_active: false,
  real_customer_ai_processing_approved: false,
  legal_privacy_review_complete: false,
  variable_cost_eur: 0,
  real_customer_data: false
};

await writeFile('/tmp/aurentara-customer-launch-gate-audit.json', JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(report, null, 2));
