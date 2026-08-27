import { compileAutomationPlan } from './automation-factory.js';
import { executeSafeAutomation } from './automation-executor.js';
import { executeExternalAction } from './automation-external-actions.js';

const EXTERNAL = new Set(['http_request', 'webhook', 'email', 'crm_write', 'database_write']);
const clone = (value) => JSON.parse(JSON.stringify(value ?? null));

function stepPolicy(stepId, policy = {}) {
  const overrides = policy?.steps && typeof policy.steps === 'object' ? policy.steps[stepId] : null;
  return {
    ...policy,
    ...(overrides && typeof overrides === 'object' ? overrides : {}),
    steps: undefined,
    production_deploy: false,
  };
}

function actionFromStep(step = {}) {
  return {
    type: step.type,
    ...(step.config && typeof step.config === 'object' && !Array.isArray(step.config) ? step.config : {}),
  };
}

export async function executeSupervisedAutomation(contract = {}, input = {}, options = {}) {
  const plan = compileAutomationPlan(contract);
  if (!plan.ok) return plan;

  const trace = [];
  let current = clone(input);
  const transport = options.transport;
  const policy = options.policy && typeof options.policy === 'object' ? options.policy : {};

  for (const step of plan.steps) {
    if (EXTERNAL.has(step.type)) {
      const result = await executeExternalAction(actionFromStep(step), stepPolicy(step.id, policy), transport);
      trace.push({
        step_id: step.id,
        type: step.type,
        status: result.status,
        external_side_effect: result.external_side_effect === true,
        supervised: true,
        status_code: result.status_code ?? null,
        errors: result.errors || undefined,
      });
      if (!result.ok) {
        return {
          ok: false,
          status: result.status === 'BLOCKED' ? 'BLOCKED_EXTERNAL_SIDE_EFFECT' : 'FAILED',
          trace,
          outputs: {},
          supervised: true,
          automatic_execution: false,
          production_deploy: false,
        };
      }
      continue;
    }

    const safeResult = executeSafeAutomation({ goal: plan.goal, steps: [{ id: step.id, type: step.type, config: step.config }] }, current);
    const safeTrace = safeResult.trace?.[0] || { step_id: step.id, type: step.type, status: safeResult.ok ? 'COMPLETED' : 'FAILED' };
    trace.push(safeTrace);
    if (!safeResult.ok) {
      return { ...safeResult, trace, supervised: true, automatic_execution: false, production_deploy: false };
    }
    current = clone(safeResult.outputs?.result);
    if (safeResult.outputs?.condition_matched === false) {
      return {
        ok: true,
        status: 'COMPLETED',
        trace,
        outputs: { result: current, condition_matched: false },
        supervised: true,
        automatic_execution: false,
        production_deploy: false,
      };
    }
  }

  return {
    ok: true,
    status: 'COMPLETED',
    trace,
    outputs: { result: current },
    supervised: true,
    automatic_execution: false,
    production_deploy: false,
  };
}

export function supervisedAutomationManifest() {
  return {
    version: '4.4',
    mode: 'supervised',
    safe_steps_inline: true,
    external_transport_injected: true,
    per_step_policy_overrides: true,
    automatic_execution: false,
    production_deploy: false,
  };
}
