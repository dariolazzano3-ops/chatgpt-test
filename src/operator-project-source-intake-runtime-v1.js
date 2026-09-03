import { createProjectSourceIntakeState } from './project-source-intake-v1.js';

const clone = (value) => structuredClone(value ?? null);
const clean = (value, max = 1000) => String(value ?? '').trim().slice(0, max);
const BINARY_KEYS = new Set(['binary_data', 'bytes', 'base64', 'raw_binary', 'file_blob', 'blob']);

function runtimeProject(runtime = {}, scopeKey = '') {
  return (runtime.command_center_state?.portfolio?.projects || []).find((project) => project.scope_key === scopeKey) || null;
}

function containsBinary(value, seen = new Set()) {
  if (value === null || value === undefined) return false;
  if (typeof Blob !== 'undefined' && value instanceof Blob) return true;
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) return true;
  if (typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((item) => containsBinary(item, seen));
  for (const [key, item] of Object.entries(value)) {
    if (BINARY_KEYS.has(String(key).toLowerCase()) && item !== null && item !== undefined && item !== '') return true;
    if (containsBinary(item, seen)) return true;
  }
  return false;
}

function validateRuntime(runtime = {}) {
  return runtime?.schema === 'riosystems.operator-runtime.v1'
    && clean(runtime.operator_id, 320)
    && Number.isInteger(Number(runtime.revision));
}

export function resolveProjectSourceIntakeIdentity(runtime = {}, scopeKey = '') {
  if (!validateRuntime(runtime)) return { ok: false, error: 'VALID_OPERATOR_RUNTIME_REQUIRED' };
  const scope = clean(scopeKey, 640);
  const project = runtimeProject(runtime, scope);
  if (!project) return { ok: false, error: 'PROJECT_SOURCE_RUNTIME_PROJECT_NOT_FOUND', scope_key: scope };
  if (!clean(project.customer_id, 320) || !clean(project.project_id, 320)) return { ok: false, error: 'PROJECT_SOURCE_RUNTIME_PROJECT_IDENTITY_INCOMPLETE', scope_key: scope };
  return {
    ok: true,
    identity: {
      operator_id: runtime.operator_id,
      customer_id: project.customer_id,
      project_id: project.project_id,
      scope_key: project.scope_key
    },
    project: clone(project)
  };
}

export function readProjectSourceIntakeRuntime(runtime = {}, scopeKey = '', options = {}) {
  const identity = resolveProjectSourceIntakeIdentity(runtime, scopeKey);
  if (!identity.ok) return identity;
  const stored = runtime.project_source_intake_by_scope?.[identity.identity.scope_key] || null;
  if (stored) {
    if (stored.scope_key !== identity.identity.scope_key || stored.customer_id !== identity.identity.customer_id || stored.project_id !== identity.identity.project_id) {
      return { ok: false, error: 'PROJECT_SOURCE_RUNTIME_SCOPE_CORRUPTION_DETECTED', scope_key: identity.identity.scope_key };
    }
    if (containsBinary(stored)) return { ok: false, error: 'PROJECT_SOURCE_RUNTIME_BINARY_DATA_REJECTED' };
    return { ok: true, state: clone(stored), project: identity.project, identity: identity.identity, persisted: true, runtime_revision: runtime.revision, production_deploy: false };
  }
  const created = createProjectSourceIntakeState({ ...identity.identity, at: options.at });
  if (!created.ok) return created;
  return { ok: true, state: created.state, project: identity.project, identity: identity.identity, persisted: false, runtime_revision: runtime.revision, production_deploy: false };
}

