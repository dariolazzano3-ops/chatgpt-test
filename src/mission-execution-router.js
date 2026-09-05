import { buildTaskExecutionContract, transitionMissionTask } from './orchestration-state.js';
import { prepareMissionTaskDispatch } from './mission-execution-bridge.js';
import { executeAutomationMissionTask } from './automation-mission-bridge.js';
import { executeAIMissionTask } from './ai-mission-bridge.js';
import { executeBusinessMissionTask } from './business-mission-bridge.js';
import {
  authorizeAdapterDispatch,
  buildAdapterDispatchEnvelope,
  canonicalProviderExecutorDescriptor,
  executeCanonicalProviderRoute
} from './execution-adapters.js';
import { executeCanonicalNativeWebTask } from './web-factory/adapter.js';
import { runMakeStagingScenarioOnce } from './make-staging-execution-runner.js';
import { runSupabaseStagingCrmWrite } from './business-staging-write-plan.js';
import { sendPostHogStagingBatchOnce } from './posthog-staging-event-runner.js';
import { settleCost } from './runtime-cost-ledger.js';

const clone = (value) => structuredClone(value);
const SUPPORTED_ENGINES = ['web', 'automation', 'ai', 'business'];
const resolveMissionEngine = (contract = {}) => SUPPORTED_ENGINES.includes(contract.domain) ? contract.domain : contract.engine;
const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);

function nativeWebTaskFor(mission = {}, contract = {}, options = {}) {
  const explicit = options.web_tasks?.[contract.task_id] || options.web_task;
  if (explicit && typeof explicit === 'object' && !Array.isArray(explicit)) return clone(explicit);

  const context = mission.project_context;
  if (!context || context.schema !== 'aurentara.project-mission-context.v1') return null;
  const values = context.verified_content || {};
  const rawServices = values['business.services'] ?? values['business.offerings'] ?? values['business.products'];
  const services = Array.isArray(rawServices)
    ? rawServices.map((item) => clean(item, 160)).filter(Boolean)
    : rawServices ? [clean(rawServices, 160)].filter(Boolean) : ['Website'];

  return {
    capability: 'web.build',
    project_context: clone(context),
    input: {
      business_name: clean(values['business.name'] || values['business.identity'] || contract.project_id || contract.project || 'Project', 500),
      project_slug: clean(options.project_slug || contract.project_id || contract.project || 'website-project', 160),
      industry: clean(values['business.industry'] || options.industry || 'local-business', 160),
      primary_goal: clean(values['website.primary_goal'] || contract.goal || 'Private staging preview', 500),
      services: services.length ? services : ['Website'],
      country: clean(options.country || 'Germany', 80),
      language: clean(options.language || 'de', 16),
      project_scope_key: contract.project_scope_key || null,
      project_mission_context: clone(context),
      synthetic_test_data_only: options.synthetic_test_data_only === true,
      production_deploy: false
    }
  };
}

