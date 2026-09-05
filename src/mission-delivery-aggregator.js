const clone = (value) => structuredClone(value ?? null);
const engineOf = (task = {}) => ['web', 'automation', 'ai', 'business'].includes(task.domain) ? task.domain : task.engine || null;
const terminal = new Set(['COMPLETED', 'FAILED', 'BLOCKED', 'CANCELLED']);
const businessStateChangesOf = (outputs = {}) => Array.isArray(outputs.business_state_changes) ? clone(outputs.business_state_changes) : [];

function executionEvidenceOf(task = {}) {
  const outputs = task.outputs || {};
  const evidence = outputs.execution_evidence && typeof outputs.execution_evidence === 'object'
    ? clone(outputs.execution_evidence)
    : null;
  const envelope = task.inputs?.dispatch_envelope || null;
  const planned = evidence?.planned_provider || envelope?.provider_route?.provider_id || null;
  const actual = evidence?.actual_provider || null;
  const dispatched = evidence?.dispatched_provider || null;
  return {
    evidence,
    planned_provider: planned,
    dispatched_provider: dispatched,
    actual_provider: actual,
    executor_id: evidence?.executor_id || envelope?.executor_id || null,
    actual_cost_eur: Number.isFinite(Number(evidence?.actual_cost_eur)) ? Number(evidence.actual_cost_eur) : null,
    provider_truth_required: Boolean(planned),
    provider_truth_valid: !planned || (planned === dispatched && planned === actual && Boolean(evidence?.executor_id))
  };
}

function artifactsOf(task = {}, engine = null) {
  const outputs = task.outputs || {};
  if (Array.isArray(outputs.artifacts)) return clone(outputs.artifacts);
  if (engine === 'web') {
    return [
      outputs.commit_sha ? { kind: 'commit', ref: outputs.commit_sha } : null,
      outputs.preview_url ? { kind: 'preview', ref: outputs.preview_url } : null,
      outputs.project_slug ? { kind: 'project', ref: outputs.project_slug } : null
    ].filter(Boolean);
  }
  if (outputs.result && typeof outputs.result === 'object') return [{ kind: `${engine || 'task'}_result`, value: clone(outputs.result) }];
  if (outputs.ai_output !== undefined) return [{ kind: 'ai_output', value: clone(outputs.ai_output) }];
  return [];
}

function qualityOf(task = {}, options = {}) {
  const explicit = options.quality_by_task?.[task.task_id] || task.outputs?.quality || null;
  if (explicit && typeof explicit === 'object') return clone(explicit);
  const qaStatus = task.outputs?.qa_status || null;
  return {
    status: qaStatus ? String(qaStatus).toUpperCase() : (task.state === 'COMPLETED' ? 'PASS' : 'NOT_VERIFIED'),
    score: Number.isFinite(Number(task.outputs?.qa_score)) ? Number(task.outputs.qa_score) : null,
    repair_rounds: Number(task.outputs?.repair_rounds || 0)
  };
}

function taskDelivery(task = {}, mission = {}, options = {}) {
  const engine = engineOf(task);
  const state = String(task.state || 'UNKNOWN');
  const outputs = clone(task.outputs || {});
  const businessStateChanges = businessStateChangesOf(outputs);
  const execution = executionEvidenceOf(task);
  const quality = qualityOf(task, options);
  const artifacts = artifactsOf(task, engine);
  const preview = outputs.preview_url || null;
  const nextAction = state === 'COMPLETED'
    ? (execution.provider_truth_valid ? 'READY_FOR_DELIVERY_AGGREGATION' : 'PROVIDER_TRUTH_REQUIRED')
    : state === 'FAILED' ? 'REPAIR_OR_HUMAN_REVIEW' : 'WAIT_FOR_TASK_TERMINAL_STATE';
  const standardResult = {
    schema: 'riosystems.standard-delivery-result.v1',
    delivery_id: `${mission.mission_id || 'mission'}:${task.task_id || 'task'}`,
    project: {
      customer_id: mission.customer_id || mission.project_context?.project?.customer_id || null,
      project_id: mission.project_id || mission.project_context?.project?.project_id || mission.project || null,
      scope_key: mission.scope_key || mission.project_context?.project?.scope_key || null
    },
    mission_id: mission.mission_id || null,
    task_id: task.task_id || null,
    capability: task.capability || null,
    factory: engine,
    planned_provider: execution.planned_provider,
    dispatched_provider: execution.dispatched_provider,
    actual_provider: execution.actual_provider,
    executor_id: execution.executor_id,
    artifacts,
    quality,
    actual_cost_eur: execution.actual_cost_eur,
    evidence: execution.evidence,
    version: execution.evidence?.provider_execution_version || null,
    preview,
    customer_review_state: options.customer_review_state || null,
    next_action: nextAction,
    provider_truth_valid: execution.provider_truth_valid,
    production_deploy: false
  };
  const base = {
    task_id: task.task_id || null,
    capability: task.capability || null,
    engine,
    state,
    attempt: Number(task.attempt || 0),
    completed: state === 'COMPLETED',
    external_job_id: task.external_job_id || null,
    planned_provider: execution.planned_provider,
    dispatched_provider: execution.dispatched_provider,
    actual_provider: execution.actual_provider,
    executor_id: execution.executor_id,
    actual_cost_eur: execution.actual_cost_eur,
    quality,
    artifacts,
    standard_result: standardResult,
    production_deploy: false,
    outputs
  };

  if (engine === 'web') {
    return {
      ...base,
      delivery_kind: 'web_project',
      evidence: {
        project_slug: outputs.project_slug || task.inputs?.factory_request?.project_slug || task.inputs?.factory_request?.target_project_slug || null,
        revision: outputs.revision ?? null,
        commit_sha: outputs.commit_sha || null,
        preview_url: outputs.preview_url || null,
        qa_status: outputs.qa_status || null,
        business_state_changes: businessStateChanges
      }
    };
  }
  if (engine === 'business') {
    return {
      ...base,
      delivery_kind: 'business_configuration',
      evidence: {
        business_system: clone(outputs.business_system || outputs.result || null),
        operation_count: outputs.operation_count ?? outputs.business_trace?.length ?? null,
        external_writes: false,
        business_state_changes: businessStateChanges
      }
    };
  }
  if (engine === 'ai') {
    return {
      ...base,
      delivery_kind: 'ai_output',
      evidence: {
        output: clone(outputs.ai_output ?? null),
        provider: outputs.provider || null,
        model: outputs.model || null,
        attempts: outputs.attempts ?? null,
        provider_activation_implicit: false,
        business_state_changes: businessStateChanges
      }
    };
  }
  if (engine === 'automation') {
    return {
      ...base,
      delivery_kind: 'automation_configuration',
      evidence: {
        result: clone(outputs.result || null),
        automation_trace: clone(outputs.automation_trace || []),
        external_transport_implicit: false,
        business_state_changes: businessStateChanges
      }
    };
  }
  return { ...base, delivery_kind: 'unknown', evidence: { business_state_changes: businessStateChanges } };
}

