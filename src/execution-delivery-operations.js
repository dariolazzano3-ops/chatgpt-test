import { runCustomerProjectMission } from './project-control-plane.js';
import { evaluateProjectDelivery, createProjectHandoff } from './project-delivery-gate.js';

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

export function executionDeliveryOperationsManifest() {
  return {
    version: 'riosystems.phase3.execution-delivery.v1',
    supports: ['execution_runs','checkpoints','bounded_recovery','qa_gate','customer_review_gate','delivery_handoff'],
    durable_resume_contract: true,
    external_activation_separate: true,
    production_deploy: false
  };
}
