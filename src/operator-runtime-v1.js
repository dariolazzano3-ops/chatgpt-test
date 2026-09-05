import { createCommandCenterState } from './command-center.js';
import { buildOperatorControlPlane } from './operator-control-plane-v1.js';
import { buildOperatorDashboardView } from './operator-dashboard-v1.js';
import { runUniversalMission } from './universal-mission-run.js';

const clone = (value) => structuredClone(value ?? null);
const clean = (value, max = 240) => String(value ?? '').trim().slice(0, max);
const nowIso = (input) => clean(input, 80) || new Date().toISOString();

function validRuntime(runtime = {}) {
  return runtime?.schema === 'riosystems.operator-runtime.v1'
    && clean(runtime.operator_id, 160)
    && Number.isInteger(runtime.revision)
    && runtime.revision >= 1
    && runtime.command_center_state
    && typeof runtime.command_center_state === 'object';
}

function projectByScope(runtime = {}, scopeKey = '') {
  return (runtime.command_center_state?.portfolio?.projects || []).find((item) => item.scope_key === scopeKey) || null;
}

function checkRevision(runtime = {}, expectedRevision) {
  if (!Number.isInteger(Number(expectedRevision))) {
    return { ok: false, error: 'RUNTIME_EXPECTED_REVISION_REQUIRED', expected_revision: null, actual_revision: runtime.revision, production_deploy: false };
  }
  const expected = Number(expectedRevision);
  if (expected !== runtime.revision) {
    return { ok: false, error: 'RUNTIME_REVISION_CONFLICT', expected_revision: expected, actual_revision: runtime.revision, production_deploy: false };
  }
  return { ok: true };
}

function advanceRuntime(runtime = {}, event = {}, at = null) {
  const next = clone(runtime);
  next.revision += 1;
  next.updated_at = nowIso(at);
  next.audit = [
    ...(next.audit || []),
    {
      event: clean(event.event, 120) || 'RUNTIME_UPDATED',
      actor: runtime.operator_id,
      scope_key: clean(event.scope_key, 260) || null,
      mission_id: clean(event.mission_id, 180) || null,
      command_id: clean(event.command_id, 180) || null,
      at: next.updated_at
    }
  ];
  return next;
}

export function createOperatorRuntime(input = {}) {
  const operatorId = clean(input.operator_id, 160);
  if (!operatorId) return { ok: false, error: 'OPERATOR_RUNTIME_OPERATOR_REQUIRED', production_deploy: false };

  let commandCenterState = clone(input.command_center_state || null);
  if (!commandCenterState) {
    const created = createCommandCenterState({
      operator_id: operatorId,
      portfolio: input.portfolio || { operator_id: operatorId, projects: [] },
      approvals: input.approvals || [],
      integration_health: input.integration_health || {},
      execution_runs: input.execution_runs || [],
      alerts: input.alerts || [],
      at: input.at
    });
    if (!created.ok) return { ok: false, error: created.error || 'OPERATOR_RUNTIME_COMMAND_CENTER_FAILED', production_deploy: false };
    commandCenterState = created.state;
  }
  if (commandCenterState.operator_id && commandCenterState.operator_id !== operatorId) {
    return { ok: false, error: 'OPERATOR_RUNTIME_OPERATOR_SCOPE_MISMATCH', production_deploy: false };
  }

  const selectedScope = clean(input.selected_project_scope, 260) || null;
  if (selectedScope && !(commandCenterState.portfolio?.projects || []).some((item) => item.scope_key === selectedScope)) {
    return { ok: false, error: 'OPERATOR_RUNTIME_SELECTED_PROJECT_NOT_FOUND', scope_key: selectedScope, production_deploy: false };
  }

  const at = nowIso(input.at);
  return {
    ok: true,
    runtime: {
      schema: 'riosystems.operator-runtime.v1',
      runtime_version: '1.0',
      operator_id: operatorId,
      revision: 1,
      selected_project_scope: selectedScope,
      command_center_state: commandCenterState,
      missions: clone(input.missions || []),
      universal_runs: clone(input.universal_runs || []),
      created_at: at,
      updated_at: at,
      audit: [{ event: 'OPERATOR_RUNTIME_CREATED', actor: operatorId, at }],
      safety: {
        synthetic_staging_default: true,
        external_writes_implicit: false,
        automatic_dispatch: false,
        automatic_paid_overflow: false,
        production_deploy: false
      }
    },
    production_deploy: false
  };
}

