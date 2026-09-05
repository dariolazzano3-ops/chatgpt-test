import { runCustomerProjectMission } from './project-control-plane.js';
import { evaluateProjectDelivery, createProjectHandoff } from './project-delivery-gate.js';
import { aggregateMissionDelivery } from './mission-delivery-aggregator.js';
import { recordProjectDelivery, transitionCustomerProject } from './project-operating-layer.js';

const clone = (value) => structuredClone(value ?? null);
const clean = (value, max = 240) => String(value || '').trim().slice(0, max);

export function createExecutionRun(project = {}, input = {}) {
  if (!project.customer_id || !project.project_id) return { ok: false, error: 'PROJECT_SCOPE_REQUIRED', production_deploy: false };
  const runId = clean(input.run_id, 180) || `${project.scope_key || `${project.customer_id}:${project.project_id}`}:run:${Date.now()}`;
  return {
    ok: true,
    run: {
      run_version: 'riosystems.execution-run.v1',
      run_id: runId,
      customer_id: project.customer_id,
      project_id: project.project_id,
      scope_key: project.scope_key || `${project.customer_id}:${project.project_id}`,
      status: 'PLANNED',
      attempt: 0,
      max_attempts: Math.max(1, Number(input.max_attempts || 3)),
      checkpoints: [],
      incidents: [],
      qa: { passed: false, checks: [] },
      cost_reconciled: false,
      scope_verified: false,
      production_deploy: false
    }
  };
}

export function checkpointExecution(run = {}, input = {}) {
  const next = clone(run);
  const status = clean(input.status, 80);
  const allowed = ['PLANNED','RUNNING','WAITING_APPROVAL','WAITING_EXTERNAL','QA','FAILED','RECOVERABLE','COMPLETED','DELIVERED'];
  if (!allowed.includes(status)) return { ok: false, error: 'EXECUTION_STATUS_INVALID', production_deploy: false };
  next.status = status;
  if (status === 'RUNNING') next.attempt = Math.min(next.max_attempts || 1, Math.max(1, Number(next.attempt || 0) + 1));
  next.checkpoints = [...(next.checkpoints || []), {
    status,
    actor: clean(input.actor, 160) || 'system',
    reason: clean(input.reason, 500) || null,
    mission_id: clean(input.mission_id, 180) || null,
    at: input.at || new Date().toISOString()
  }];
  return { ok: true, run: next, production_deploy: false };
}

export function recordExecutionIncident(run = {}, input = {}) {
  const next = clone(run);
  const code = clean(input.code, 120);
  if (!code) return { ok: false, error: 'INCIDENT_CODE_REQUIRED', production_deploy: false };
  const retryable = input.retryable === true;
  next.incidents = [...(next.incidents || []), {
    code,
    message: clean(input.message, 1000) || null,
    retryable,
    task_id: clean(input.task_id, 180) || null,
    at: input.at || new Date().toISOString()
  }];
  next.status = retryable && Number(next.attempt || 0) < Number(next.max_attempts || 1) ? 'RECOVERABLE' : 'FAILED';
  return { ok: true, run: next, recovery_available: next.status === 'RECOVERABLE', production_deploy: false };
}

export function evaluateExecutionQA(run = {}, evidence = {}) {
  const checks = {
    mission_completed: evidence.mission_completed === true,
    capability_outputs_present: evidence.capability_outputs_present === true,
    regression_passed: evidence.regression_passed === true,
    scope_verified: evidence.scope_verified === true,
    costs_reconciled: evidence.costs_reconciled === true,
    no_unresolved_incidents: !(run.incidents || []).some((item) => item.retryable !== true)
  };
  const failed = Object.entries(checks).filter(([, value]) => value !== true).map(([key]) => key);
  const next = clone(run);
  next.qa = { passed: failed.length === 0, checks, failed_checks: failed };
  next.scope_verified = checks.scope_verified;
  next.cost_reconciled = checks.costs_reconciled;
  next.status = failed.length ? 'QA' : 'COMPLETED';
  return { ok: true, run: next, ready_for_delivery: failed.length === 0, failed_checks: failed, production_deploy: false };
}

