const clean = (value, max = 4000) => String(value || '').trim().slice(0, max);
const clone = (value) => structuredClone(value ?? null);
const ALLOWED_OPERATIONS = new Set(['define_crm', 'configure_pipeline', 'define_lead_fields', 'define_offer_flow', 'map_business_process']);

export function normalizeBusinessContract(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'BUSINESS_CONTRACT_INVALID' };
  const goal = clean(input.goal, 1000);
  const operations = Array.isArray(input.operations) ? input.operations : [];
  if (!goal) return { ok: false, error: 'BUSINESS_GOAL_REQUIRED' };
  if (!operations.length || operations.length > 20) return { ok: false, error: 'BUSINESS_OPERATIONS_REQUIRED' };
  const normalized = [];
  for (const [index, operation] of operations.entries()) {
    if (!operation || typeof operation !== 'object' || Array.isArray(operation)) return { ok: false, error: 'BUSINESS_OPERATION_INVALID', index };
    const type = clean(operation.type, 80);
    if (!ALLOWED_OPERATIONS.has(type)) return { ok: false, error: 'BUSINESS_OPERATION_NOT_ALLOWED', type, index };
    normalized.push({ id: clean(operation.id, 120) || `operation-${index + 1}`, type, config: clone(operation.config || {}) });
  }
  return {
    ok: true,
    contract: {
      contract_version: 'business.task.v1',
      goal,
      operations: normalized,
      execution: { automatic_execution: false, external_writes: false, production_deploy: false },
      metadata: clone(input.metadata || {})
    }
  };
}

export function businessFactoryManifest() {
  return {
    version: '1.0',
    engine: 'business',
    capabilities: ['crm', 'lead_system', 'sales_pipeline', 'offer_flow', 'business_process'],
    execution: 'bounded_local_configuration',
    external_writes: false,
    automatic_execution: false,
    production_deploy: false
  };
}

export { businessCrmFactoryV1Manifest, buildBusinessCrmV1, runSyntheticCrmE2E } from './business-crm-factory-v1.js';
