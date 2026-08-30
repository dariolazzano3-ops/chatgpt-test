import { commandCenterRequest } from './command-center-api.js';
import {
  buildOperatorRuntimeSnapshot,
  selectOperatorRuntimeProject,
  recordOperatorRuntimeCommandState,
  runOperatorSyntheticMission
} from './operator-runtime-v1.js';

const clone = (value) => structuredClone(value ?? null);
const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);

function normalizedPath(value) {
  const raw = clean(value || '/', 500).split('?')[0] || '/';
  return raw.length > 1 ? raw.replace(/\/+$/, '') : raw;
}

function decodeSegment(value = '') {
  try { return decodeURIComponent(value); } catch { return value; }
}

function response(status, body, runtime, extras = {}) {
  return {
    ok: status >= 200 && status < 400,
    status,
    body,
    runtime: clone(runtime),
    changed: extras.changed === true,
    user_action_required: extras.user_action_required === true,
    dispatch: extras.dispatch || null,
    production_deploy: false
  };
}

function snapshotOrError(runtime) {
  const snapshot = buildOperatorRuntimeSnapshot(runtime);
  return snapshot.ok ? { ok: true, snapshot } : { ok: false, response: response(500, snapshot, runtime) };
}

function findMission(snapshot, runtime, missionId) {
  const durable = (snapshot.control_plane.deliveries.mission_reports || []).find((item) => item.mission_id === missionId);
  if (durable) return { kind: 'durable_mission', mission: durable };
  const universal = (runtime.universal_runs || []).find((item) => item.mission?.mission_id === missionId);
  if (universal) return { kind: 'universal_mission', mission: clone(universal) };
  return null;
}

export function operatorRuntimeRequest(runtime = {}, request = {}, options = {}) {
  const method = clean(request.method, 20).toUpperCase() || 'GET';
  const path = normalizedPath(request.path);
  const expectedRevision = request.expected_revision ?? request.body?.expected_revision;

  const snapResult = snapshotOrError(runtime);
  if (!snapResult.ok) return snapResult.response;
  const snapshot = snapResult.snapshot;

  if (method === 'GET' && path === '/health') {
    return response(200, {
      schema: 'riosystems.operator-runtime.health.v1',
      status: 'READY',
      operator_id: runtime.operator_id,
      revision: runtime.revision,
      control_plane_status: snapshot.control_plane.readiness.status,
      production: 'LOCKED',
      external_writes: 'EXPLICIT_APPROVAL_ONLY',
      automatic_dispatch: false,
      automatic_paid_overflow: false
    }, runtime);
  }

  if (method === 'GET' && path === '/snapshot') return response(200, snapshot, runtime);
  if (method === 'GET' && path === '/dashboard') return response(200, snapshot.dashboard, runtime);
  if (method === 'GET' && path === '/factories') return response(200, snapshot.control_plane.factories, runtime);
  if (method === 'GET' && path === '/approvals') return response(200, snapshot.control_plane.command_center.approvals, runtime);
  if (method === 'GET' && path === '/actions') return response(200, snapshot.control_plane.next_actions, runtime);

  if (method === 'GET' && path === '/projects') {
    return response(200, {
      selected_project_scope: runtime.selected_project_scope,
      items: clone(snapshot.control_plane.command_center.queue)
    }, runtime);
  }

  const projectMatch = path.match(/^\/projects\/([^/]+)$/);
  if (method === 'GET' && projectMatch) {
    const scope = decodeSegment(projectMatch[1]);
    const project = (snapshot.control_plane.command_center.queue || []).find((item) => item.scope_key === scope);
    return project ? response(200, project, runtime) : response(404, { error: 'PROJECT_NOT_FOUND', scope_key: scope }, runtime);
  }

  const projectSelectMatch = path.match(/^\/projects\/([^/]+)\/select$/);
  if (method === 'POST' && projectSelectMatch) {
    const scope = decodeSegment(projectSelectMatch[1]);
    const selected = selectOperatorRuntimeProject(runtime, scope, Number(expectedRevision), { at: options.at });
    if (!selected.ok) {
      const status = selected.error === 'RUNTIME_REVISION_CONFLICT' || selected.error === 'RUNTIME_EXPECTED_REVISION_REQUIRED' ? 409 : 404;
      return response(status, selected, runtime);
    }
    return response(200, { selected_project_scope: scope, revision: selected.runtime.revision, project: selected.project }, selected.runtime, { changed: selected.changed });
  }

  if (method === 'GET' && path === '/missions') {
    return response(200, {
      durable: clone(snapshot.control_plane.deliveries.mission_reports),
      universal: clone(runtime.universal_runs || []).map((run) => ({
        mission_id: run.mission?.mission_id || null,
        project_id: run.mission?.project_id || null,
        business_name: run.mission?.business_name || null,
        status: run.delivery?.final_delivery_status || null,
        quality_score: run.quality?.quality_score ?? null,
        variable_cost_eur: run.execution?.variable_cost_eur ?? null,
        production_deploy: false
      }))
    }, runtime);
  }

  const missionMatch = path.match(/^\/missions\/([^/]+)$/);
  if (method === 'GET' && missionMatch) {
    const missionId = decodeSegment(missionMatch[1]);
    const found = findMission(snapshot, runtime, missionId);
    return found ? response(200, found, runtime) : response(404, { error: 'MISSION_NOT_FOUND', mission_id: missionId }, runtime);
  }

  if (method === 'GET' && path === '/deliveries') {
    return response(200, {
      live_proofs: clone(snapshot.control_plane.deliveries.live_proofs),
      durable_missions: clone(snapshot.control_plane.deliveries.mission_reports),
      universal_missions: clone(runtime.universal_runs || []).map((run) => clone(run.delivery))
    }, runtime);
  }

  if (method === 'POST' && path === '/universal-missions') {
    const result = runOperatorSyntheticMission(runtime, request.body || {}, Number(expectedRevision), {
      at: options.at,
      universal_options: options.universal_options || {}
    });
    if (!result.ok) {
      const status = result.error?.includes('REVISION') ? 409 : 400;
      return response(status, result, runtime);
    }
    return response(201, {
      mission_id: result.run.mission.mission_id,
      status: result.run.delivery.final_delivery_status,
      quality_score: result.run.quality.quality_score,
      selected_capabilities: result.run.delivery.selected_capabilities,
      variable_cost_eur: result.run.execution.variable_cost_eur,
      real_provider_calls: result.run.delivery.execution_evidence.real_provider_calls,
      external_writes: result.run.delivery.execution_evidence.external_writes,
      production_deploy: false,
      revision: result.runtime.revision
    }, result.runtime, { changed: true });
  }

  if (method === 'POST' && path === '/commands') {
    if (!Number.isInteger(Number(expectedRevision))) {
      return response(409, { error: 'RUNTIME_EXPECTED_REVISION_REQUIRED', actual_revision: runtime.revision }, runtime);
    }
    if (Number(expectedRevision) !== runtime.revision) {
      return response(409, { error: 'RUNTIME_REVISION_CONFLICT', expected_revision: Number(expectedRevision), actual_revision: runtime.revision }, runtime);
    }

    const delegated = commandCenterRequest(
      runtime.command_center_state,
      { method: 'POST', path: '/commands', body: request.body || {} },
      { dispatch: options.dispatch }
    );

    if (!delegated.ok) return response(delegated.status || 400, delegated.body, runtime);
    const recorded = recordOperatorRuntimeCommandState(
      runtime,
      delegated.state,
      delegated.body || {},
      runtime.revision,
      { at: options.at }
    );
    if (!recorded.ok) return response(409, recorded, runtime);

    const body = {
      command: clone(delegated.body),
      runtime_revision: recorded.runtime.revision,
      dispatch_prepared: Boolean(delegated.dispatch?.fn),
      dispatch_executed: false,
      user_action_required: delegated.user_action_required === true,
      production_deploy: false
    };
    return response(delegated.status || 200, body, recorded.runtime, {
      changed: recorded.changed,
      user_action_required: delegated.user_action_required === true,
      dispatch: delegated.dispatch || null
    });
  }

  return response(404, { error: 'OPERATOR_RUNTIME_ROUTE_NOT_FOUND', method, path }, runtime);
}