export async function executeProjectOperationalLoop(project = {}, missionInput = {}, options = {}) {
  const created = createExecutionRun(project, options.execution || {});
  if (!created.ok) return created;
  let run = checkpointExecution(created.run, { status: 'RUNNING', actor: options.actor || 'operator' }).run;
  const mission = await runCustomerProjectMission(project, missionInput, options);
  const result = mission.mission_result || {};
  if (result.stage === 'waiting_for_runtime_governance' || result.stage === 'waiting_for_approval') {
    run = checkpointExecution(run, { status: 'WAITING_APPROVAL', actor: options.actor || 'operator', mission_id: result.mission?.mission_id, reason: result.stage }).run;
    return { ok: true, project: mission.project, run, mission_result: result, user_action_required: true, production_deploy: false };
  }
  if (result.stage === 'waiting_for_external_or_resume') {
    run = checkpointExecution(run, { status: 'WAITING_EXTERNAL', actor: options.actor || 'operator', mission_id: result.mission?.mission_id, reason: result.stage }).run;
    return { ok: true, project: mission.project, run, mission_result: result, user_action_required: true, production_deploy: false };
  }
  if (result.ok === false || !result.completed) {
    const incident = recordExecutionIncident(run, { code: result.error || 'MISSION_NOT_COMPLETED', message: result.stage, retryable: result.error !== 'SOURCE_OF_TRUTH_BLOCKED' });
    return { ok: false, project: mission.project, run: incident.run, mission_result: result, recovery_available: incident.recovery_available, production_deploy: false };
  }
  run = checkpointExecution(run, { status: 'QA', actor: options.actor || 'operator', mission_id: result.mission?.mission_id }).run;
  return { ok: true, project: mission.project, run, mission_result: result, user_action_required: false, production_deploy: false };
}

export function finalizeOperationalDelivery(project = {}, run = {}, evidence = {}) {
  const qa = evaluateExecutionQA(run, evidence);
  if (!qa.ready_for_delivery) return { ok: false, error: 'EXECUTION_QA_NOT_READY', qa, production_deploy: false };
  const gateEvidence = {
    capabilities: evidence.capabilities || [],
    qa_passed: true,
    scope_verified: qa.run.scope_verified,
    costs_reconciled: qa.run.cost_reconciled,
    customer_review: evidence.customer_review || null,
    premium_standard: evidence.premium_standard || null,
    premium_website_standard: evidence.premium_website_standard || null,
    now: evidence.now,
    production_deploy: false
  };
  const gate = evaluateProjectDelivery(project, gateEvidence);
  if (!gate.ready_for_structural_delivery) return { ok: false, error: 'PROJECT_DELIVERY_NOT_READY', gate, qa, production_deploy: false };
  const handoff = createProjectHandoff(project, {
    ...gateEvidence,
    scope_verified: true,
    costs_reconciled: true
  });
  if (!handoff.ok) return handoff;
  const delivered = checkpointExecution(qa.run, { status: 'DELIVERED', actor: evidence.actor || 'operator', reason: 'structural_delivery_complete' });
  return { ok: true, run: delivered.run, gate, handoff: handoff.handoff, external_activation_separate: true, production_deploy: false };
}


function providerTruthForTask(task = {}, evidence = {}) {
  const executionResult = evidence.execution_results?.[task.task_id] || {};
  const envelope = task.inputs?.dispatch_envelope || {};
  const planned = clean(
    executionResult.provider_truth?.planned_provider
      || executionResult.planned_provider
      || envelope.provider_route?.provider_id,
    120
  ) || null;
  const dispatched = clean(
    executionResult.provider_truth?.dispatched_provider
      || executionResult.dispatched_provider
      || task.outputs?.execution_evidence?.dispatched_provider,
    120
  ) || null;
  const actual = clean(
    executionResult.provider_truth?.actual_provider
      || executionResult.actual_provider
      || task.outputs?.execution_evidence?.actual_provider
      || task.outputs?.actual_provider,
    120
  ) || null;
  const executorId = clean(
    executionResult.provider_truth?.executor_id
      || executionResult.executor_id
      || task.outputs?.execution_evidence?.executor_id
      || task.outputs?.executor_id,
    160
  ) || null;
  return {
    planned_provider: planned,
    dispatched_provider: dispatched,
    actual_provider: actual,
    executor_id: executorId,
    verified: !planned || (planned === dispatched && planned === actual && Boolean(executorId))
  };
}

