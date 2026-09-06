const clean = (value, max = 240) => String(value ?? '').trim().slice(0, max);

export function verifyJarvisActionResultV1(plan = {}, execution = {}) {
  if (!plan.ok) return { ok: false, status: 'INVALID_PLAN', error: 'JARVIS_RESULT_PLAN_INVALID' };

  const externalEffect = execution.external_effect === true;
  if (externalEffect && plan.execution_authorized !== true) {
    return { ok: false, status: 'SECURITY_VIOLATION', error: 'JARVIS_UNAUTHORIZED_EXTERNAL_EFFECT', verified: false };
  }
  if (externalEffect && plan.execution_ready !== true) {
    return { ok: false, status: 'SECURITY_VIOLATION', error: 'JARVIS_UNREADY_TOOL_EXTERNAL_EFFECT', verified: false };
  }
  if (execution.tool_id && plan.tool_id && clean(execution.tool_id, 180) !== clean(plan.tool_id, 180)) {
    return { ok: false, status: 'RESULT_MISMATCH', error: 'JARVIS_TOOL_RESULT_BINDING_MISMATCH', verified: false };
  }

  const status = clean(execution.status, 80).toUpperCase() || (plan.execution_ready ? 'PENDING' : 'NOT_EXECUTED');
  const verified = ['COMPLETED', 'PREPARED', 'NOT_EXECUTED', 'PENDING'].includes(status);
  return {
    ok: verified,
    schema: 'aurentara.jarvis.action-result.v1',
    status,
    verified,
    tool_id: plan.tool_id || null,
    external_effect: externalEffect,
    output: execution.output !== undefined ? structuredClone(execution.output) : null,
    memory_writeback_allowed: verified && status === 'COMPLETED',
    hamyren_data_flow: false
  };
}
