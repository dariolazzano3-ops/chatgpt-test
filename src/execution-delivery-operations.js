import { runCustomerProjectMission } from './project-control-plane.js';
import { evaluateProjectDelivery, createProjectHandoff } from './project-delivery-gate.js';
import { aggregateMissionDelivery } from './mission-delivery-aggregator.js';
import { writeBackProjectDeliveryState } from './project-operating-layer.js';
import { recordOperatorRuntimeProjectWriteback } from './operator-runtime-v1.js';

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

const REPAIR_APPROVAL_RECHECK_FIELDS = Object.freeze([
  'provider_changed',
  'cost_ceiling_exceeded',
  'external_write_scope_expanded',
  'production_scope_changed',
  'knowledge_revision_changed'
]);

function repairRequiresApproval(change = {}) {
  return REPAIR_APPROVAL_RECHECK_FIELDS.some((field) => change?.[field] === true);
}

export async function runUnifiedQualityRepairFlow(run = {}, evidence = {}, options = {}) {
  const maxRepairRounds = Math.min(2, Math.max(0, Number(options.max_repair_rounds ?? 2)));
  const maxExecutionAttempts = Math.min(3, Math.max(1, Number(options.max_execution_attempts ?? run.max_attempts ?? 3)));
  let currentRun = clone(run);
  currentRun.max_attempts = Math.min(maxExecutionAttempts, Math.max(1, Number(currentRun.max_attempts || maxExecutionAttempts)));
  let currentEvidence = clone(evidence);
  let repairRounds = Math.max(0, Number(currentEvidence.repair_rounds || 0));
  let qa = evaluateExecutionQA(currentRun, currentEvidence);

  if (qa.ready_for_delivery) {
    return {
      ok: true,
      status: 'QUALITY_PASS',
      run: qa.run,
      evidence: currentEvidence,
      qa,
      repair_rounds: repairRounds,
      max_repair_rounds: maxRepairRounds,
      max_execution_attempts: maxExecutionAttempts,
      user_action_required: false,
      production_deploy: false
    };
  }

  const repairable = currentEvidence.repairable_failure === true || clean(currentEvidence.failure_class, 80).toUpperCase() === 'REPAIRABLE_FAILURE';
  if (!repairable) {
    return {
      ok: false,
      error: 'QUALITY_HUMAN_OR_EXTERNAL_BLOCKER',
      status: 'HUMAN_OR_EXTERNAL_BLOCKER',
      run: qa.run,
      evidence: currentEvidence,
      qa,
      repair_rounds: repairRounds,
      user_action_required: true,
      production_deploy: false
    };
  }

  while (!qa.ready_for_delivery && repairRounds < maxRepairRounds) {
    const change = clone(currentEvidence.repair_change || options.repair_change || {});
    if (repairRequiresApproval(change) && currentEvidence.approval_revalidated !== true && options.approval_revalidated !== true) {
      return {
        ok: false,
        error: 'REPAIR_APPROVAL_REVALIDATION_REQUIRED',
        status: 'WAITING_APPROVAL',
        run: qa.run,
        evidence: currentEvidence,
        qa,
        repair_rounds: repairRounds,
        approval_recheck_fields: REPAIR_APPROVAL_RECHECK_FIELDS.filter((field) => change?.[field] === true),
        user_action_required: true,
        production_deploy: false
      };
    }
    if (typeof options.repair !== 'function') {
      return {
        ok: false,
        error: 'REPAIR_EXECUTOR_REQUIRED',
        status: 'HUMAN_OR_EXTERNAL_BLOCKER',
        run: qa.run,
        evidence: currentEvidence,
        qa,
        repair_rounds: repairRounds,
        user_action_required: true,
        production_deploy: false
      };
    }
    if (Number(currentRun.attempt || 0) >= maxExecutionAttempts) {
      return {
        ok: false,
        error: 'EXECUTION_ATTEMPTS_EXHAUSTED',
        status: 'HUMAN_OR_EXTERNAL_BLOCKER',
        run: qa.run,
        evidence: currentEvidence,
        qa,
        repair_rounds: repairRounds,
        user_action_required: true,
        production_deploy: false
      };
    }

    const repaired = await options.repair({
      run: clone(currentRun),
      evidence: clone(currentEvidence),
      repair_round: repairRounds + 1,
      max_repair_rounds: maxRepairRounds,
      max_execution_attempts: maxExecutionAttempts,
      production_deploy: false
    });
    if (!repaired || repaired.ok !== true) {
      const incident = recordExecutionIncident(currentRun, {
        code: repaired?.error || 'BOUNDED_REPAIR_FAILED',
        message: repaired?.message || null,
        retryable: false
      });
      return {
        ok: false,
        error: repaired?.error || 'BOUNDED_REPAIR_FAILED',
        status: 'HUMAN_OR_EXTERNAL_BLOCKER',
        run: incident.run,
        evidence: currentEvidence,
        repair_rounds: repairRounds,
        user_action_required: true,
        production_deploy: false
      };
    }

    if (repaired.execution_attempted === true) {
      const running = checkpointExecution(currentRun, {
        status: 'RUNNING',
        actor: options.actor || 'operator',
        reason: 'bounded_quality_repair'
      });
      if (!running.ok) return running;
      currentRun = running.run;
    }
    repairRounds += 1;
    currentEvidence = {
      ...currentEvidence,
      ...(repaired.evidence && typeof repaired.evidence === 'object' ? clone(repaired.evidence) : {}),
      repair_rounds: repairRounds,
      failure_class: repaired.failure_class || null,
      repairable_failure: repaired.repairable_failure === true
    };
    qa = evaluateExecutionQA(currentRun, currentEvidence);
  }

  return qa.ready_for_delivery ? {
    ok: true,
    status: 'QUALITY_PASS_AFTER_REPAIR',
    run: qa.run,
    evidence: currentEvidence,
    qa,
    repair_rounds: repairRounds,
    max_repair_rounds: maxRepairRounds,
    max_execution_attempts: maxExecutionAttempts,
    user_action_required: false,
    production_deploy: false
  } : {
    ok: false,
    error: 'BOUNDED_REPAIR_EXHAUSTED',
    status: 'HUMAN_OR_EXTERNAL_BLOCKER',
    run: qa.run,
    evidence: currentEvidence,
    qa,
    repair_rounds: repairRounds,
    user_action_required: true,
    production_deploy: false
  };
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
  const deliveryReport = evidence.delivery_report
    || (evidence.mission ? aggregateMissionDelivery(evidence.mission, {
      activation: evidence.activation || null,
      quality_by_task: evidence.quality_by_task || {},
      customer_review_state: evidence.customer_review?.status || null
    }) : null);
  if (deliveryReport && (!deliveryReport.ok || deliveryReport.structural_completion !== true)) {
    return { ok: false, error: 'MISSION_DELIVERY_AGGREGATION_NOT_READY', delivery_report: deliveryReport, qa, production_deploy: false };
  }
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
  return { ok: true, run: delivered.run, gate, handoff: handoff.handoff, delivery_report: deliveryReport, external_activation_separate: true, production_deploy: false };
}

