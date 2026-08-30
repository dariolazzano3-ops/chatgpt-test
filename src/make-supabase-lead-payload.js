import { buildMakeSupabaseLeadBridgePlan } from './make-supabase-lead-bridge.js';

export function makeSupabaseSyntheticExecutionPayload() {
  const plan = buildMakeSupabaseLeadBridgePlan({
    customer_id: 'bakery-muller',
    project_id: 'digital-system-v1',
    project_uuid: '6b4b7f3a-8c6f-4d72-9be1-f2f8a3120101',
    staging_only: true,
    synthetic_test_data_only: true,
    real_customer_data: false,
    production_deploy: false
  });
  if (!plan.ok || plan.state !== 'BRIDGE_PLAN_READY_APPROVAL_REQUIRED') {
    throw new Error('MAKE_SUPABASE_CANONICAL_PAYLOAD_UNAVAILABLE');
  }
  return structuredClone(plan.bridge_contract.input);
}