export function createOperatorRuntimeApiService({ operator_id, store, initial_runtime = null, dispatch = null } = {}) {
  const operatorId = clean(operator_id, 160);
  if (!operatorId) throw new Error('OPERATOR_ID_REQUIRED');
  if (!store || typeof store.load !== 'function' || typeof store.compareAndSwap !== 'function') throw new Error('RUNTIME_STORE_REQUIRED');

  let initialized = false;
  async function ensureRuntime() {
    let current = await store.load(operatorId);
    if (!current && initial_runtime && !initialized) {
      if (typeof store.create !== 'function') throw new Error('RUNTIME_STORE_CREATE_REQUIRED');
      const created = await store.create(initial_runtime);
      if (!created.ok && created.error !== 'OPERATOR_RUNTIME_ALREADY_EXISTS') throw new Error(created.error || 'RUNTIME_CREATE_FAILED');
      current = await store.load(operatorId);
    }
    initialized = true;
    if (!current) throw new Error('OPERATOR_RUNTIME_NOT_FOUND');
    return current;
  }

  return {
    async handle(request = {}, options = {}) {
      const current = await ensureRuntime();
      const result = operatorRuntimeRequest(current, request, { ...options, dispatch: options.dispatch || dispatch });
      if (!result.changed) return result;

      const saved = await store.compareAndSwap(result.runtime, current.revision);
      if (!saved.ok) {
        return response(409, {
          error: saved.error || 'RUNTIME_STORE_CONFLICT',
          expected_revision: current.revision,
          actual_revision: saved.actual_revision ?? null
        }, current);
      }
      return { ...result, runtime: saved.runtime };
    }
  };
}

export function operatorRuntimeApiManifest() {
  return {
    schema: 'riosystems.operator-runtime-api.v1',
    routes: [
      'GET /health',
      'GET /snapshot',
      'GET /dashboard',
      'GET /projects',
      'GET /projects/:scope',
      'POST /projects/:scope/select',
      'GET /missions',
      'GET /missions/:id',
      'GET /deliveries',
      'GET /factories',
      'GET /approvals',
      'GET /actions',
      'POST /universal-missions',
      'POST /commands'
    ],
    mutations_require_runtime_revision: true,
    supervised_dispatch_preparation_only: true,
    automatic_dispatch: false,
    direct_provider_calls: false,
    automatic_paid_overflow: false,
    production_deploy: false
  };
}
