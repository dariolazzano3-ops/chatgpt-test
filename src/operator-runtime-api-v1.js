import { commandCenterRequest } from './command-center-api.js';
import {
  buildOperatorRuntimeSnapshot,
  selectOperatorRuntimeProject,
  recordOperatorRuntimeCommandState,
  runOperatorSyntheticMission
} from './operator-runtime-v1.js';
import {
  persistOperatorMissionPlan,
  findOperatorMissionPlan,
  listOperatorMissionPlans,
  decideOperatorMissionPlan,
  reserveOperatorLiveStagingExecution,
  finalizeOperatorLiveStagingExecution
} from './operator-finalization-runtime-v1.js';

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
  const live = (runtime.live_staging_runs || []).find((item) => item.mission_id === missionId);
  if (live) return { kind: 'live_staging_mission', mission: clone(live) };
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
      durable_mission_plans: Array.isArray(runtime.mission_plans),
      live_staging_execution_tracking: Array.isArray(runtime.live_staging_runs),
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
      })),
      live_staging: clone(runtime.live_staging_runs || []).map((run) => ({
        mission_id: run.mission_id,
        scope_key: run.scope_key,
        execution_id: run.execution_id,
        status: run.status,
        variable_cost_eur: run.variable_cost_eur || 0,
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
      universal_missions: clone(runtime.universal_runs || []).map((run) => clone(run.delivery)),
      live_staging_executions: clone(runtime.live_staging_runs || [])
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

  async function saveMutation(current, mutation, successStatus = 200) {
    if (!mutation.ok && !mutation.changed) {
      const conflict = String(mutation.error || '').includes('REVISION');
      return response(conflict ? 409 : 400, mutation, current);
    }
    if (!mutation.changed) return response(successStatus, mutation, current);
    const saved = await store.compareAndSwap(mutation.runtime, current.revision);
    if (!saved.ok) {
      return response(409, {
        error: saved.error || 'RUNTIME_STORE_CONFLICT',
        expected_revision: current.revision,
        actual_revision: saved.actual_revision ?? null
      }, current);
    }
    return response(successStatus, { ...mutation, runtime: undefined, runtime_revision: saved.runtime.revision }, saved.runtime, { changed: true });
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
    },

    async recordMissionPlan(input = {}, options = {}) {
      const current = await ensureRuntime();
      const mutation = persistOperatorMissionPlan(current, input, Number(input.expected_revision), { at: options.at });
      return saveMutation(current, mutation, 201);
    },

    async listMissionPlans(options = {}) {
      const current = await ensureRuntime();
      return response(200, {
        schema: 'riosystems.operator-mission-plans.v1',
        items: listOperatorMissionPlans(current, { at: options.at }),
        runtime_revision: current.revision,
        production_deploy: false
      }, current);
    },

    async decideMissionPlan(input = {}, options = {}) {
      const current = await ensureRuntime();
      const mutation = decideOperatorMissionPlan(current, input.plan_token, input.decision, Number(input.expected_revision), { at: options.at });
      return saveMutation(current, mutation, 200);
    },

    async approveSyntheticMissionPlan(input = {}, options = {}) {
      const current = await ensureRuntime();
      const plan = findOperatorMissionPlan(current, input.plan_token);
      if (!plan) return response(404, { error: 'PLAN_APPROVAL_NOT_FOUND_OR_EXPIRED', production_deploy: false }, current);
      if (plan.status !== 'APPROVAL_REQUIRED' || plan.runtime_revision !== current.revision) {
        return response(409, { error: 'PLAN_RUNTIME_REVISION_CONFLICT', expected_revision: plan.runtime_revision, actual_revision: current.revision, production_deploy: false }, current);
      }
      if (clean(input.confirmation_text, 160) !== 'CONFIRM_SYNTHETIC_STAGING') {
        return response(400, { error: 'MISSION_PLAN_CONFIRMATION_REQUIRED', production_deploy: false }, current);
      }
      const result = runOperatorSyntheticMission(current, plan.safe_input || {}, current.revision, { at: options.at, universal_options: options.universal_options || {} });
      if (!result.ok) return response(String(result.error || '').includes('REVISION') ? 409 : 400, result, current);
      const next = result.runtime;
      const index = (next.mission_plans || []).findIndex((item) => item.plan_token === plan.plan_token);
      if (index >= 0) next.mission_plans[index] = { ...next.mission_plans[index], status: 'SIMULATED', decision: 'approve', approved_at: next.updated_at, runtime_revision: next.revision, production_deploy: false };
      const saved = await store.compareAndSwap(next, current.revision);
      if (!saved.ok) return response(409, { error: saved.error || 'RUNTIME_STORE_CONFLICT', expected_revision: current.revision, actual_revision: saved.actual_revision ?? null }, current);
      return response(201, {
        mission_id: result.run.mission.mission_id,
        status: 'SIMULATED',
        delivery_status: result.run.delivery.final_delivery_status,
        quality_score: result.run.quality.quality_score,
        variable_cost_eur: 0,
        real_provider_calls: 0,
        external_writes: 0,
        approved_plan_token: plan.plan_token,
        runtime_revision: saved.runtime.revision,
        production_deploy: false
      }, saved.runtime, { changed: true });
    },

    async runLiveStaging(input = {}, options = {}) {
      const current = await ensureRuntime();
      if (typeof options.executor !== 'function') return response(503, { error: 'LIVE_STAGING_EXECUTOR_NOT_CONFIGURED', production_deploy: false }, current);
      const reserved = reserveOperatorLiveStagingExecution(current, input, Number(input.expected_revision), { at: options.at });
      if (!reserved.ok) return response(String(reserved.error || '').includes('REVISION') ? 409 : 400, reserved, current);
      if (!reserved.changed && reserved.idempotent_replay) {
        return response(200, { run: reserved.run, idempotent_replay: true, production_deploy: false }, current);
      }
      const savedReservation = await store.compareAndSwap(reserved.runtime, current.revision);
      if (!savedReservation.ok) return response(409, { error: savedReservation.error || 'RUNTIME_STORE_CONFLICT', expected_revision: current.revision, actual_revision: savedReservation.actual_revision ?? null }, current);

      let executorResult;
      try {
        executorResult = await options.executor(clone(reserved.contract));
      } catch (error) {
        executorResult = {
          ok: false,
          error: `LIVE_STAGING_EXECUTOR_FAILED:${clean(error?.message || error, 240)}`,
          status: 'FAILED',
          qa: { passed: false },
          synthetic_only: true,
          real_customer_data: false,
          variable_cost_eur: 0,
          paid_overflow: false,
          production_deploy: false
        };
      }

      for (let attempt = 0; attempt < 3; attempt += 1) {
        const latest = await store.load(operatorId);
        const finalized = finalizeOperatorLiveStagingExecution(latest, reserved.run.execution_id, executorResult, latest.revision, { at: options.at });
        if (!finalized.changed) return response(finalized.ok ? 200 : 400, { run: finalized.run, idempotent_replay: true, production_deploy: false }, latest);
        const savedFinal = await store.compareAndSwap(finalized.runtime, latest.revision);
        if (savedFinal.ok) {
          return response(finalized.ok ? 201 : 502, {
            execution_id: finalized.run.execution_id,
            mission_id: finalized.run.mission_id,
            scope_key: finalized.run.scope_key,
            status: finalized.run.status,
            evidence: finalized.run.evidence,
            variable_cost_eur: 0,
            production_deploy: false,
            runtime_revision: savedFinal.runtime.revision
          }, savedFinal.runtime, { changed: true });
        }
      }
      return response(409, { error: 'LIVE_STAGING_FINALIZATION_CONCURRENCY_EXHAUSTED', execution_id: reserved.run.execution_id, production_deploy: false }, savedReservation.runtime);
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
    service_methods: ['recordMissionPlan','listMissionPlans','decideMissionPlan','approveSyntheticMissionPlan','runLiveStaging'],
    mutations_require_runtime_revision: true,
    supervised_dispatch_preparation_only: true,
    live_staging_two_phase_reservation: true,
    live_staging_idempotency_required: true,
    automatic_dispatch: false,
    direct_provider_calls: false,
    automatic_paid_overflow: false,
    production_deploy: false
  };
}
