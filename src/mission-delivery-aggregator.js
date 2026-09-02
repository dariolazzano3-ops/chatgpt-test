const clone = (value) => structuredClone(value ?? null);
const engineOf = (task = {}) => ['web', 'automation', 'ai', 'business'].includes(task.domain) ? task.domain : task.engine || null;
const terminal = new Set(['COMPLETED', 'FAILED', 'BLOCKED', 'CANCELLED']);
const businessStateChangesOf = (outputs = {}) => Array.isArray(outputs.business_state_changes) ? clone(outputs.business_state_changes) : [];

function taskDelivery(task = {}) {
  const engine = engineOf(task);
  const state = String(task.state || 'UNKNOWN');
  const outputs = clone(task.outputs || {});
  const businessStateChanges = businessStateChangesOf(outputs);
  const base = {
    task_id: task.task_id || null,
    capability: task.capability || null,
    engine,
    state,
    attempt: Number(task.attempt || 0),
    completed: state === 'COMPLETED',
    external_job_id: task.external_job_id || null,
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
  const deliveries = mission.tasks.map(taskDelivery);
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

  const missionCompleted = mission.status === 'COMPLETED' && completed.length === deliveries.length;
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
      pending: pending.length
    },
    deliveries,
    by_engine: byEngine,
    activation,
    unresolved: [
      ...failed.map((item) => ({ task_id: item.task_id, engine: item.engine, state: item.state, error: clone(mission.tasks.find((task) => task.task_id === item.task_id)?.last_error || null) })),
      ...blocked.map((item) => ({ task_id: item.task_id, engine: item.engine, state: item.state })),
      ...pending.map((item) => ({ task_id: item.task_id, engine: item.engine, state: item.state }))
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
    mutates_external_systems: false,
    production_deploy: false
  };
}
