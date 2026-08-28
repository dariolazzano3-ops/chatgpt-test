import { createProviderRegistry, routeProvider, evaluateRuntimeGovernance } from './runtime-governance.js';
import { createCostLedger, reserveCost, costLedgerSnapshot } from './runtime-cost-ledger.js';
import { evaluateApproval } from './runtime-approvals.js';
import { createProjectBoundary } from './runtime-project-boundary.js';
import { buildProviderAttemptPlan } from './provider-runtime.js';

const clone = (value) => structuredClone(value ?? null);
const clean = (value, max = 160) => String(value || '').trim().slice(0, max);

function missionCapabilities(pkg = {}) {
  const map = { web: 'web.build', automation: 'automation.run', ai: 'ai.generate', business: 'business.configure' };
  const seen = new Set();
  const out = [];
  for (const task of pkg.mission?.tasks || []) {
    const engine = ['web', 'automation', 'ai', 'business'].includes(task.domain) ? task.domain : task.engine;
    const capability = map[engine] || clean(task.capability, 120) || `${engine || 'unknown'}.execute`;
    const key = `${task.task_id}:${capability}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ task_id: task.task_id, engine, capability });
  }
  return out;
}

function approvalFlags(records, scope, route) {
  const cost = evaluateApproval(records, { ...scope, approval_type: 'provider_cost', provider_id: route.provider.id, capability: route.capability });
  const external = evaluateApproval(records, { ...scope, approval_type: 'external_provider', provider_id: route.provider.id, capability: route.capability });
  return { cost_approved: cost.approved === true, external_provider_approved: external.approved === true, records: { cost, external } };
}

export function evaluateMissionRuntime(pkg = {}, config = {}) {
  if (!pkg?.mission) return { ok: false, error: 'MISSION_PACKAGE_INVALID', production_deploy: false };
  const scope = {
    customer_id: clean(config.customer_id || config.project?.customer_id, 120),
    project_id: clean(config.project_id || config.project?.project_id || pkg.mission.project, 120)
  };
  if (!scope.customer_id || !scope.project_id) return { ok: false, error: 'PROJECT_SCOPE_REQUIRED', user_action_required: true, production_deploy: false };

  const registry = config.registry?.registry_version ? config.registry : createProviderRegistry(config.providers || []);
  const ledgerResult = config.ledger?.ledger_version ? { ok: true, ledger: clone(config.ledger) } : createCostLedger({ ...scope, limit_cost_units: config.limit_cost_units });
  if (!ledgerResult.ok) return { ...ledgerResult, production_deploy: false };
  let ledger = ledgerResult.ledger;
  const approvals = Array.isArray(config.approvals) ? config.approvals : [];
  const health = config.provider_health || {};
  const tasks = [];
  const blockers = [];

  for (const item of missionCapabilities(pkg)) {
    const route = routeProvider(registry, { capability: item.capability, preferred_provider: config.preferred_providers?.[item.capability] });
    if (!route.ok) {
      blockers.push({ task_id: item.task_id, engine: item.engine, capability: item.capability, code: route.error });
      tasks.push({ ...item, route });
      continue;
    }
    const flags = approvalFlags(approvals, scope, route);
    const governance = evaluateRuntimeGovernance({
      project: scope,
      provider: route.provider,
      budget: { remaining_cost_units: costLedgerSnapshot(ledger).remaining_cost_units },
      approvals: flags,
      production_deploy: false
    });
    const attemptPlan = buildProviderAttemptPlan(route, health);
    const task = { ...item, route: { ...route, runner: undefined }, governance, approval_evidence: flags.records, attempt_plan: attemptPlan };
    if (!governance.ok || governance.blocked || !attemptPlan.ok) {
      const codes = governance.blockers?.map((entry) => entry.code) || [];
      if (!attemptPlan.ok) codes.push(attemptPlan.error);
      for (const code of codes) blockers.push({ task_id: item.task_id, engine: item.engine, capability: item.capability, provider_id: route.provider.id, code });
      tasks.push(task);
      continue;
    }
    const reservationId = `${pkg.mission.mission_id}:${item.task_id}:${route.provider.id}`;
    const reserved = reserveCost(ledger, { reservation_id: reservationId, cost_units: route.provider.estimated_cost_units, provider_id: route.provider.id, capability: item.capability, mission_id: pkg.mission.mission_id, task_id: item.task_id });
    if (!reserved.ok) blockers.push({ task_id: item.task_id, engine: item.engine, capability: item.capability, provider_id: route.provider.id, code: reserved.error });
    else ledger = reserved.ledger;
    tasks.push({ ...task, reservation: reserved.ok ? { reservation_id: reservationId, reserved_cost_units: reserved.reserved_cost_units, duplicate: reserved.duplicate === true } : null });
  }

  const boundaryResult = createProjectBoundary({ ...scope, project_root: config.project_root || `projects/${scope.project_id}`, allowed_paths: config.allowed_paths, owner: config.owner });
  if (!boundaryResult.ok) blockers.push({ code: boundaryResult.error, engine: 'global' });
  return {
    ok: true,
    runtime_version: 'riosystems.control-plane.v1',
    scope: { ...scope, scope_key: `${scope.customer_id}:${scope.project_id}` },
    provider_registry_version: registry.registry_version,
    tasks,
    blockers,
    blocked: blockers.length > 0,
    ready_for_supervised_execution: blockers.length === 0,
    ledger: costLedgerSnapshot(ledger),
    project_boundary: boundaryResult.ok ? boundaryResult.boundary : null,
    user_action_required: blockers.length > 0,
    production_deploy: false
  };
}

export function runtimeControlPlaneManifest() {
  return {
    version: 'riosystems.control-plane.v1',
    stages: ['scope', 'provider_route', 'scoped_approvals', 'budget_reservation', 'health_fallback_plan', 'project_boundary'],
    mission_pipeline_integration: true,
    customer_project_isolation: true,
    durable_cost_ledger_contract: true,
    automatic_external_activation: false,
    production_deploy: false
  };
}