function deliveryWritebackPayload(project = {}, finalization = {}, evidence = {}) {
  const report = finalization.delivery_report || evidence.delivery_report || null;
  const standardResults = clone(report?.standard_delivery_results || evidence.standard_delivery_results || []);
  const missionId = clean(report?.mission_id || evidence.mission?.mission_id || evidence.mission_id, 180) || null;
  const deliveryId = clean(evidence.delivery_id, 180)
    || (missionId ? `delivery:${missionId}` : `${project.scope_key}:delivery:${clean(finalization.run?.run_id, 180) || 'structural'}`);
  const actualCost = standardResults.reduce((sum, result) => sum + (Number.isFinite(Number(result?.actual_cost_eur)) ? Number(result.actual_cost_eur) : 0), 0);
  const preview = standardResults.find((result) => result?.preview)?.preview || null;
  return {
    schema: 'riosystems.project-delivery-writeback.v1',
    delivery_id: deliveryId,
    mission_id: missionId,
    project: { customer_id: project.customer_id, project_id: project.project_id, scope_key: project.scope_key },
    structural_completion: true,
    external_activation_ready: report?.external_activation_ready === true,
    standard_results: standardResults,
    actual_cost_eur: Number.isFinite(Number(evidence.actual_cost_eur)) ? Number(evidence.actual_cost_eur) : actualCost,
    qa_result: clone(finalization.run?.qa || null),
    customer_review_state: finalization.handoff?.customer_review?.status || evidence.customer_review?.status || null,
    preview,
    evidence_refs: clone(evidence.evidence_refs || []),
    next_action: 'EXTERNAL_ACTIVATION_SEPARATE',
    production_deploy: false
  };
}