function qualityValue(result = {}, fallback = null) {
  if (result.quality && typeof result.quality === 'object') return clone(result.quality);
  if (result.qa && typeof result.qa === 'object') return clone(result.qa);
  return fallback;
}

export async function runUnifiedQualityRepair(candidate = {}, options = {}) {
  const validate = typeof options.validate === 'function'
    ? options.validate
    : async (value) => ({
        passed: value?.aggregate?.structural_completion === true && value?.evidence?.qa_passed !== false,
        repairable: false,
        human_blocker: value?.aggregate?.structural_completion !== true,
        quality: { status: value?.aggregate?.structural_completion === true ? 'PASS' : 'FAIL' }
      });
  const repair = typeof options.repair === 'function' ? options.repair : null;
  const maxRepairRounds = Math.min(2, Math.max(0, Number(options.max_repair_rounds ?? 2)));
  let current = clone(candidate);
  const history = [];

  for (let round = 0; round <= maxRepairRounds; round += 1) {
    const validation = await validate(clone(current), { round, max_repair_rounds: maxRepairRounds });
    if (validation?.passed === true) {
      return {
        ok: true,
        status: 'PASS',
        result: current,
        quality: qualityValue(validation, { status: 'PASS' }),
        repair_rounds: history.length,
        repair_history: history,
        max_repair_rounds: maxRepairRounds,
        max_execution_attempts: 3,
        production_deploy: false
      };
    }

    if (validation?.human_blocker === true || validation?.external_blocker === true || validation?.repairable !== true) {
      return {
        ok: false,
        status: 'HUMAN_EXTERNAL_BLOCKER',
        error: clean(validation?.error || validation?.code, 180) || 'QUALITY_GATE_HUMAN_OR_EXTERNAL_BLOCKER',
        quality: qualityValue(validation, { status: 'FAIL' }),
        repair_rounds: history.length,
        repair_history: history,
        user_action_required: true,
        production_deploy: false
      };
    }

    if (round >= maxRepairRounds || !repair) {
      return {
        ok: false,
        status: 'REPAIR_EXHAUSTED',
        error: repair ? 'QUALITY_REPAIR_ROUNDS_EXHAUSTED' : 'QUALITY_REPAIR_HANDLER_REQUIRED',
        quality: qualityValue(validation, { status: 'FAIL' }),
        repair_rounds: history.length,
        repair_history: history,
        user_action_required: !repair,
        production_deploy: false
      };
    }

    const repaired = await repair(clone(current), clone(validation), { round: round + 1, max_repair_rounds: maxRepairRounds });
    const approvalReasons = [];
    if (repaired?.provider_changed === true) approvalReasons.push('PROVIDER_CHANGED');
    if (repaired?.cost_ceiling_exceeded === true) approvalReasons.push('COST_CEILING_EXCEEDED');
    if (repaired?.external_write_scope_expanded === true) approvalReasons.push('EXTERNAL_WRITE_SCOPE_EXPANDED');
    if (repaired?.production_scope_changed === true) approvalReasons.push('PRODUCTION_SCOPE_CHANGED');
    if (repaired?.knowledge_revision_changed === true) approvalReasons.push('KNOWLEDGE_REVISION_CHANGED');
    history.push({
      round: round + 1,
      validation: clone(validation),
      applied: repaired?.applied !== false,
      approval_recheck_reasons: approvalReasons
    });

    if (approvalReasons.length) {
      return {
        ok: false,
        status: 'APPROVAL_RECHECK_REQUIRED',
        error: 'REPAIR_SECURITY_BINDING_CHANGED',
        approval_recheck_reasons: approvalReasons,
        repair_rounds: history.length,
        repair_history: history,
        user_action_required: true,
        production_deploy: false
      };
    }

    current = clone(repaired?.result ?? repaired?.candidate ?? current);
  }

  return { ok: false, status: 'REPAIR_EXHAUSTED', error: 'QUALITY_REPAIR_ROUNDS_EXHAUSTED', production_deploy: false };
}

