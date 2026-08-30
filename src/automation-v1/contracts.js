const text = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const clone = (value) => structuredClone(value ?? null);

export const APPROVAL_CLASSES = Object.freeze([
  'READ_ONLY',
  'SAFE_SYNTHETIC_WRITE',
  'EXTERNAL_WRITE',
  'PRODUCTION_CHANGE',
  'PAID_EXECUTION'
]);

export const ACTION_CONTRACTS = Object.freeze({
  webhook: Object.freeze({ kind: 'trigger_or_action', default_method: 'POST', side_effect: 'EXTERNAL_WRITE', dry_run: true, idempotency_required: true }),
  schedule: Object.freeze({ kind: 'trigger', side_effect: 'READ_ONLY', dry_run: true, idempotency_required: false }),
  http: Object.freeze({ kind: 'action', side_effect: 'READ_ONLY', dry_run: true, idempotency_required: false }),
  database_read: Object.freeze({ kind: 'action', side_effect: 'READ_ONLY', dry_run: true, idempotency_required: false }),
  database_write: Object.freeze({ kind: 'action', side_effect: 'EXTERNAL_WRITE', dry_run: true, idempotency_required: true }),
  email: Object.freeze({ kind: 'action', side_effect: 'EXTERNAL_WRITE', dry_run: true, idempotency_required: true }),
  analytics: Object.freeze({ kind: 'action', side_effect: 'EXTERNAL_WRITE', dry_run: true, idempotency_required: true }),
  ai_call: Object.freeze({ kind: 'action', side_effect: 'PAID_EXECUTION', dry_run: true, idempotency_required: true }),
  file_processing: Object.freeze({ kind: 'action', side_effect: 'READ_ONLY', dry_run: true, idempotency_required: false }),
  crm_event: Object.freeze({ kind: 'action', side_effect: 'EXTERNAL_WRITE', dry_run: true, idempotency_required: true }),
  transform: Object.freeze({ kind: 'internal', side_effect: 'READ_ONLY', dry_run: true, idempotency_required: false }),
  condition: Object.freeze({ kind: 'internal', side_effect: 'READ_ONLY', dry_run: true, idempotency_required: false }),
  output: Object.freeze({ kind: 'internal', side_effect: 'READ_ONLY', dry_run: true, idempotency_required: false })
});

const DATA_CLASSES = new Set(['synthetic', 'synthetic_test_data', 'non_sensitive', 'internal']);
const SIDE_EFFECT_LEVELS = new Set(['read_only', 'safe_synthetic_write', 'external_write']);

