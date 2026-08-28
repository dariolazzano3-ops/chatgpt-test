import { buildCommandCenterSnapshot, evaluateCommand, applyLocalCommand } from './command-center.js';

const clone = (value) => structuredClone(value ?? null);
const clean = (value, max = 240) => String(value || '').trim().slice(0, max);

export function commandCenterRequest(state = {}, request = {}, options = {}) {
  const method = clean(request.method, 20).toUpperCase() || 'GET';
  const path = clean(request.path, 240) || '/snapshot';
  if (method === 'GET' && path === '/snapshot') {
    return { ok: true, status: 200, body: buildCommandCenterSnapshot(state), state: clone(state), production_deploy: false };
  }
  if (method === 'POST' && path === '/commands') {
    const evaluated = evaluateCommand(state, request.body || {});
    if (!evaluated.ok) return { ok: false, status: 400, body: evaluated, state: clone(state), production_deploy: false };
    if (!evaluated.ready_for_dispatch) return { ok: true, status: 202, body: evaluated, state: clone(state), user_action_required: true, production_deploy: false };
    const local = applyLocalCommand(state, evaluated);
    if (!local.ok) return { ok: false, status: 409, body: local, state: clone(state), production_deploy: false };
    if (['REQUEST_EXECUTION','REQUEST_QA','REQUEST_HANDOFF','GRANT_APPROVAL','REVOKE_APPROVAL'].includes(evaluated.type)) {
      if (typeof options.dispatch !== 'function') {
        return { ok: true, status: 202, body: { ...evaluated, dispatch: 'NOT_CONFIGURED' }, state: local.state, user_action_required: true, production_deploy: false };
      }
      return {
        ok: true,
        status: 202,
        body: { ...evaluated, dispatch: 'SUPERVISED_DISPATCH_READY' },
        state: local.state,
        dispatch: { fn: options.dispatch, command: evaluated },
        production_deploy: false
      };
    }
    return { ok: true, status: 200, body: evaluated, state: local.state, production_deploy: false };
  }
  return { ok: false, status: 404, body: { error: 'COMMAND_CENTER_ROUTE_NOT_FOUND' }, state: clone(state), production_deploy: false };
}

export function commandCenterApiManifest() {
  return {
    version: 'riosystems.command-center.api.v1',
    routes: ['GET /snapshot','POST /commands'],
    supervised_dispatch_injection: true,
    read_write_separation: true,
    production_deploy: false
  };
}