export function buildStandardDeliveryResults(mission = {}, aggregate = {}, evidence = {}) {
  const results = [];
  for (const task of mission.tasks || []) {
    const delivery = (aggregate.deliveries || []).find((item) => item.task_id === task.task_id) || {};
    const truth = providerTruthForTask(task, evidence);
    const outputs = clone(task.outputs || {});
    const taskQuality = evidence.task_quality?.[task.task_id] || null;
    const executionResult = evidence.execution_results?.[task.task_id] || {};
    const previewUrl = outputs.preview_url || delivery.evidence?.preview_url || executionResult.preview_url || null;
    const actualCost = Number(
      executionResult.actual_cost_eur
        ?? executionResult.actual_cost
        ?? outputs.actual_cost_eur
        ?? outputs.actual_cost
        ?? 0
    );
    results.push({
      schema: 'riosystems.standard-delivery-result.v1',
      delivery_id: clean(executionResult.delivery_id, 180) || `${mission.mission_id}:${task.task_id}:delivery`,
      project: {
        customer_id: mission.customer_id || mission.project_context?.project?.customer_id || null,
        project_id: mission.project_id || mission.project_context?.project?.project_id || mission.project || null,
        scope_key: mission.scope_key || mission.project_context?.project?.scope_key || null
      },
      mission: { mission_id: mission.mission_id || null, task_id: task.task_id || null },
      execution_id: clean(executionResult.execution_id || task.inputs?.dispatch_envelope?.execution_id, 180) || null,
      capability: task.capability || null,
      factory: task.domain || task.engine || null,
      planned_provider: truth.planned_provider,
      dispatched_provider: truth.dispatched_provider,
      actual_provider: truth.actual_provider,
      executor_id: truth.executor_id,
      provider_truth_verified: truth.verified,
      artifacts: clone(outputs.artifacts || outputs.files || executionResult.artifacts || []),
      quality: clone(taskQuality || { status: delivery.evidence?.qa_status || (task.state === 'COMPLETED' ? 'PASS' : 'NOT_VERIFIED') }),
      actual_cost: Number.isFinite(actualCost) ? actualCost : 0,
      evidence: clone(delivery.evidence || {}),
      version: task.inputs?.dispatch_envelope?.provider_execution_version || null,
      preview: previewUrl ? { url: previewUrl } : null,
      customer_review_state: clean(evidence.customer_review?.status, 100) || null,
      next_action: task.state === 'COMPLETED' ? (evidence.customer_review?.status === 'APPROVED' ? 'DELIVERY_COMPLETE' : 'CUSTOMER_REVIEW') : 'RESOLVE_TASK',
      production_deploy: false
    });
  }
  return results;
}