function providerExecutorMap(mission, contract, options = {}) {
  const configured = options.provider_executors && typeof options.provider_executors === 'object'
    ? { ...options.provider_executors }
    : {};

  if (typeof configured['riosystems-native-web'] !== 'function') {
    const webTask = nativeWebTaskFor(mission, contract, options);
    if (webTask) {
      configured['riosystems-native-web'] = async () => executeCanonicalNativeWebTask(
        webTask,
        options.web_factory_options || options.web_factory || {}
      );
    }
  }

  if (typeof configured['make-core'] !== 'function' && options.make_plan && options.make_runtime) {
    configured['make-core'] = async () => runMakeStagingScenarioOnce(options.make_plan, {
      ...options.make_runtime,
      production_deploy: false
    });
  }

  if (typeof configured['supabase-free'] !== 'function' && options.supabase_plan && options.supabase_runtime) {
    configured['supabase-free'] = async () => runSupabaseStagingCrmWrite(options.supabase_plan, {
      ...options.supabase_runtime,
      production_deploy: false
    });
  }

  if (typeof configured['posthog-free'] !== 'function' && options.posthog_plan && options.posthog_runtime) {
    configured['posthog-free'] = async () => sendPostHogStagingBatchOnce(options.posthog_plan, {
      ...options.posthog_runtime,
      production_deploy: false
    });
  }

  if (typeof configured['openai-api'] !== 'function' && typeof options.openai_provider_adapter?.infer === 'function' && options.openai_request) {
    configured['openai-api'] = async () => {
      const result = await options.openai_provider_adapter.infer(clone(options.openai_request));
      return {
        ok: result?.ok === true,
        status: result?.ok === true ? 'COMPLETED' : 'FAILED',
        outputs: result?.ok === true ? { ai_output: clone(result.output), model: result.provider_model || null } : {},
        error: result?.ok === true ? null : (result?.error || 'OPENAI_EXECUTION_FAILED'),
        actual_provider: result?.actual_provider || result?.provider || null,
        executor_id: result?.executor_id || null,
        actual_cost_eur: Number.isFinite(Number(result?.actual_cost_eur)) ? Number(result.actual_cost_eur) : null,
        provider_call_count: 1,
        external_write_state: 'NO_EXTERNAL_CUSTOMER_WRITE',
        external_side_effect_performed: false,
        production_deploy: false
      };
    };
  }

  if (typeof configured['cloudflare-workers-free'] !== 'function' && typeof options.cloudflare_preview_executor === 'function') {
    configured['cloudflare-workers-free'] = options.cloudflare_preview_executor;
  }

  return configured;
}

function activeReservation(ledger = null, contract = {}) {
  const reservationId = clean(contract.budget_reservation_ref?.reservation_id, 160);
  if (!reservationId || !ledger || !Array.isArray(ledger.entries)) return null;
  const reserve = ledger.entries.find((entry) => entry?.type === 'reserve' && entry.reservation_id === reservationId);
  if (!reserve) return null;
  const terminal = ledger.entries.find((entry) => ['settle','release'].includes(entry?.type) && entry.reservation_id === reservationId);
  return terminal ? null : reserve;
}

function paidApprovalValidated(contract = {}) {
  return Array.isArray(contract.approval_ref?.approval_ids)
    && contract.approval_ref.approval_ids.length > 0
    && Boolean(contract.budget_reservation_ref?.reservation_id);
}

function preflightProviderBoundExecution(contract = {}, envelope = {}, executors = {}, options = {}) {
  if (options.production_deploy === true) return { ok: false, error: 'PRODUCTION_SIDE_EFFECT_REJECTED' };
  if (options.external_writes === true) return { ok: false, error: 'UNSCOPED_EXTERNAL_WRITES_REJECTED' };

  const providerId = clean(contract.provider_route?.provider_id, 120);
  const descriptor = canonicalProviderExecutorDescriptor(providerId);
  if (!descriptor) return { ok: false, error: 'PROVIDER_EXECUTOR_NOT_AVAILABLE', provider_id: providerId || null };

  const verified = new Set(Array.isArray(options.current_runtime_verified_provider_ids)
    ? options.current_runtime_verified_provider_ids
    : []);
  if (!verified.has(providerId)) return { ok: false, error: 'PROVIDER_NOT_EXECUTION_READY', provider_id: providerId };

  if (descriptor.external_write === true && envelope.write_policy === 'NO_EXTERNAL_WRITES') {
    return { ok: false, error: 'PROVIDER_EXTERNAL_WRITE_POLICY_BLOCKED', provider_id: providerId, write_policy: envelope.write_policy };
  }

  if (typeof executors[providerId] !== 'function') {
    return { ok: false, error: 'PROVIDER_EXECUTOR_NOT_CONFIGURED', provider_id: providerId, executor_id: descriptor.executor_id };
  }

  if (descriptor.paid === true) {
    if (!paidApprovalValidated(contract)) {
      return { ok: false, error: 'PROVIDER_COST_APPROVAL_NOT_VALIDATED', provider_id: providerId };
    }
    const reservation = activeReservation(options.cost_ledger, contract);
    if (!reservation) return { ok: false, error: 'PAID_PROVIDER_COST_RESERVATION_REQUIRED', provider_id: providerId };
    if (reservation.execution_id && reservation.execution_id !== contract.execution_id) {
      return { ok: false, error: 'PAID_PROVIDER_COST_RESERVATION_BINDING_MISMATCH', provider_id: providerId };
    }
  }

  return { ok: true, descriptor };
}

