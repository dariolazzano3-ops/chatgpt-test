import { automationMissionContract, getActionContract, validateWorkflowNodes } from './contracts.js';

const clone = (value) => structuredClone(value ?? null);
const clean = (value, max = 200) => String(value ?? '').trim().slice(0, max);

function inferWorkflowType(mission) {
  if (mission.workflow_type) return mission.workflow_type;
  const goal = mission.goal.toLowerCase();
  if (goal.includes('follow') || mission.trigger.type === 'schedule') return 'scheduled_follow_up';
  if (goal.includes('ai') || goal.includes('classif') || goal.includes('summar')) return 'ai_assisted_workflow';
  if (goal.includes('crm') && goal.includes('sync')) return 'crm_sync';
  if (goal.includes('crm') && goal.includes('email')) return 'crm_to_email';
  if (goal.includes('form') && goal.includes('crm')) return 'form_to_crm';
  return 'lead_intake';
}

function recipe(type) {
  if (type === 'scheduled_follow_up') return [
    { id: 'trigger', type: 'schedule' },
    { id: 'load_due_records', type: 'database_read', depends_on: ['trigger'] },
    { id: 'eligible', type: 'condition', depends_on: ['load_due_records'] },
    { id: 'follow_up', type: 'email', depends_on: ['eligible'] },
    { id: 'analytics', type: 'analytics', depends_on: ['follow_up'] },
    { id: 'output', type: 'output', depends_on: ['analytics'] }
  ];
  if (type === 'crm_sync') return [
    { id: 'trigger', type: 'schedule' },
    { id: 'load_changes', type: 'database_read', depends_on: ['trigger'] },
    { id: 'crm_sync', type: 'crm_event', depends_on: ['load_changes'] },
    { id: 'analytics', type: 'analytics', depends_on: ['crm_sync'] },
    { id: 'output', type: 'output', depends_on: ['analytics'] }
  ];
  if (type === 'form_to_crm') return [
    { id: 'trigger', type: 'webhook' },
    { id: 'normalize', type: 'transform', depends_on: ['trigger'] },
    { id: 'crm', type: 'crm_event', depends_on: ['normalize'] },
    { id: 'analytics', type: 'analytics', depends_on: ['crm'] },
    { id: 'output', type: 'output', depends_on: ['analytics'] }
  ];
  if (type === 'crm_to_email') return [
    { id: 'trigger', type: 'crm_event' },
    { id: 'normalize', type: 'transform', depends_on: ['trigger'] },
    { id: 'email', type: 'email', depends_on: ['normalize'] },
    { id: 'analytics', type: 'analytics', depends_on: ['email'] },
    { id: 'output', type: 'output', depends_on: ['analytics'] }
  ];
  if (type === 'ai_assisted_workflow') return [
    { id: 'trigger', type: 'webhook' },
    { id: 'normalize', type: 'transform', depends_on: ['trigger'] },
    { id: 'ai', type: 'ai_call', depends_on: ['normalize'] },
    { id: 'crm', type: 'crm_event', depends_on: ['ai'] },
    { id: 'analytics', type: 'analytics', depends_on: ['crm'] },
    { id: 'output', type: 'output', depends_on: ['analytics'] }
  ];
  if (type === 'file_processing') return [
    { id: 'trigger', type: 'schedule' },
    { id: 'read', type: 'database_read', depends_on: ['trigger'] },
    { id: 'process', type: 'file_processing', depends_on: ['read'] },
    { id: 'analytics', type: 'analytics', depends_on: ['process'] },
    { id: 'output', type: 'output', depends_on: ['analytics'] }
  ];
  return [
    { id: 'trigger', type: 'webhook' },
    { id: 'normalize', type: 'transform', depends_on: ['trigger'] },
    { id: 'persist_lead', type: 'database_write', depends_on: ['normalize'] },
    { id: 'analytics', type: 'analytics', depends_on: ['persist_lead'] },
    { id: 'output', type: 'output', depends_on: ['analytics'] }
  ];
}

function normalizeNode(node, index, mission) {
  const action = getActionContract(node.type);
  const config = node.config && typeof node.config === 'object' && !Array.isArray(node.config) ? clone(node.config) : {};
  return {
    id: clean(node.id, 100) || `step_${index + 1}`,
    order: index + 1,
    type: clean(node.type, 80).toLowerCase(),
    depends_on: Array.isArray(node.depends_on) ? node.depends_on.map((item) => clean(item, 100)).filter(Boolean) : [],
    config,
    side_effect_class: action.side_effect,
    dry_run_capable: action.dry_run,
    idempotency_required: action.idempotency_required,
    timeout_ms: Math.min(Math.max(Number(node.timeout_ms ?? 5000), 100), 15000),
    retry_limit: Math.min(Math.max(Number(node.retry_limit ?? 2), 0), 3),
    recovery_strategy: clean(node.recovery_strategy || (action.side_effect === 'READ_ONLY' ? 'retry_then_fail_closed' : 'idempotent_retry_then_fail_closed'), 120),
    environment: 'staging',
    synthetic_test_data_only: true,
    production: false,
    project_id: mission.project_id
  };
}

function detectCycle(nodes) {
  const graph = new Map(nodes.map((node) => [node.id, node.depends_on]));
  const visiting = new Set();
  const visited = new Set();
  const walk = (id) => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const dep of graph.get(id) || []) if (walk(dep)) return true;
    visiting.delete(id);
    visited.add(id);
    return false;
  };
  return nodes.some((node) => walk(node.id));
}

export function buildWorkflowPlan(input = {}) {
  const contract = automationMissionContract(input);
  if (!contract.ok) return { ok: false, stage: 'MISSION_VALIDATION', errors: contract.errors, production: false };
  const mission = contract.mission;
  const workflowType = inferWorkflowType(mission);
  const rawNodes = mission.workflow?.length ? mission.workflow : recipe(workflowType);
  const nodeValidation = validateWorkflowNodes(rawNodes);
  if (!nodeValidation.ok) return { ok: false, stage: 'WORKFLOW_VALIDATION', errors: nodeValidation.errors, production: false };
  const nodes = rawNodes.map((node, index) => normalizeNode(node, index, mission));
  if (detectCycle(nodes)) return { ok: false, stage: 'WORKFLOW_VALIDATION', errors: ['WORKFLOW_CYCLE_DETECTED'], production: false };

  return {
    ok: true,
    schema: 'riosystems.automation-workflow-plan.v1',
    workflow_id: `${mission.project_id}:${workflowType}:v1`,
    project_id: mission.project_id,
    workflow_type: workflowType,
    mission,
    trigger: clone(mission.trigger),
    nodes,
    outputs: clone(mission.outputs),
    execution_mode: 'synthetic_staging',
    external_execution_authorized: false,
    variable_cost_ceiling_eur: 0,
    production: false
  };
}
