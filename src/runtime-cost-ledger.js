const clean = (value, max = 160) => String(value || '').trim().slice(0, max);
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clone = (value) => structuredClone(value ?? null);

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value ?? null;
}

function same(valueA, valueB) {
  return JSON.stringify(canonical(valueA)) === JSON.stringify(canonical(valueB));
}

function scopeMatches(ledger = {}, request = {}) {
  if (request.customer_id && clean(request.customer_id, 120) !== ledger.customer_id) return false;
  if (request.project_id && clean(request.project_id, 120) !== ledger.project_id) return false;
  if (request.scope_key && clean(request.scope_key, 260) !== ledger.scope_key) return false;
  return true;
}

function terminalEntry(ledger = {}, reservationId = '') {
  return (ledger.entries || []).find((entry) => ['settle', 'release'].includes(entry.type) && entry.reservation_id === reservationId) || null;
}

function reserveEntry(ledger = {}, reservationId = '') {
  return (ledger.entries || []).find((entry) => entry.type === 'reserve' && entry.reservation_id === reservationId) || null;
}

function bindingMatches(reserve = {}, request = {}) {
  if (request.execution_id && (reserve.execution_id || null) !== (clean(request.execution_id, 200) || null)) return false;
  if (request.binding && !same(reserve.binding || null, request.binding)) return false;
  return true;
}

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
  if (!scopeMatches(ledger, request)) return { ok: false, error: 'COST_RESERVATION_SCOPE_MISMATCH', reservation_id: reservationId, ledger: costLedgerSnapshot(ledger) };

  const existingReserve = reserveEntry(ledger, reservationId);
  if (existingReserve) {
    const identical = finite(existingReserve.cost_units) === amount
      && (existingReserve.provider_id || null) === (clean(request.provider_id, 120) || null)
      && (existingReserve.capability || null) === (clean(request.capability, 120) || null)
      && (existingReserve.mission_id || null) === (clean(request.mission_id, 160) || null)
      && (existingReserve.task_id || null) === (clean(request.task_id, 160) || null)
      && (existingReserve.execution_id || null) === (clean(request.execution_id, 200) || null)
      && same(existingReserve.binding || null, request.binding || null);
    if (!identical) return { ok: false, error: 'COST_RESERVATION_IDEMPOTENCY_CONFLICT', reservation_id: reservationId, ledger: costLedgerSnapshot(ledger) };
    const terminal = terminalEntry(ledger, reservationId);
    if (terminal) return { ok: false, error: 'COST_RESERVATION_ALREADY_TERMINAL', reservation_id: reservationId, terminal_type: terminal.type, ledger: costLedgerSnapshot(ledger) };
    return { ok: true, duplicate: true, reservation_id: reservationId, reserved_cost_units: amount, ledger: costLedgerSnapshot(ledger) };
  }

  const available = remaining(ledger);
  if (amount > available) return { ok: false, error: 'PROJECT_BUDGET_EXCEEDED', requested_cost_units: amount, remaining_cost_units: available, ledger: costLedgerSnapshot(ledger) };
  const next = clone(ledger);
  next.reserved_cost_units = finite(next.reserved_cost_units) + amount;
  next.revision = finite(next.revision) + 1;
  next.entries = Array.isArray(next.entries) ? next.entries : [];
  next.entries.push({
    type: 'reserve',
    reservation_id: reservationId,
    cost_units: amount,
    provider_id: clean(request.provider_id, 120) || null,
    capability: clean(request.capability, 120) || null,
    mission_id: clean(request.mission_id, 160) || null,
    task_id: clean(request.task_id, 160) || null,
    execution_id: clean(request.execution_id, 200) || null,
    binding: request.binding && typeof request.binding === 'object' ? clone(request.binding) : null
  });
  return { ok: true, reservation_id: reservationId, reserved_cost_units: amount, ledger: costLedgerSnapshot(next) };
}

function reservedAmount(ledger, reservationId) {
  const reserve = reserveEntry(ledger, reservationId);
  if (!reserve) return null;
  return terminalEntry(ledger, reservationId) ? null : Math.max(0, finite(reserve.cost_units));
}