export function automationMissionContract(input = {}) {
  const errors = [];
  const project = text(input.project, 160);
  const projectId = text(input.project_id || project.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), 160);
  const goal = text(input.goal, 1200);
  const trigger = input.trigger && typeof input.trigger === 'object' && !Array.isArray(input.trigger) ? clone(input.trigger) : null;
  const triggerType = text(trigger?.type, 80).toLowerCase();
  const systems = Array.isArray(input.systems) ? [...new Set(input.systems.map((item) => text(item, 120)).filter(Boolean))] : [];
  const dataClassification = text(input.data_classification || 'synthetic_test_data', 80).toLowerCase();
  const executionFrequency = text(input.execution_frequency || 'on_demand', 80).toLowerCase();
  const sideEffectLevel = text(input.side_effect_level || 'safe_synthetic_write', 80).toLowerCase();
  const budgetInput = input.budget && typeof input.budget === 'object' && !Array.isArray(input.budget) ? input.budget : {};
  const variableCostCeilingEur = Number(budgetInput.variable_cost_ceiling_eur ?? 0);
  const workflowType = text(input.workflow_type || '', 80).toLowerCase() || null;

  if (!project) errors.push('PROJECT_REQUIRED');
  if (!projectId) errors.push('PROJECT_ID_REQUIRED');
  if (!goal) errors.push('GOAL_REQUIRED');
  if (!trigger || !triggerType) errors.push('TRIGGER_REQUIRED');
  if (triggerType && !['webhook', 'schedule', 'manual', 'crm_event'].includes(triggerType)) errors.push(`UNSUPPORTED_TRIGGER:${triggerType}`);
  if (!systems.length) errors.push('SYSTEMS_REQUIRED');
  if (!DATA_CLASSES.has(dataClassification)) errors.push('REAL_OR_SENSITIVE_CUSTOMER_DATA_REJECTED');
  if (!SIDE_EFFECT_LEVELS.has(sideEffectLevel)) errors.push('SIDE_EFFECT_LEVEL_INVALID');
  if (!Number.isFinite(variableCostCeilingEur) || variableCostCeilingEur !== 0) errors.push('VARIABLE_COST_CEILING_MUST_BE_ZERO');
  if (input.production === true || input.production_deploy === true) errors.push('PRODUCTION_LOCKED');
  if (input.real_customer_data === true) errors.push('REAL_CUSTOMER_DATA_LOCKED');
  if (input.mass_email === true) errors.push('MASS_EMAIL_LOCKED');
  if (input.payments === true) errors.push('PAYMENTS_LOCKED');
  if (input.automatic_paid_overflow === true) errors.push('AUTOMATIC_PAID_OVERFLOW_LOCKED');

  const approvalRequirements = Array.isArray(input.approval_requirements)
    ? [...new Set(input.approval_requirements.map((item) => text(item, 80).toUpperCase()).filter(Boolean))]
    : [];
  for (const requirement of approvalRequirements) {
    if (!APPROVAL_CLASSES.includes(requirement)) errors.push(`UNKNOWN_APPROVAL_CLASS:${requirement}`);
  }

  return {
    ok: errors.length === 0,
    errors,
    mission: errors.length ? null : {
      schema: 'riosystems.automation-mission.v1',
      project,
      project_id: projectId,
      trigger: { ...trigger, type: triggerType },
      goal,
      inputs: input.inputs && typeof input.inputs === 'object' ? clone(input.inputs) : {},
      outputs: input.outputs && typeof input.outputs === 'object' ? clone(input.outputs) : {},
      systems,
      data_classification: dataClassification,
      execution_frequency: executionFrequency,
      side_effect_level: sideEffectLevel,
      budget: { variable_cost_ceiling_eur: 0 },
      approval_requirements: approvalRequirements,
      workflow_type: workflowType,
      workflow: Array.isArray(input.workflow) ? clone(input.workflow) : null,
      metadata: input.metadata && typeof input.metadata === 'object' ? clone(input.metadata) : {},
      hard_safety: {
        production: false,
        real_customer_data: false,
        mass_email: false,
        payments: false,
        automatic_paid_overflow: false,
        variable_cost_ceiling_eur: 0
      }
    },
    production: false,
    variable_cost_ceiling_eur: 0
  };
}

export function getActionContract(type) {
  const key = text(type, 80).toLowerCase();
  const contract = ACTION_CONTRACTS[key];
  return contract ? { type: key, ...clone(contract) } : null;
}

export function validateWorkflowNodes(nodes = []) {
  const errors = [];
  const ids = new Set();
  if (!Array.isArray(nodes) || !nodes.length) return { ok: false, errors: ['WORKFLOW_NODES_REQUIRED'] };
  if (nodes.length > 64) errors.push('WORKFLOW_NODE_LIMIT_EXCEEDED');
  for (const [index, node] of nodes.entries()) {
    const id = text(node?.id, 100);
    const type = text(node?.type, 80).toLowerCase();
    if (!id) errors.push(`NODE_${index + 1}_ID_REQUIRED`);
    if (id && ids.has(id)) errors.push(`DUPLICATE_NODE_ID:${id}`);
    if (id) ids.add(id);
    if (!getActionContract(type)) errors.push(`UNSUPPORTED_ACTION:${type || 'missing'}`);
  }
  for (const node of nodes) {
    for (const dependency of Array.isArray(node?.depends_on) ? node.depends_on : []) {
      const dep = text(dependency, 100);
      if (dep && !ids.has(dep)) errors.push(`UNKNOWN_DEPENDENCY:${dep}`);
      if (dep && dep === text(node?.id, 100)) errors.push(`SELF_DEPENDENCY:${dep}`);
    }
  }
  return { ok: errors.length === 0, errors };
}
