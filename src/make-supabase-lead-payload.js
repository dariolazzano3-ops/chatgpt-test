import { buildMakeSupabaseLeadBridgePlan } from './make-supabase-lead-bridge.js';

const DEFAULT_SCOPE = Object.freeze({
  customer_id: 'bakery-muller',
  project_id: 'digital-system-v1',
  project_uuid: '6b4b7f3a-8c6f-4d72-9be1-f2f8a3120101'
});

export function makeSupabaseSyntheticExecutionPayload(input = {}) {
  const scope = {
    customer_id: input.customer_id || DEFAULT_SCOPE.customer_id,
    project_id: input.project_id || DEFAULT_SCOPE.project_id,
    project_uuid: input.project_uuid || DEFAULT_SCOPE.project_uuid
  };
  const plan = buildMakeSupabaseLeadBridgePlan({
    ...scope,
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