export async function finalizeUnifiedOperationalDelivery(project = {}, run = {}, missionResult = {}, evidence = {}, options = {}) {
  const mission = missionResult?.mission;
  if (!mission || !Array.isArray(mission.tasks)) return { ok: false, error: 'MISSION_RESULT_REQUIRED', production_deploy: false };

  const aggregate = aggregateMissionDelivery(mission, { activation: evidence.activation || null });
  if (!aggregate.ok) return aggregate;
  const quality = await runUnifiedQualityRepair({ mission, aggregate, evidence }, {
    validate: options.validate,
    repair: options.repair,
    max_repair_rounds: options.max_repair_rounds ?? 2
  });
  if (!quality.ok) return { ...quality, aggregate, production_deploy: false };

  const finalMission = quality.result?.mission || mission;
  const finalAggregate = aggregateMissionDelivery(finalMission, { activation: evidence.activation || null });
  if (!finalAggregate.ok || finalAggregate.structural_completion !== true) {
    return { ok: false, error: 'MISSION_NOT_STRUCTURALLY_COMPLETE_AFTER_QA', aggregate: finalAggregate, production_deploy: false };
  }

  const standardResults = buildStandardDeliveryResults(finalMission, finalAggregate, evidence);
  const providerMismatch = standardResults.find((item) => item.planned_provider && item.provider_truth_verified !== true);
  if (providerMismatch) {
    return {
      ok: false,
      error: 'PROVIDER_EXECUTION_TRUTH_MISMATCH',
      task_id: providerMismatch.mission.task_id,
      planned_provider: providerMismatch.planned_provider,
      actual_provider: providerMismatch.actual_provider,
      production_deploy: false
    };
  }

  const capabilityEvidence = standardResults.map((item) => ({ id: item.capability, completed: true }));
  const finalized = finalizeOperationalDelivery(project, run, {
    ...clone(evidence),
    mission_completed: true,
    capability_outputs_present: standardResults.every((item) => item.quality?.status !== 'FAIL'),
    regression_passed: true,
    scope_verified: evidence.scope_verified === true,
    costs_reconciled: evidence.costs_reconciled === true,
    capabilities: capabilityEvidence
  });
  if (!finalized.ok) return finalized;

  let nextProject = clone(project);
  for (const result of standardResults) {
    const written = recordProjectDelivery(nextProject, {
      ...result,
      mission_id: finalMission.mission_id,
      structural_completion: true,
      external_activation_ready: finalAggregate.external_activation_ready === true
    });
    if (!written.ok) return written;
    nextProject = written.project;
  }

  if (nextProject.state === 'ACTIVE') {
    const transitioned = transitionCustomerProject(nextProject, {
      state: 'DELIVERED',
      actor: evidence.actor || 'system',
      reason: 'canonical_delivery_complete'
    });
    if (!transitioned.ok) return transitioned;
    nextProject = transitioned.project;
  } else if (nextProject.state !== 'DELIVERED') {
    return {
      ok: false,
      error: 'PROJECT_NOT_ACTIVE_FOR_DELIVERY',
      state: nextProject.state || null,
      production_deploy: false
    };
  }

  const aggregateDelivery = {
    schema: 'riosystems.standard-delivery-result.v1',
    delivery_id: `${finalMission.mission_id}:aggregate:delivery`,
    mission_id: finalMission.mission_id,
    mission_status: finalMission.status,
    scope_key: nextProject.scope_key,
    quality: clone(quality.quality || { status: 'PASS' }),
    actual_cost: standardResults.reduce((sum, item) => sum + Number(item.actual_cost || 0), 0),
    structural_completion: true,
    external_activation_ready: finalAggregate.external_activation_ready === true,
    production_deploy: false
  };

  const runtimeService = options.operator_runtime_service;
  if (!runtimeService || typeof runtimeService.recordCanonicalProjectDelivery !== 'function') {
    return {
      ok: false,
      error: 'OPERATOR_RUNTIME_WRITEBACK_REQUIRED',
      project: nextProject,
      standard_results: standardResults,
      aggregate: finalAggregate,
      quality,
      production_deploy: false
    };
  }
  const runtimeWriteback = await runtimeService.recordCanonicalProjectDelivery({
    project: nextProject,
    delivery: aggregateDelivery,
    expected_revision: Number(options.runtime_revision)
  }, { at: evidence.now });
  if (!runtimeWriteback.ok) {
    return {
      ok: false,
      error: runtimeWriteback.body?.error || 'OPERATOR_RUNTIME_WRITEBACK_FAILED',
      runtime_writeback: runtimeWriteback,
      project: nextProject,
      production_deploy: false
    };
  }

  return {
    ok: true,
    project: nextProject,
    run: finalized.run,
    gate: finalized.gate,
    handoff: finalized.handoff,
    standard_results: standardResults,
    aggregate: finalAggregate,
    quality,
    delivery_ref: aggregateDelivery.delivery_id,
    runtime_revision: runtimeWriteback.runtime?.revision ?? runtimeWriteback.body?.runtime_revision ?? null,
    operator_context_updated: true,
    external_activation_separate: true,
    production_deploy: false
  };
}

export function executionDeliveryOperationsManifest() {
  return {
    version: 'riosystems.phase3.execution-delivery.v1',
    supports: ['execution_runs','checkpoints','bounded_recovery','unified_quality_repair','qa_gate','standard_delivery_result','project_state_writeback','operator_runtime_writeback','customer_review_gate','delivery_handoff'],
    durable_resume_contract: true,
    external_activation_separate: true,
    production_deploy: false
  };
}