export function buildOperatorRuntimeSnapshot(runtime = {}) {
  if (!validRuntime(runtime)) return { ok: false, error: 'VALID_OPERATOR_RUNTIME_REQUIRED', production_deploy: false };
  const controlPlane = buildOperatorControlPlane({
    operator_id: runtime.operator_id,
    command_center_state: runtime.command_center_state,
    missions: runtime.missions || []
  });
  if (!controlPlane.ok) return controlPlane;
  const dashboard = buildOperatorDashboardView(controlPlane);
  if (!dashboard.ok) return dashboard;

  const universalRuns = runtime.universal_runs || [];
  return {
    ok: true,
    schema: 'riosystems.operator-runtime.snapshot.v1',
    runtime: {
      operator_id: runtime.operator_id,
      revision: runtime.revision,
      selected_project_scope: runtime.selected_project_scope,
      created_at: runtime.created_at,
      updated_at: runtime.updated_at
    },
    control_plane: controlPlane,
    dashboard,
    universal_missions: {
      count: universalRuns.length,
      successful_count: universalRuns.filter((run) => run.ok === true).length,
      blocked_count: universalRuns.filter((run) => run.ok !== true).length,
      latest_mission_id: universalRuns.at(-1)?.mission?.mission_id || null,
      variable_cost_eur: universalRuns.reduce((sum, run) => sum + Number(run.execution?.variable_cost_eur || 0), 0)
    },
    safety: clone(runtime.safety),
    production_deploy: false
  };
}

export function selectOperatorRuntimeProject(runtime = {}, scopeKey, expectedRevision, options = {}) {
  if (!validRuntime(runtime)) return { ok: false, error: 'VALID_OPERATOR_RUNTIME_REQUIRED', production_deploy: false };
  const revision = checkRevision(runtime, expectedRevision);
  if (!revision.ok) return revision;

  const scope = clean(scopeKey, 260);
  const project = projectByScope(runtime, scope);
  if (!project) return { ok: false, error: 'OPERATOR_RUNTIME_PROJECT_NOT_FOUND', scope_key: scope, production_deploy: false };
  if (runtime.selected_project_scope === scope) return { ok: true, runtime: clone(runtime), changed: false, project: clone(project), production_deploy: false };

  const next = advanceRuntime(runtime, { event: 'OPERATOR_PROJECT_SELECTED', scope_key: scope }, options.at);
  next.selected_project_scope = scope;
  return { ok: true, runtime: next, changed: true, project: clone(project), production_deploy: false };
}

export function recordOperatorRuntimeCommandState(runtime = {}, commandCenterState = {}, command = {}, expectedRevision, options = {}) {
  if (!validRuntime(runtime)) return { ok: false, error: 'VALID_OPERATOR_RUNTIME_REQUIRED', production_deploy: false };
  const revision = checkRevision(runtime, expectedRevision);
  if (!revision.ok) return revision;
  if (!commandCenterState || typeof commandCenterState !== 'object') {
    return { ok: false, error: 'COMMAND_CENTER_STATE_REQUIRED', production_deploy: false };
  }

  const before = JSON.stringify(runtime.command_center_state);
  const after = JSON.stringify(commandCenterState);
  if (before === after) return { ok: true, runtime: clone(runtime), changed: false, production_deploy: false };

  const next = advanceRuntime(runtime, {
    event: 'COMMAND_CENTER_STATE_RECORDED',
    scope_key: command.scope_key,
    command_id: command.command_id
  }, options.at);
  next.command_center_state = clone(commandCenterState);
  return { ok: true, runtime: next, changed: true, production_deploy: false };
}