export function settleCost(ledger = {}, request = {}) {
  const reservationId = clean(request.reservation_id, 160);
  if (!reservationId) return { ok: false, error: 'COST_RESERVATION_ID_REQUIRED', ledger: costLedgerSnapshot(ledger) };
  if (!scopeMatches(ledger, request)) return { ok: false, error: 'COST_SETTLEMENT_SCOPE_MISMATCH', reservation_id: reservationId, ledger: costLedgerSnapshot(ledger) };

  const reserve = reserveEntry(ledger, reservationId);
  if (!reserve) return { ok: false, error: 'ACTIVE_COST_RESERVATION_NOT_FOUND', reservation_id: reservationId, ledger: costLedgerSnapshot(ledger) };
  if (!bindingMatches(reserve, request)) return { ok: false, error: 'COST_SETTLEMENT_BINDING_MISMATCH', reservation_id: reservationId, ledger: costLedgerSnapshot(ledger) };

  const priorTerminal = terminalEntry(ledger, reservationId);
  const actualRequested = Math.max(0, finite(request.actual_cost_units, reserve.cost_units));
  if (priorTerminal) {
    if (priorTerminal.type === 'settle' && finite(priorTerminal.actual_cost_units) === actualRequested) {
      return { ok: true, duplicate: true, reservation_id: reservationId, actual_cost_units: actualRequested, ledger: costLedgerSnapshot(ledger) };
    }
    return { ok: false, error: 'COST_TERMINAL_IDEMPOTENCY_CONFLICT', reservation_id: reservationId, terminal_type: priorTerminal.type, ledger: costLedgerSnapshot(ledger) };
  }

  const reserved = Math.max(0, finite(reserve.cost_units));
  const actual = actualRequested;
  const additional = Math.max(0, actual - reserved);
  if (additional > remaining(ledger)) return { ok: false, error: 'PROJECT_BUDGET_EXCEEDED_ON_SETTLEMENT', reservation_id: reservationId, requested_additional_cost_units: additional, remaining_cost_units: remaining(ledger), ledger: costLedgerSnapshot(ledger) };
  const next = clone(ledger);
  next.reserved_cost_units = Math.max(0, finite(next.reserved_cost_units) - reserved);
  next.spent_cost_units = finite(next.spent_cost_units) + actual;
  next.revision = finite(next.revision) + 1;
  next.entries.push({ type: 'settle', reservation_id: reservationId, reserved_cost_units: reserved, actual_cost_units: actual, execution_id: reserve.execution_id || null });
  return { ok: true, reservation_id: reservationId, actual_cost_units: actual, ledger: costLedgerSnapshot(next) };
}

export function releaseCost(ledger = {}, request = {}) {
  const reservationId = clean(request.reservation_id, 160);
  if (!reservationId) return { ok: false, error: 'COST_RESERVATION_ID_REQUIRED', ledger: costLedgerSnapshot(ledger) };
  if (!scopeMatches(ledger, request)) return { ok: false, error: 'COST_RELEASE_SCOPE_MISMATCH', reservation_id: reservationId, ledger: costLedgerSnapshot(ledger) };

  const reserve = reserveEntry(ledger, reservationId);
  if (!reserve) return { ok: false, error: 'ACTIVE_COST_RESERVATION_NOT_FOUND', reservation_id: reservationId, ledger: costLedgerSnapshot(ledger) };
  if (!bindingMatches(reserve, request)) return { ok: false, error: 'COST_RELEASE_BINDING_MISMATCH', reservation_id: reservationId, ledger: costLedgerSnapshot(ledger) };

  const priorTerminal = terminalEntry(ledger, reservationId);
  if (priorTerminal) {
    if (priorTerminal.type === 'release') {
      return { ok: true, duplicate: true, reservation_id: reservationId, released_cost_units: Math.max(0, finite(reserve.cost_units)), ledger: costLedgerSnapshot(ledger) };
    }
    return { ok: false, error: 'COST_TERMINAL_IDEMPOTENCY_CONFLICT', reservation_id: reservationId, terminal_type: priorTerminal.type, ledger: costLedgerSnapshot(ledger) };
  }

  const reserved = Math.max(0, finite(reserve.cost_units));
  const next = clone(ledger);
  next.reserved_cost_units = Math.max(0, finite(next.reserved_cost_units) - reserved);
  next.revision = finite(next.revision) + 1;
  next.entries.push({ type: 'release', reservation_id: reservationId, released_cost_units: reserved, execution_id: reserve.execution_id || null, reason: clean(request.reason, 240) || null });
  return { ok: true, reservation_id: reservationId, released_cost_units: reserved, ledger: costLedgerSnapshot(next) };
}

export function runtimeCostLedgerManifest() {
  return {
    version: 'riosystems.cost-ledger.v1',
    supports: ['reserve', 'settle', 'release', 'idempotent_reservation', 'idempotent_terminal_replay', 'execution_binding', 'project_scope_validation'],
    scope_isolated: true,
    retry_double_billing_blocked: true,
    legacy_classification: 'ADAPT',
    legacy_cost_truth_status: 'MIGRATED_TO_CANONICAL_RUNTIME_COST_LEDGER',
    canonical_cost_truth: true,
    parallel_cost_engine: false,
    production_deploy: false
  };
}
