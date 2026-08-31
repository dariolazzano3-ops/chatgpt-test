import { createCostLedger, reserveCost, settleCost, releaseCost, costLedgerSnapshot } from '../runtime-cost-ledger.js';
import { normalizeTenantScope } from './contracts-v1.js';

function sameScope(state, request) {
  return state?.tenant_id === String(request.tenant_id || '') && state?.business_id === String(request.business_id || '');
}

export function createCustomerCostAttribution(input = {}) {
  const scope = normalizeTenantScope(input);
  if (!scope.ok) return scope;
  const core = createCostLedger({ customer_id: scope.tenant_id, project_id: scope.business_id, limit_cost_units: input.limit_cost_units || 0 });
  if (!core.ok) return core;
  return {
    ok: true,
    state: {
      schema: 'aurentara.customer-ai.cost-attribution.v1',
      tenant_id: scope.tenant_id,
      business_id: scope.business_id,
      ledger: core.ledger,
      attribution: {},
      production_deploy: false
    }
  };
}

export function reserveCustomerCost(state, request = {}) {
  if (!sameScope(state, request)) return { ok: false, error: 'COST_SCOPE_MISMATCH', state };
  const reservationId = String(request.reservation_id || '').trim();
  const reserved = reserveCost(state.ledger, {
    reservation_id: reservationId,
    cost_units: request.estimated_cost_units ?? request.cost_units ?? 0,
    provider_id: request.provider_id,
    capability: request.usage_class || 'customer_ai',
    mission_id: request.conversation_id || null,
    task_id: request.operation_id || null
  });
  if (!reserved.ok) return { ...reserved, state };
  const next = structuredClone(state);
  next.ledger = reserved.ledger;
  next.attribution[reservationId] = {
    tenant_id: state.tenant_id,
    business_id: state.business_id,
    user_id: request.user_id || null,
    conversation_id: request.conversation_id || null,
    operation_id: request.operation_id || null,
    provider_id: request.provider_id || null,
    model_id: request.model_id || null,
    usage_class: request.usage_class || 'customer_ai',
    estimated_cost_units: Number(request.estimated_cost_units ?? request.cost_units ?? 0),
    actual_cost_units: null,
    created_at: request.timestamp || new Date().toISOString()
  };
  return { ok: true, state: next, reservation_id: reservationId };
}

export function settleCustomerCost(state, request = {}) {
  if (!sameScope(state, request)) return { ok: false, error: 'COST_SCOPE_MISMATCH', state };
  const settled = settleCost(state.ledger, { reservation_id: request.reservation_id, actual_cost_units: request.actual_cost_units });
  if (!settled.ok) return { ...settled, state };
  const next = structuredClone(state);
  next.ledger = settled.ledger;
  if (next.attribution[request.reservation_id]) next.attribution[request.reservation_id].actual_cost_units = Number(request.actual_cost_units ?? settled.actual_cost_units);
  return { ok: true, state: next, reservation_id: request.reservation_id };
}

export function releaseCustomerCost(state, request = {}) {
  if (!sameScope(state, request)) return { ok: false, error: 'COST_SCOPE_MISMATCH', state };
  const released = releaseCost(state.ledger, request);
  if (!released.ok) return { ...released, state };
  const next = structuredClone(state);
  next.ledger = released.ledger;
  if (next.attribution[request.reservation_id]) next.attribution[request.reservation_id].released = true;
  return { ok: true, state: next, reservation_id: request.reservation_id };
}

export function customerCostSnapshot(state = {}) {
  return { ...structuredClone(state), ledger: costLedgerSnapshot(state.ledger) };
}