export function prepareProjectSourceIntakeRuntimeMutation(runtime = {}, state = {}, expectedRevision, options = {}) {
  if (!validateRuntime(runtime)) return { ok: false, error: 'VALID_OPERATOR_RUNTIME_REQUIRED' };
  const expected = Number(expectedRevision);
  if (!Number.isInteger(expected)) return { ok: false, error: 'RUNTIME_EXPECTED_REVISION_REQUIRED', actual_revision: runtime.revision };
  if (expected !== runtime.revision) return { ok: false, error: 'RUNTIME_REVISION_CONFLICT', expected_revision: expected, actual_revision: runtime.revision };
  if (state?.schema !== 'aurentara.project-source-intake.v1') return { ok: false, error: 'PROJECT_SOURCE_INTAKE_STATE_REQUIRED' };
  if (containsBinary(state)) return { ok: false, error: 'PROJECT_SOURCE_RUNTIME_BINARY_DATA_REJECTED' };
  const identity = resolveProjectSourceIntakeIdentity(runtime, state.scope_key);
  if (!identity.ok) return identity;
  if (state.operator_id && state.operator_id !== identity.identity.operator_id) return { ok: false, error: 'PROJECT_SOURCE_RUNTIME_OPERATOR_SCOPE_MISMATCH' };
  if (state.customer_id !== identity.identity.customer_id || state.project_id !== identity.identity.project_id || state.scope_key !== identity.identity.scope_key) {
    return { ok: false, error: 'PROJECT_SOURCE_RUNTIME_PROJECT_SCOPE_MISMATCH' };
  }
  const next = clone(runtime);
  next.project_source_intake_by_scope = { ...(next.project_source_intake_by_scope || {}), [state.scope_key]: clone(state) };
  next.revision = runtime.revision + 1;
  next.updated_at = clean(options.at, 100) || new Date().toISOString();
  next.audit = [
    ...(next.audit || []),
    {
      event: clean(options.event, 160) || 'PROJECT_SOURCE_INTAKE_STATE_RECORDED',
      actor: runtime.operator_id,
      scope_key: state.scope_key,
      project_id: state.project_id,
      knowledge_revision: state.knowledge_revision,
      source_record_revision: state.record_revision,
      binary_data_in_runtime_json: false,
      production_deploy: false,
      at: next.updated_at
    }
  ];
  next.safety = { ...(next.safety || {}), production_deploy: false };
  return { ok: true, runtime: next, changed: true, production_deploy: false };
}

function serviceResult(status, body, runtime = null, changed = false) {
  return { ok: status >= 200 && status < 400, status, body, runtime: clone(runtime), changed, production_deploy: false };
}

export function withProjectSourceIntakeRuntimeService({ service, store, operator_id } = {}) {
  if (!service || typeof service.handle !== 'function') throw new Error('OPERATOR_RUNTIME_SERVICE_REQUIRED');
  if (!store || typeof store.load !== 'function' || typeof store.compareAndSwap !== 'function') throw new Error('OPERATOR_RUNTIME_STORE_REQUIRED');
  const operatorId = clean(operator_id, 320);
  if (!operatorId) throw new Error('OPERATOR_ID_REQUIRED');

  return {
    ...service,

    async getProjectSourceIntake(input = {}, options = {}) {
      const current = await store.load(operatorId);
      if (!current) return serviceResult(404, { error: 'OPERATOR_RUNTIME_NOT_FOUND', production_deploy: false });
      const read = readProjectSourceIntakeRuntime(current, input.scope_key, options);
      if (!read.ok) return serviceResult(404, { ...read, production_deploy: false }, current);
      return serviceResult(200, {
        schema: 'aurentara.operator-project-source-intake-runtime.v1',
        project: read.project,
        identity: read.identity,
        state: read.state,
        persisted: read.persisted,
        runtime_revision: current.revision,
        binary_data_in_runtime_json: false,
        production_deploy: false
      }, current);
    },

    async saveProjectSourceIntake(input = {}, options = {}) {
      const current = await store.load(operatorId);
      if (!current) return serviceResult(404, { error: 'OPERATOR_RUNTIME_NOT_FOUND', production_deploy: false });
      const mutation = prepareProjectSourceIntakeRuntimeMutation(current, input.state, input.expected_revision, { at: options.at, event: input.event });
      if (!mutation.ok) return serviceResult(String(mutation.error || '').includes('REVISION') ? 409 : 400, { ...mutation, production_deploy: false }, current);
      const saved = await store.compareAndSwap(mutation.runtime, current.revision);
      if (!saved.ok) {
        return serviceResult(409, {
          error: saved.error || 'RUNTIME_STORE_CONFLICT',
          expected_revision: current.revision,
          actual_revision: saved.actual_revision ?? null,
          production_deploy: false
        }, current);
      }
      return serviceResult(200, {
        schema: 'aurentara.operator-project-source-intake-runtime.v1',
        scope_key: input.state.scope_key,
        knowledge_revision: input.state.knowledge_revision,
        source_record_revision: input.state.record_revision,
        runtime_revision: saved.runtime.revision,
        binary_data_in_runtime_json: false,
        production_deploy: false
      }, saved.runtime, true);
    }
  };
}

export function operatorProjectSourceIntakeRuntimeManifest() {
  return {
    schema: 'aurentara.operator-project-source-intake-runtime.v1',
    existing_operator_runtime_store_reused: true,
    namespaced_field: 'project_source_intake_by_scope',
    compare_and_swap: true,
    project_scope_server_resolved: true,
    binary_data_in_runtime_json: false,
    variable_cost_eur: 0,
    paid_provider_calls: 0,
    production_deploy: false
  };
}
