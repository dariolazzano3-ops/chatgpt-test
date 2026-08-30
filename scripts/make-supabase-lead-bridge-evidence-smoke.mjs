import assert from 'node:assert/strict';
import { makeSupabaseLeadBridgeEvidence, isMakeSupabaseLeadBridgeVerified } from '../src/make-supabase-lead-bridge-evidence.js';

const evidence = makeSupabaseLeadBridgeEvidence();
assert.equal(isMakeSupabaseLeadBridgeVerified(), true);
assert.equal(evidence.scope.scope_key, 'bakery-muller:digital-system-v1');
assert.equal(evidence.make.scenario_id, 7149691);
assert.equal(evidence.make.execution_id, 'e3198aaaeed64e7b8380c6e067439ecf');
assert.equal(evidence.make.execution_completed, true);
assert.equal(evidence.make.scenario_restored_inactive, true);
assert.equal(evidence.make.secrets_returned, false);
assert.equal(evidence.supabase.project_ref, 'pgzayxpqiakuvibhonwh');
assert.equal(evidence.supabase.lead_count, 1);
assert.equal(evidence.supabase.bridge_event_count, 1);
assert.equal(evidence.supabase.make_execution_ref_count, 1);
assert.equal(evidence.supabase.bridge_audit_count, 1);
assert.equal(evidence.supabase.persisted_make_execution_id, evidence.make.execution_id);
assert.equal(evidence.supabase.persisted_project_scope, evidence.scope.scope_key);
assert.equal(evidence.supabase.persisted_synthetic, true);
assert.equal(evidence.safety.variable_cost_eur, 0);
assert.equal(evidence.safety.real_customer_data, false);
assert.equal(evidence.safety.production_deploy, false);

console.log('RIOSYSTEMS Make -> Supabase live staging bridge evidence: OK');