function activationSummary(activation = null) {
  if (!activation) return {
    evaluated: false,
    ready_for_supervised_execution: null,
    ready_for_external_activation: null,
    blockers: [],
    production_deploy: false
  };
  return {
    evaluated: true,
    status: activation.status || null,
    ready_for_supervised_execution: activation.ready_for_supervised_execution === true,
    ready_for_external_activation: activation.ready_for_external_activation === true,
    blockers: clone(activation.blockers || []),
    warnings: clone(activation.warnings || []),
    production_deploy: false
  };
}

export function aggregateMissionDelivery(mission = {}, options = {}) {
  if (!mission || typeof mission !== 'object' || !Array.isArray(mission.tasks)) return { ok: false, error: 'INVALID_MISSION' };
  const deliveries = mission.tasks.map((task) => taskDelivery(task, mission, options));
  const completed = deliveries.filter((item) => item.state === 'COMPLETED');
  const failed = deliveries.filter((item) => item.state === 'FAILED');
  const blocked = deliveries.filter((item) => item.state === 'BLOCKED');
  const pending = deliveries.filter((item) => !terminal.has(item.state));
  const byEngine = {};
  for (const delivery of deliveries) {
    const key = delivery.engine || 'unknown';
    if (!byEngine[key]) byEngine[key] = [];
    byEngine[key].push(delivery);
  }

  const providerTruthFailures = deliveries.filter((item) => item.completed && item.standard_result?.provider_truth_valid !== true);
  const missionCompleted = mission.status === 'COMPLETED' && completed.length === deliveries.length && providerTruthFailures.length === 0;
  const activation = activationSummary(options.activation || null);
  const structuralCompletion = missionCompleted;
  const externallyReady = activation.evaluated ? activation.ready_for_external_activation : false;

  return {
    ok: true,
    delivery_version: 'mission.delivery.v1',
    aggregator_version: '4.12',
    mission_id: mission.mission_id || null,
    orchestration_id: mission.orchestration_id || null,
    mission_prompt: mission.prompt || null,
    project: mission.project || null,
    mission_status: mission.status || null,
    structural_completion: structuralCompletion,
    external_activation_ready: externallyReady,
    completion_class: structuralCompletion
      ? (externallyReady ? 'STRUCTURALLY_COMPLETE_AND_EXTERNALLY_READY' : 'STRUCTURALLY_COMPLETE_EXTERNAL_ACTIVATION_SEPARATE')
      : 'MISSION_NOT_STRUCTURALLY_COMPLETE',
    counts: {
      total: deliveries.length,
      completed: completed.length,
      failed: failed.length,
      blocked: blocked.length,
      pending: pending.length,
      provider_truth_failures: providerTruthFailures.length
    },
    standard_delivery_results: deliveries.map((item) => clone(item.standard_result)),
    deliveries,
    by_engine: byEngine,
    activation,
    unresolved: [
      ...failed.map((item) => ({ task_id: item.task_id, engine: item.engine, state: item.state, error: clone(mission.tasks.find((task) => task.task_id === item.task_id)?.last_error || null) })),
      ...blocked.map((item) => ({ task_id: item.task_id, engine: item.engine, state: item.state })),
      ...pending.map((item) => ({ task_id: item.task_id, engine: item.engine, state: item.state })),
      ...providerTruthFailures.map((item) => ({ task_id: item.task_id, engine: item.engine, state: item.state, error: { code: 'PROVIDER_EXECUTION_TRUTH_MISMATCH' } }))
    ],
    safeguards: {
      production_deploy: false,
      automatic_multi_factory_execution: false,
      external_activation_separate: true
    }
  };
}

export function missionDeliveryAggregatorManifest() {
  return {
    version: '4.12',
    input: 'durable_mission_state_plus_optional_activation_readiness',
    output: 'unified_mission_delivery_report',
    aggregates_web_business_ai_automation: true,
    distinguishes_structural_completion_from_external_activation: true,
    structured_business_state_changes_forwarded: true,
    standard_delivery_result_v1: true,
    provider_execution_truth_forwarded: true,
    provider_truth_failure_blocks_structural_completion: true,
    mutates_external_systems: false,
    production_deploy: false
  };
}
