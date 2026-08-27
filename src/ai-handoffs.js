const FACTORIES = new Set(['web', 'app', 'automation', 'ai', 'business']);
const clone = (value) => JSON.parse(JSON.stringify(value ?? null));
const clean = (value, max = 1000) => String(value || '').trim().slice(0, max);

export function buildAIHandoff({ from = 'ai', to, mission_id = null, task_id = null, payload = {}, reason = '' } = {}) {
  const source = clean(from, 80).toLowerCase();
  const target = clean(to, 80).toLowerCase();
  if (!FACTORIES.has(source) || !FACTORIES.has(target) || source === target) return { ok: false, error: 'AI_HANDOFF_ROUTE_INVALID' };
  let serialized;
  try { serialized = JSON.stringify(payload); } catch { return { ok: false, error: 'AI_HANDOFF_PAYLOAD_INVALID' }; }
  if (serialized.length > 100000) return { ok: false, error: 'AI_HANDOFF_PAYLOAD_LIMIT_EXCEEDED' };
  return {
    ok: true,
    handoff: {
      handoff_version: 'factory.handoff.v1',
      from: source,
      to: target,
      mission_id: mission_id || null,
      task_id: task_id || null,
      reason: clean(reason, 1000) || null,
      payload: clone(payload),
      state: 'READY',
      automatic_dispatch: false,
      dispatch_authorized: false,
      production_deploy: false,
      external_side_effects: false
    }
  };
}

export function authorizeAIHandoff(handoff = {}, approval = {}) {
  if (handoff.handoff_version !== 'factory.handoff.v1' || handoff.state !== 'READY') return { ok: false, error: 'AI_HANDOFF_INVALID' };
  if (approval.production_deploy === true) return { ok: false, error: 'PRODUCTION_SIDE_EFFECT_REJECTED' };
  if (approval.authorized !== true) return { ok: false, error: 'AI_HANDOFF_APPROVAL_REQUIRED' };
  return { ok: true, handoff: { ...clone(handoff), dispatch_authorized: true, production_deploy: false, external_side_effects: false } };
}

export function completeAIHandoff(handoff = {}, receipt = {}) {
  if (handoff.dispatch_authorized !== true) return { ok: false, error: 'AI_HANDOFF_NOT_AUTHORIZED' };
  if (receipt.production_deploy === true || receipt.external_side_effects === true) return { ok: false, error: 'AI_HANDOFF_SIDE_EFFECT_REJECTED' };
  return { ok: true, handoff: { ...clone(handoff), state: 'COMPLETED', receipt: clone(receipt), production_deploy: false, external_side_effects: false } };
}
