const clean = (value, max = 6000) => String(value ?? '').trim().slice(0, max);

export function buildJarvisActionPlanV1(input = {}) {
  const intent = input.intent || {};
  const gate = input.action_gate || {};
  const route = input.tool_route || {};
  const action = clean(intent.action, 120);
  if (!action) return { ok: false, error: 'JARVIS_PLAN_ACTION_REQUIRED' };

  const tool = route.ok ? route.tool : null;
  const estimatedCost = Number.isFinite(Number(input.estimated_cost_eur)) ? Math.max(0, Number(input.estimated_cost_eur)) : 0;
  const steps = [
    { step: 1, id: 'intent', status: intent.ok ? 'READY' : 'BLOCKED', detail: intent.intent_type || null },
    { step: 2, id: 'context', status: input.context ? 'READY' : 'BLOCKED', detail: 'minimal_relevant_context' },
    { step: 3, id: 'tool_route', status: route.ok ? (route.execution_ready ? 'READY' : 'BOUNDARY_READY_TOOL_UNBOUND') : 'BLOCKED', detail: tool?.tool_id || route.error || null },
    { step: 4, id: 'permission_gate', status: gate.execution_authorized ? 'AUTHORIZED' : gate.status || 'BLOCKED', detail: gate.approval_required ? 'approval_required' : 'no_approval_required' },
    { step: 5, id: 'execute', status: gate.execution_authorized && route.execution_ready ? 'READY' : 'NOT_EXECUTED', detail: 'execution_adapter_required' },
    { step: 6, id: 'verify_result', status: 'PENDING', detail: 'verify_external_effect_and_result_contract' },
    { step: 7, id: 'memory_writeback', status: 'POLICY_GATED', detail: 'controlled_writeback_only' }
  ];

  return {
    ok: true,
    schema: 'aurentara.jarvis.action-plan.v1',
    goal: clean(input.goal || intent.raw_message, 2000),
    intent_type: intent.intent_type || null,
    domain: intent.domain || null,
    action,
    risk_level: gate.action?.risk || null,
    tool_id: tool?.tool_id || null,
    required_permissions: route.requires_permissions || [],
    approval_required: gate.approval_required === true,
    execution_authorized: gate.execution_authorized === true,
    execution_ready: gate.execution_authorized === true && route.execution_ready === true,
    estimated_cost_eur: estimatedCost,
    cost_approval_required: Number.isFinite(Number(input.high_cost_threshold_eur))
      ? estimatedCost > Number(input.high_cost_threshold_eur)
      : false,
    steps,
    safeguards: {
      production_actions_enabled: false,
      billing_actions_enabled: false,
      financial_actions_enabled: false,
      credentials_in_plan: false,
      hamyren_boundary_crossed: false
    }
  };
}