async function executeCanonicalProviderMissionTask(mission, taskId, approval = {}, options = {}) {
  const contract = buildTaskExecutionContract(mission, taskId);
  if (!contract.ok) return contract;
  if (!contract.provider_route?.provider_id) return { ok: false, error: 'CANONICAL_PROVIDER_ROUTE_REQUIRED', task_id: taskId };

  const rawEnvelope = buildAdapterDispatchEnvelope(contract);
  if (!rawEnvelope.ok) return rawEnvelope;
  const authorized = authorizeAdapterDispatch(rawEnvelope, approval);
  if (!authorized.ok) return authorized;

  const executors = providerExecutorMap(mission, contract, options);
  const preflight = preflightProviderBoundExecution(contract, authorized.envelope, executors, options);
  if (!preflight.ok) return { ...preflight, task_id: taskId, production_deploy: false };

  const started = transitionMissionTask(mission, taskId, 'start', {
    inputs: {
      adapter_id: authorized.envelope.adapter_id,
      dispatch_envelope: authorized.envelope,
      canonical_provider_execution: true,
      provider_id: contract.provider_route.provider_id,
      executor_id: contract.executor_id || preflight.descriptor.executor_id,
      production_deploy: false,
      external_writes: false
    }
  });
  if (!started.ok) return started;

  const executed = await executeCanonicalProviderRoute(authorized.envelope, {
    current_runtime_verified_provider_ids: options.current_runtime_verified_provider_ids,
    cost_approval_validated: preflight.descriptor.paid === true ? true : false,
    executors,
    production_deploy: false,
    external_writes: false
  });

  if (!executed.ok) {
    const failed = transitionMissionTask(started.mission, taskId, 'fail', {
      code: executed.error || 'CANONICAL_PROVIDER_EXECUTION_FAILED',
      message: executed.message || null,
      retryable: false
    });
    return {
      ...executed,
      mission: failed.ok ? failed.mission : started.mission,
      cost_ledger: options.cost_ledger || null,
      execution_attempted: true,
      execution_mode: 'canonical_provider_route',
      production_deploy: false
    };
  }

  const actualCost = Number(executed.raw_result?.actual_cost_units ?? executed.raw_result?.actual_cost_eur ?? 0);
  if (preflight.descriptor.paid === true && (!Number.isFinite(actualCost) || actualCost < 0)) {
    const failed = transitionMissionTask(started.mission, taskId, 'fail', {
      code: 'PROVIDER_ACTUAL_COST_REQUIRED',
      message: 'Paid provider execution did not return a valid actual cost.',
      retryable: false
    });
    return {
      ok: false,
      error: 'PROVIDER_ACTUAL_COST_REQUIRED',
      mission: failed.ok ? failed.mission : started.mission,
      cost_ledger: options.cost_ledger || null,
      execution_attempted: true,
      provider_truth: executed.provider_truth,
      production_deploy: false
    };
  }

  let ledger = options.cost_ledger ? clone(options.cost_ledger) : null;
  let settlement = null;
  if (contract.budget_reservation_ref?.reservation_id && ledger) {
    settlement = settleCost(ledger, {
      reservation_id: contract.budget_reservation_ref.reservation_id,
      actual_cost_units: Number.isFinite(actualCost) ? actualCost : 0,
      execution_id: contract.execution_id,
      customer_id: contract.customer_id,
      project_id: contract.project_id,
      scope_key: contract.project_scope_key
    });
    if (!settlement.ok) {
      const failed = transitionMissionTask(started.mission, taskId, 'fail', {
        code: settlement.error || 'COST_SETTLEMENT_FAILED',
        message: settlement.error || null,
        retryable: false
      });
      return {
        ok: false,
        error: settlement.error || 'COST_SETTLEMENT_FAILED',
        mission: failed.ok ? failed.mission : started.mission,
        cost_ledger: ledger,
        execution_attempted: true,
        provider_truth: executed.provider_truth,
        production_deploy: false
      };
    }
    ledger = settlement.ledger;
  }

  const outputs = {
    ...(executed.result.outputs || {}),
    execution_evidence: {
      planned_provider: executed.provider_truth.planned_provider,
      dispatched_provider: executed.provider_truth.dispatched_provider,
      actual_provider: executed.provider_truth.actual_provider,
      executor_id: executed.provider_truth.executor_id,
      actual_cost_eur: Number.isFinite(Number(executed.raw_result?.actual_cost_eur)) ? Number(executed.raw_result.actual_cost_eur) : 0,
      provider_call_count: Number.isFinite(Number(executed.raw_result?.provider_call_count)) ? Number(executed.raw_result.provider_call_count) : null,
      external_write_state: executed.raw_result?.external_write_state || null,
      production_deploy: false
    },
    cost_settlement: settlement ? {
      reservation_id: settlement.reservation_id,
      actual_cost_units: settlement.actual_cost_units,
      duplicate: settlement.duplicate === true
    } : null
  };

  const completed = transitionMissionTask(started.mission, taskId, 'complete', { outputs });
  if (!completed.ok) return { ...completed, cost_ledger: ledger, execution_attempted: true, provider_truth: executed.provider_truth };

  return {
    ok: true,
    mission: completed.mission,
    contract,
    envelope: authorized.envelope,
    provider_truth: executed.provider_truth,
    raw_result: executed.raw_result,
    cost_settlement: settlement,
    cost_ledger: ledger,
    execution_attempted: true,
    execution_mode: 'canonical_provider_route',
    pending_external_execution: false,
    production_deploy: false,
    external_writes: false
  };
}

