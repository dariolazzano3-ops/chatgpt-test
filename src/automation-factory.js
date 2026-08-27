const SAFE_STEP_TYPES = new Set(['input', 'filter', 'map', 'transform', 'condition', 'output']);
const EXTERNAL_STEP_TYPES = new Set(['http_request', 'webhook', 'email', 'crm_write', 'database_write']);

const clean = (value, max = 500) => String(value || '').trim().slice(0, max);

export function automationFactoryManifest() {
  return {
    id: 'automation-factory-v1',
    version: '4.1',
    status: 'foundation',
    available: true,
    execution_mode: 'dry_run_only',
    automatic_execution: false,
    external_side_effects: false,
    production_deploy: false,
    supported_step_types: [...SAFE_STEP_TYPES, ...EXTERNAL_STEP_TYPES],
    safe_step_types: [...SAFE_STEP_TYPES],
    external_step_types: [...EXTERNAL_STEP_TYPES],
  };
}

export function validateAutomationContract(contract = {}) {
  const errors = [];
  const steps = Array.isArray(contract.steps) ? contract.steps : [];
  if (!clean(contract.goal)) errors.push('AUTOMATION_GOAL_REQUIRED');
  if (!steps.length) errors.push('AUTOMATION_STEPS_REQUIRED');
  if (steps.length > 50) errors.push('AUTOMATION_STEP_LIMIT_EXCEEDED');

  const ids = new Set();
  let hasExternal = false;
  for (const [index, step] of steps.entries()) {
    const id = clean(step?.id, 100);
    const type = clean(step?.type, 100).toLowerCase();
    if (!id) errors.push(`STEP_${index + 1}_ID_REQUIRED`);
    if (id && ids.has(id)) errors.push(`DUPLICATE_STEP_ID:${id}`);
    if (id) ids.add(id);
    if (!SAFE_STEP_TYPES.has(type) && !EXTERNAL_STEP_TYPES.has(type)) errors.push(`UNSUPPORTED_STEP_TYPE:${type || 'missing'}`);
    if (EXTERNAL_STEP_TYPES.has(type)) hasExternal = true;
  }

  return {
    ok: errors.length === 0,
    errors,
    has_external_side_effects: hasExternal,
    execution_mode: 'dry_run_only',
    production_deploy: false,
  };
}

export function compileAutomationPlan(contract = {}) {
  const validation = validateAutomationContract(contract);
  if (!validation.ok) return validation;

  const steps = contract.steps.map((step, index) => {
    const type = clean(step.type, 100).toLowerCase();
    const external = EXTERNAL_STEP_TYPES.has(type);
    return {
      order: index + 1,
      id: clean(step.id, 100),
      type,
      name: clean(step.name || step.id, 160),
      depends_on: Array.isArray(step.depends_on) ? step.depends_on.map((value) => clean(value, 100)).filter(Boolean) : [],
      config: step.config && typeof step.config === 'object' && !Array.isArray(step.config) ? step.config : {},
      execution: external ? 'blocked_external_side_effect' : 'safe_dry_run',
    };
  });

  return {
    ok: true,
    plan_version: 1,
    factory: 'automation',
    goal: clean(contract.goal, 1000),
    steps,
    has_external_side_effects: validation.has_external_side_effects,
    external_execution_authorized: false,
    automatic_execution: false,
    production_deploy: false,
  };
}

export function dryRunAutomation(plan = {}) {
  if (!plan.ok || !Array.isArray(plan.steps)) return { ok: false, error: 'INVALID_AUTOMATION_PLAN' };
  const trace = [];
  for (const step of plan.steps) {
    if (step.execution === 'blocked_external_side_effect') {
      trace.push({ step_id: step.id, status: 'BLOCKED', reason: 'EXTERNAL_SIDE_EFFECT_REQUIRES_FUTURE_ADAPTER' });
      continue;
    }
    trace.push({ step_id: step.id, status: 'SIMULATED', reason: 'SAFE_DRY_RUN' });
  }
  return {
    ok: true,
    status: trace.some((item) => item.status === 'BLOCKED') ? 'READY_WITH_BLOCKED_EXTERNAL_STEPS' : 'DRY_RUN_PASSED',
    trace,
    automatic_execution: false,
    production_deploy: false,
  };
}
