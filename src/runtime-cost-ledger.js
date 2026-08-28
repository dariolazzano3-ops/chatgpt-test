const clean = (value, max = 160) => String(value || '').trim().slice(0, max);
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clone = (value) => structuredClone(value ?? null);

export function createCostLedger(input = {}) {
  const customerId = clean(input.customer_id, 120);
  const projectId = clean(input.project_id, 120);
  if (!customerId || !projectId) return { ok: false, error: 'PROJECT_SCOPE_REQUIRED' };
  const limit = Math.max(0, finite(input.limit_cost_units, 0));
  return {
    ok: true,
    ledger: {
      ledger_version: 'riosystems.cost-ledger.v1',
      customer_id: customerId,
      project_id: projectId,
      scope_key: `${customerId}:${projectId}`,
      limit_cost_units: limit,
      reserved_cost_units: 0,
      spent_cost_units: 0,
      entries: [],
      revision: 0,
      production_deploy: false
    }
  };
}

function remaining(ledger = {}) {
  return Math.max(0, finite(ledger.limit_cost_units) - finite(ledger.reserved_cost_units) - finite(ledger.spent_cost_units));
}

export function costLedgerSnapshot(ledger = {}) {
  return clone({
    ...ledger,
    remaining_cost_units: remaining(ledger)
  });
}

export function reserveCost(ledger = {}, request = {}) {
  const amount = Math.max(0, finite(request.cost_units));
  const reservationId = clean(request.reservation_id, 160);
  if (!reservationId) return { ok: false, error: 'COST_RESERVATION_ID_REQUIRED', ledger: costLedgerSnapshot(ledger) };
  if ((ledger.entries || []).some((entry) => entry.reservation_id === reservationId && entry.type === 'reserve')) {
    return { ok: true, duplicate: true, reservation_id: reservationId, ledger: costLedgerSnapshot(ledger) };
  }
  const available = remaining(ledger);
  if (amount > available) return { ok: false, error: 'PROJECT_BUDGET_EXCEEDED', requested_cost_units: amount, remaining_cost_units: available, ledger: costLedgerSnapshot(ledger) };
  const next = clone(ledger);
  next.reserved_cost_units = finite(next.reserved_cost_units) + amount;
  next.revision = finite(next.revision) + 1;
  next.entries = Array.isArray(next.entries) ? next.entries : [];
  next.entries.push({ type: 'reserve', reservation_id: reservationId, cost_units: amount, provider_id: clean(request.provider_id, 120) || null, capability: clean(request.capability, 120) || null, mission_id: clean(request.mission_id, 160) || null, task_id: clean(request.task_id, 160) || null });
  return { ok: true, reservation_id: reservationId, reserved_cost_units: amount, ledger: costLedgerSnapshot(next) };
}

function reservedAmount(ledger, reservationId) {
  const reserve = (ledger.entries || []).find((entry) => entry.type === 'reserve' && entry.reservation_id === reservationId);
  if (!reserve) return null;
  const terminal = (ledger.entries || []).find((entry) => ['settle', 'release'].includes(entry.type) && entry.reservation_id === reservationId);
  return terminal ? null : Math.max(0, finite(reserve.cost_units));
}

export function settleCost(ledger = {}, request = {}) {
  const reservationId = clean(request.reservation_id, 160);
  if (!reservationId) return { ok: false, error: 'COST_RESERVATION_ID_REQUIRED', ledger: costLedgerSnapshot(ledger) };
  const reserved = reservedAmount(ledger, reservationId);
  if (reserved === null) return { ok: false, error: 'ACTIVE_COST_RESERVATION_NOT_FOUND', reservation_id: reservationId, ledger: costLedgerSnapshot(ledger) };
  const actual = Math.max(0, finite(request.actual_cost_units, reserved));
  const additional = Math.max(0, actual - reserved);
  if (additional > remaining(ledger)) return { ok: false, error: 'PROJECT_BUDGET_EXCEEDED_ON_SETTLEMENT', reservation_id: reservationId, requested_additional_cost_units: additional, remaining_cost_units: remaining(ledger), ledger: costLedgerSnapshot(ledger) };
  const next = clone(ledger);
  next.reserved_cost_units = Math.max(0, finite(next.reserved_cost_units) - reserved);
  next.spent_cost_units = finite(next.spent_cost_units) + actual;
  next.revision = finite(next.revision) + 1;
  next.entries.push({ type: 'settle', reservation_id: reservationId, reserved_cost_units: reserved, actual_cost_units: actual });
  return { ok: true, reservation_id: reservationId, actual_cost_units: actual, ledger: costLedgerSnapshot(next) };
}

export function releaseCost(ledger = {}, request = {}) {
  const reservationId = clean(request.reservation_id, 160);
  if (!reservationId) return { ok: false, error: 'COST_RESERVATION_ID_REQUIRED', ledger: costLedgerSnapshot(ledger) };
  const reserved = reservedAmount(ledger, reservationId);
  if (reserved === null) return { ok: false, error: 'ACTIVE_COST_RESERVATION_NOT_FOUND', reservation_id: reservationId, ledger: costLedgerSnapshot(ledger) };
  const next = clone(ledger);
  next.reserved_cost_units = Math.max(0, finite(next.reserved_cost_units) - reserved);
  next.revision = finite(next.revision) + 1;
  next.entries.push({ type: 'release', reservation_id: reservationId, released_cost_units: reserved, reason: clean(request.reason, 240) || null });
  return { ok: true, reservation_id: reservationId, released_cost_units: reserved, ledger: costLedgerSnapshot(next) };
}

export function runtimeCostLedgerManifest() {
  return { version: 'riosystems.cost-ledger.v1', supports: ['reserve', 'settle', 'release', 'idempotent_reservation'], scope_isolated: true, production_deploy: false };
}