export function missionExecutionRouterManifest() {
  return {
    version: '4.9',
    supported_engines: [...SUPPORTED_ENGINES],
    planner_domain_resolution: true,
    provider_bound_execution: 'canonical_provider_route_required',
    native_web_execution: 'real_internal_web_factory',
    external_provider_execution: 'canonical_fail_closed_unless_existing_runner_and_scope_are_ready',
    explicit_dispatch_approval_required: true,
    canonical_execution_contract: 'riosystems.provider-execution.v1',
    canonical_provider_executor: 'execution-adapters.executeCanonicalProviderRoute',
    shared_contract_for_all_factories: true,
    operator_ai_same_backbone: true,
    universal_synthetic_path_classification: 'SYNTHETIC_TEST_HARNESS',
    automatic_cross_factory_execution: false,
    production_deploy: false
  };
}

export async function executeMissionTask(mission, taskId, approval = {}, options = {}) {
  const contractResult = buildTaskExecutionContract(mission, taskId);
  if (!contractResult.ok) return contractResult;
  const contract = contractResult;

  if (contract.provider_route?.provider_id) {
    return executeCanonicalProviderMissionTask(mission, taskId, approval, options);
  }

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
  let ledger = options.cost_ledger ? clone(options.cost_ledger) : null;
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
        cost_ledger: ledger,
        automation_contract: options.automation_contracts?.[task.task_id] || options.automation_contract,
        ai_contract: options.ai_contracts?.[task.task_id] || options.ai_contract,
        business_contract: options.business_contracts?.[task.task_id] || options.business_contract
      });

      if (result.cost_ledger) ledger = clone(result.cost_ledger);

      if (!result.ok) {
        if (result.mission) {
          current = result.mission;
          progressed = true;
        }
        if (result.execution_attempted === true) executedCount += 1;
        results.push({
          task_id: task.task_id,
          engine,
          ok: false,
          error: result.error,
          execution_mode: result.execution_mode || null,
          provider_truth: result.provider_truth || null
        });
        continue;
      }

      current = result.mission;
      results.push({
        task_id: task.task_id,
        engine,
        ok: true,
        execution_mode: result.execution_mode,
        pending_external_execution: result.pending_external_execution === true,
        provider_truth: result.provider_truth || null,
        cost_settlement: result.cost_settlement || null,
        state: current.tasks.find((item) => item.task_id === task.task_id)?.state || null
      });
      executedCount += 1;
      progressed = true;
    }
  }

  return {
    ok: true,
    mission: current,
    results,
    executed_count: executedCount,
    pending_external_tasks: results.filter((item) => item.ok && item.pending_external_execution).map((item) => item.task_id),
    cost_ledger: ledger,
    production_deploy: false,
    external_writes: false,
    automatic_cross_factory_execution: false
  };
}
