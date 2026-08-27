const STATES = new Set(['READY','RUNNING','WAITING','BLOCKED','DONE','HOLD']);
const ACTIONS = new Set(['GO','HOLD','COMPLETE','BLOCK','WAIT','READY']);
const clone = (value) => JSON.parse(JSON.stringify(value));
const clean = (value, max = 500) => String(value || '').trim().slice(0, max);

function worker(state, workerId) {
  return state?.workers?.[workerId] || null;
}

function dependenciesDone(state, target) {
  return (target.depends_on || []).every((id) => worker(state, id)?.status === 'DONE');
}

export function validateCommandState(input = {}) {
  const errors = [];
  if (input.schema_version !== 1) errors.push('PROJECT_COMMAND_SCHEMA_UNSUPPORTED');
  if (!input.workers || typeof input.workers !== 'object' || Array.isArray(input.workers)) errors.push('PROJECT_COMMAND_WORKERS_REQUIRED');
  for (const [id, item] of Object.entries(input.workers || {})) {
    if (!id || !STATES.has(item?.status)) errors.push(`PROJECT_COMMAND_INVALID_WORKER:${id}`);
    for (const dependency of item?.depends_on || []) if (!input.workers?.[dependency]) errors.push(`PROJECT_COMMAND_UNKNOWN_DEPENDENCY:${id}:${dependency}`);
  }
  if (input.production_deploy !== false) errors.push('PROJECT_COMMAND_PRODUCTION_MUST_BE_FALSE');
  return { ok: errors.length === 0, errors };
}

export function commandSnapshot(input = {}) {
  const checked = validateCommandState(input);
  if (!checked.ok) return checked;
  const workers = Object.entries(input.workers).map(([id, item]) => ({
    id,
    label: item.label || id,
    status: item.status,
    dependencies_ready: dependenciesDone(input, item),
    next_action: item.next_action || null
  }));
  return {
    ok: true,
    command_layer: input.command_layer,
    authority: input.authority,
    production_deploy: false,
    counts: Object.fromEntries([...STATES].map((status) => [status, workers.filter((item) => item.status === status).length])),
    workers
  };
}

export function applyCommand(input = {}, request = {}) {
  const checked = validateCommandState(input);
  if (!checked.ok) return checked;
  const state = clone(input);
  const target = worker(state, clean(request.worker_id, 100));
  const action = clean(request.action, 30).toUpperCase();
  if (!target) return { ok:false, error:'PROJECT_COMMAND_WORKER_NOT_FOUND' };
  if (!ACTIONS.has(action)) return { ok:false, error:'PROJECT_COMMAND_ACTION_UNSUPPORTED' };

  if (action === 'GO') {
    if (!['READY','WAITING','HOLD'].includes(target.status)) return { ok:false, error:'PROJECT_COMMAND_GO_INVALID_STATE', state:target.status };
    if (!dependenciesDone(state, target)) return { ok:false, error:'PROJECT_COMMAND_DEPENDENCIES_INCOMPLETE' };
    target.status = 'RUNNING';
  } else if (action === 'HOLD') target.status = 'HOLD';
  else if (action === 'COMPLETE') target.status = 'DONE';
  else if (action === 'BLOCK') target.status = 'BLOCKED';
  else if (action === 'WAIT') target.status = 'WAITING';
  else if (action === 'READY') {
    if (!dependenciesDone(state, target)) return { ok:false, error:'PROJECT_COMMAND_DEPENDENCIES_INCOMPLETE' };
    target.status = 'READY';
  }

  if (request.next_action !== undefined) target.next_action = clean(request.next_action, 500) || null;
  state.production_deploy = false;
  state.policy = { ...(state.policy || {}), automatic_cross_worker_dispatch:false, automatic_production_deploy:false, go_required_before_new_work:true };
  return { ok:true, state, event:{ type:`WORKER_${action}`, worker_id:request.worker_id, status:target.status, production_deploy:false } };
}

export function buildWorkerHandoff(input = {}, workerId) {
  const checked = validateCommandState(input);
  if (!checked.ok) return checked;
  const target = worker(input, workerId);
  if (!target) return { ok:false, error:'PROJECT_COMMAND_WORKER_NOT_FOUND' };
  return {
    ok:true,
    contract_version:1,
    worker_id:workerId,
    label:target.label || workerId,
    status:target.status,
    scope:[...(target.scope || [])],
    next_action:target.next_action || null,
    depends_on:[...(target.depends_on || [])],
    dependency_status:Object.fromEntries((target.depends_on || []).map((id) => [id, worker(input,id)?.status || 'UNKNOWN'])),
    human_go_required:true,
    automatic_dispatch:false,
    production_deploy:false
  };
}