export async function finalizeOperationalDeliveryAndWriteback(project = {}, run = {}, evidence = {}, options = {}) {
  const qualityFlow = await runUnifiedQualityRepairFlow(run, evidence, options);
  if (!qualityFlow.ok) return { ...qualityFlow, project: clone(project), production_deploy: false };
  const finalization = finalizeOperationalDelivery(project, qualityFlow.run, {
    ...qualityFlow.evidence,
    ...evidence,
    repair_rounds: qualityFlow.repair_rounds
  });
  if (!finalization.ok) return finalization;

  const payload = deliveryWritebackPayload(project, finalization, evidence);
  const projectWriteback = writeBackProjectDeliveryState(project, payload, { actor: options.actor || evidence.actor || 'operator' });
  if (!projectWriteback.ok) return { ...projectWriteback, finalization, production_deploy: false };

  let runtimeWriteback = null;
  let persistence = null;
  if (options.runtime) {
    const expectedRevision = Number(options.expected_runtime_revision);
    runtimeWriteback = recordOperatorRuntimeProjectWriteback(
      options.runtime,
      projectWriteback.project,
      payload,
      expectedRevision,
      { at: options.at }
    );
    if (!runtimeWriteback.ok) return { ...runtimeWriteback, project: projectWriteback.project, finalization, production_deploy: false };
    if (options.runtime_store && runtimeWriteback.changed === true) {
      if (typeof options.runtime_store.compareAndSwap !== 'function') {
        return { ok: false, error: 'OPERATOR_RUNTIME_CAS_STORE_REQUIRED', project: projectWriteback.project, runtime: runtimeWriteback.runtime, production_deploy: false };
      }
      persistence = await options.runtime_store.compareAndSwap(runtimeWriteback.runtime, expectedRevision);
      if (!persistence.ok) {
        return { ...persistence, error: persistence.error || 'OPERATOR_RUNTIME_CAS_WRITEBACK_FAILED', project: projectWriteback.project, runtime: runtimeWriteback.runtime, production_deploy: false };
      }
    } else if (options.runtime_store && runtimeWriteback.changed !== true) {
      persistence = { ok: true, changed: false, duplicate: true, runtime: clone(runtimeWriteback.runtime) };
    }
  }

  const auditRefs = [
    `project:audit:${Math.max(0, (projectWriteback.project.audit || []).length - 1)}`,
    ...(runtimeWriteback ? [`operator-runtime:audit:${Math.max(0, (runtimeWriteback.runtime.audit || []).length - 1)}`] : [])
  ];
  return {
    ok: true,
    status: 'DELIVERY_WRITTEN_BACK',
    run: finalization.run,
    project: projectWriteback.project,
    runtime: runtimeWriteback?.runtime || null,
    persistence,
    quality: clone(finalization.run.qa),
    repair_rounds: qualityFlow.repair_rounds,
    delivery: payload,
    delivery_ref: projectWriteback.delivery_ref,
    project_revision_before: projectWriteback.project_revision_before,
    project_revision_after: projectWriteback.project_revision_after,
    runtime_revision_before: runtimeWriteback?.runtime_revision_before ?? null,
    runtime_revision_after: runtimeWriteback?.runtime_revision_after ?? null,
    audit_refs: auditRefs,
    handoff: finalization.handoff,
    gate: finalization.gate,
    external_activation_separate: true,
    production_deploy: false
  };
}

export function executionDeliveryOperationsManifest() {
  return {
    version: 'riosystems.phase3.execution-delivery.v1',
    supports: ['execution_runs','checkpoints','bounded_recovery','qa_gate','bounded_quality_repair','customer_review_gate','delivery_handoff','project_state_writeback','operator_runtime_cas_writeback'],
    max_repair_rounds: 2,
    max_execution_attempts: 3,
    approval_recheck_on_security_sensitive_repair: true,
    standard_delivery_result_writeback: true,
    durable_resume_contract: true,
    external_activation_separate: true,
    production_deploy: false
  };
}
