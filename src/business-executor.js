import { normalizeBusinessContract } from './business-factory.js';

const clone = (value) => structuredClone(value ?? null);

function applyOperation(state, operation) {
  const next = clone(state);
  if (operation.type === 'define_crm') next.crm = { ...(next.crm || {}), ...(clone(operation.config) || {}) };
  if (operation.type === 'configure_pipeline') next.pipeline = { ...(next.pipeline || {}), ...(clone(operation.config) || {}) };
  if (operation.type === 'define_lead_fields') next.lead_fields = Array.isArray(operation.config?.fields) ? clone(operation.config.fields) : [];
  if (operation.type === 'define_offer_flow') next.offer_flow = { ...(next.offer_flow || {}), ...(clone(operation.config) || {}) };
  if (operation.type === 'map_business_process') next.process_map = { ...(next.process_map || {}), ...(clone(operation.config) || {}) };
  return next;
}

export async function executeBusinessContract(contract = {}, options = {}) {
  const normalized = normalizeBusinessContract(contract);
  if (!normalized.ok) return { ok: false, status: 'FAILED', error: normalized.error, production_deploy: false };
  if (options.production_deploy === true || options.external_write === true) return { ok: false, status: 'BLOCKED', error: 'BUSINESS_EXTERNAL_WRITE_REJECTED', production_deploy: false };
  let state = clone(options.input || {});
  const trace = [];
  for (const operation of normalized.contract.operations) {
    state = applyOperation(state, operation);
    trace.push({ operation_id: operation.id, type: operation.type, status: 'COMPLETED' });
  }
  return {
    ok: true,
    status: 'COMPLETED',
    outputs: { business_system: state, result: state, operation_count: trace.length },
    trace,
    automatic_execution: false,
    external_writes: false,
    production_deploy: false
  };
}
