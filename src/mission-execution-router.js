import { buildTaskExecutionContract } from './orchestration-state.js';
import { prepareMissionTaskDispatch } from './mission-execution-bridge.js';
import { executeAutomationMissionTask } from './automation-mission-bridge.js';
import { executeAIMissionTask } from './ai-mission-bridge.js';
import { executeBusinessMissionTask } from './business-mission-bridge.js';

const clone = (value) => structuredClone(value);
const SUPPORTED_ENGINES = ['web', 'automation', 'ai', 'business'];
const resolveMissionEngine = (contract = {}) => SUPPORTED_ENGINES.includes(contract.domain) ? contract.domain : contract.engine;

export function missionExecutionRouterManifest() {
  return {
    version: '4.8',
    supported_engines: [...SUPPORTED_ENGINES],
    planner_domain_resolution: true,
    web_execution: 'supervised_external_dispatch',
    automation_execution: 'supervised_inline_runner',
    ai_execution: 'injected_runner_only',
    business_execution: 'bounded_local_configuration',
    explicit_dispatch_approval_required: true,
    canonical_execution_contract: 'riosystems.provider-execution.v1',
    shared_contract_for_all_factories: true,
    universal_synthetic_path_classification: 'SYNTHETIC_TEST_HARNESS',
    automatic_cross_factory_execution: false,
    production_deploy: false
  };
}

export async function executeMissionTask(mission, taskId, approval = {}, options = {}) {
  const contractResult = buildTaskExecutionContract(mission, taskId);
  if (!contractResult.ok) return contractResult;
  const contract = contractResult;
  const engine = resolveMissionEngine(contract);

  if (engine === 'web') {
    const prepared = prepareMissionTaskDispatch(mission, taskId, approval, options.web || options);
    if (!prepared.ok) return prepared;
    return { ...prepared, execution_mode: 'supervised_external_dispatch', engine: 'web', pending_external_execution: true, production_deploy: false };
  }

  if (engine === 'automation') {
    const automationContract = options.automation_contract || options.automation_contracts?.[taskId];
    if (!automationContract) return { ok: false, error: 'AUTOMATION_CONTRACT_REQUIRED', task_id: taskId };
    const executed = await executeAutomationMissionTask(mission, taskId, automationContract, approval, options.automation || options);
    if (!executed.ok) return executed;
    return { ...executed, execution_mode: 'supervised_inline_runner', engine: 'automation', pending_external_execution: false, production_deploy: false };
  }

  if (engine === 'ai') {
    const aiOptions = { ...(options.ai || options), ...(options.ai_contracts?.[taskId] || options.ai_contract || {}) };
    const executed = await executeAIMissionTask(mission, taskId, approval, aiOptions);
    if (!executed.ok) return executed;
    return { ...executed, execution_mode: 'injected_runner_only', engine: 'ai', pending_external_execution: false, production_deploy: false };
  }

  if (engine === 'business') {
    const businessContract = options.business_contract || options.business_contracts?.[taskId];
    if (!businessContract) return { ok: false, error: 'BUSINESS_CONTRACT_REQUIRED', task_id: taskId };
    const executed = await executeBusinessMissionTask(mission, taskId, businessContract, approval, options.business || options);
    if (!executed.ok) return executed;
    return { ...executed, execution_mode: 'bounded_local_configuration', engine: 'business', pending_external_execution: false, production_deploy: false };
  }

  return { ok: false, error: 'MISSION_ENGINE_NOT_SUPPORTED', engine, underlying_engine: contract.engine, domain: contract.domain, task_id: taskId, supported_engines: [...SUPPORTED_ENGINES] };
}

export async function executeReadyMissionTasks(mission, approvals = {}, options = {}) {
  let current = clone(mission);
  const results = [];
  const maxTasks = Math.max(1, Math.min(Number(options.max_tasks) || 20, 50));
  let executedCount = 0;
  let progressed = true;

  while (progressed && executedCount < maxTasks) {
    progressed = false;
    const candidates = current.tasks?.filter((task) => task.state === 'READY') || [];
    for (const task of candidates) {
      if (executedCount >= maxTasks) break;
      const contract = buildTaskExecutionContract(current, task.task_id);
      if (!contract.ok) continue;
      const engine = resolveMissionEngine(contract);
      const approval = approvals[task.task_id] || approvals[engine] || approvals[contract.engine] || approvals.default || {};
      const result = await executeMissionTask(current, task.task_id, approval, {
        ...options,
        automation_contract: options.automation_contracts?.[task.task_id] || options.automation_contract,
        ai_contract: options.ai_contracts?.[task.task_id] || options.ai_contract,
        business_contract: options.business_contracts?.[task.task_id] || options.business_contract
      });
      if (!result.ok) {
        results.push({ task_id: task.task_id, engine, ok: false, error: result.error });
        continue;
      }
      current = result.mission;
      results.push({ task_id: task.task_id, engine, ok: true, execution_mode: result.execution_mode, pending_external_execution: result.pending_external_execution === true, state: current.tasks.find((item) => item.task_id === task.task_id)?.state || null });
      executedCount += 1;
      progressed = true;
    }
  }

  return { ok: true, mission: current, results, executed_count: executedCount, pending_external_tasks: results.filter((item) => item.ok && item.pending_external_execution).map((item) => item.task_id), production_deploy: false, automatic_cross_factory_execution: false };
}