export function recordOperatorRuntimeProjectDelivery(runtime = {}, project = {}, delivery = {}, expectedRevision, options = {}) {
  if (!validRuntime(runtime)) return { ok: false, error: 'VALID_OPERATOR_RUNTIME_REQUIRED', production_deploy: false };
  const revision = checkRevision(runtime, expectedRevision);
  if (!revision.ok) return revision;
  const scope = clean(project.scope_key || delivery.scope_key, 260);
  if (!scope) return { ok: false, error: 'PROJECT_SCOPE_REQUIRED', production_deploy: false };
  const index = (runtime.command_center_state?.portfolio?.projects || []).findIndex((item) => item.scope_key === scope);
  if (index < 0) return { ok: false, error: 'OPERATOR_RUNTIME_PROJECT_NOT_FOUND', scope_key: scope, production_deploy: false };
  const currentProject = runtime.command_center_state.portfolio.projects[index];
  if (project.customer_id && project.customer_id !== currentProject.customer_id) return { ok: false, error: 'OPERATOR_RUNTIME_DELIVERY_CUSTOMER_SCOPE_MISMATCH', production_deploy: false };
  if (project.project_id && project.project_id !== currentProject.project_id) return { ok: false, error: 'OPERATOR_RUNTIME_DELIVERY_PROJECT_SCOPE_MISMATCH', production_deploy: false };

  const before = JSON.stringify(currentProject);
  const after = JSON.stringify(project);
  if (before === after) return { ok: true, runtime: clone(runtime), changed: false, project: clone(currentProject), production_deploy: false };

  const next = advanceRuntime(runtime, {
    event: 'CANONICAL_PROJECT_DELIVERY_RECORDED',
    scope_key: scope,
    mission_id: delivery.mission_id
  }, options.at);
  next.command_center_state.portfolio.projects[index] = clone(project);

  const missionId = clean(delivery.mission_id, 180);
  if (missionId) {
    const existingMission = (next.missions || []).findIndex((item) => item.mission_id === missionId);
    const summary = {
      mission_id: missionId,
      scope_key: scope,
      status: clean(delivery.mission_status || 'DELIVERED', 80),
      delivery_id: clean(delivery.delivery_id || delivery.id, 180) || null,
      quality_status: clean(delivery.quality?.status, 80) || null,
      actual_cost: Number.isFinite(Number(delivery.actual_cost)) ? Number(delivery.actual_cost) : 0,
      production_deploy: false
    };
    if (existingMission >= 0) next.missions[existingMission] = { ...next.missions[existingMission], ...summary };
    else next.missions = [...(next.missions || []), summary];
  }
  return { ok: true, runtime: next, changed: true, project: clone(project), production_deploy: false };
}

export function runOperatorSyntheticMission(runtime = {}, input = {}, expectedRevision, options = {}) {
  if (!validRuntime(runtime)) return { ok: false, error: 'VALID_OPERATOR_RUNTIME_REQUIRED', production_deploy: false };
  const revision = checkRevision(runtime, expectedRevision);
  if (!revision.ok) return revision;

  const selected = runtime.selected_project_scope ? projectByScope(runtime, runtime.selected_project_scope) : null;
  if (!selected && (!clean(input.customer_id, 160) || !clean(input.project_id, 160))) {
    return { ok: false, error: 'SELECTED_PROJECT_OR_EXPLICIT_PROJECT_REQUIRED', production_deploy: false };
  }
  if (selected && input.customer_id && clean(input.customer_id, 160) !== selected.customer_id) {
    return { ok: false, error: 'UNIVERSAL_MISSION_CUSTOMER_SCOPE_MISMATCH', production_deploy: false };
  }
  if (selected && input.project_id && clean(input.project_id, 160) !== selected.project_id) {
    return { ok: false, error: 'UNIVERSAL_MISSION_PROJECT_SCOPE_MISMATCH', production_deploy: false };
  }

  const missionInput = {
    ...clone(input),
    customer_id: clean(input.customer_id, 160) || selected?.customer_id,
    project_id: clean(input.project_id, 160) || selected?.project_id,
    business_name: clean(input.business_name, 200) || selected?.name || 'Synthetic business'
  };
  const run = runUniversalMission(missionInput, options.universal_options || {});
  if (!run.ok) {
    return { ok: false, error: run.error || 'UNIVERSAL_MISSION_RUN_BLOCKED', run, runtime: clone(runtime), changed: false, production_deploy: false };
  }
  if (run.execution?.real_providers_involved?.length || run.execution?.variable_cost_eur !== 0 || run.delivery?.production_deploy !== false) {
    return { ok: false, error: 'UNIVERSAL_MISSION_RUNTIME_SAFETY_VIOLATION', run, runtime: clone(runtime), changed: false, production_deploy: false };
  }

  const next = advanceRuntime(runtime, {
    event: 'SYNTHETIC_UNIVERSAL_MISSION_RECORDED',
    scope_key: selected?.scope_key || null,
    mission_id: run.mission.mission_id
  }, options.at);
  next.universal_runs = [...(next.universal_runs || []), clone(run)];
  return { ok: true, runtime: next, changed: true, run, production_deploy: false };
}

export function operatorRuntimeManifest() {
  return {
    schema: 'riosystems.operator-runtime.v1',
    mode: 'single_operator_stateful_control_runtime',
    state_revision_guard: 'compare_and_swap_required_for_mutations',
    consumes: ['operator-control-plane-v1','operator-dashboard-v1','command-center','universal-mission-run-v1'],
    local_mutations: ['select_project','record_command_center_state','record_canonical_project_delivery','record_synthetic_universal_mission'],
    automatic_dispatch: false,
    external_writes: false,
    automatic_paid_overflow: false,
    production_deploy: false
  };
}
