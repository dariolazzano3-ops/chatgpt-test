import crypto from 'node:crypto';
import { executeMissionTask } from './mission-execution-router.js';
import { reconcileMissionTaskFromWebJob } from './mission-execution-bridge.js';
const clone = (value) => structuredClone(value);
const terminalMission = (status) => ['COMPLETED','PARTIALLY_BLOCKED','FAILED','CANCELLED','BLOCKED'].includes(String(status));
const terminalWeb = (status) => ['READY_FOR_REVIEW','FAILED','FAIL_SAFE','WORKSHOP_REQUIRED'].includes(String(status || '').toUpperCase());
const stable = (value) => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])) : value;
const fingerprint = (value) => crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
const executionEngine = (task = {}) => ['web','automation','ai','business'].includes(task.domain) ? task.domain : task.engine;
function approvalFor(task, approvals = {}) { const engine = executionEngine(task); return approvals[task.task_id] || approvals[engine] || approvals.default || {}; }
function taskOptions(task, options = {}) {
  const engine = executionEngine(task);
  const specific = options[engine] || {};
  return {
    ...options,
    ...specific,
    [engine]: { ...options, ...specific },
    automation_contract: options.automation_contracts?.[task.task_id] || options.automation_contract,
    business_contract: options.business_contracts?.[task.task_id] || options.business_contract,
    ai_contract: options.ai_contracts?.[task.task_id] || options.ai_contract
  };
}
function attachWebDispatch(mission, taskId, dispatch = {}, request) {
  const next = clone(mission); const task = next.tasks.find((item) => item.task_id === taskId); if (!task) return next;
  task.external_job_id = dispatch.job_id || fingerprint(request);
  task.inputs = { ...(task.inputs || {}), factory_request: request, factory_request_ref: dispatch.request_ref || null, web_dispatch_supervised: true, production_deploy: false };
  next.revision = Number(next.revision || 0) + 1;
  next.updated_at = new Date().toISOString();
  next.events = [...(next.events || []), { type: 'WEB_DISPATCH_ATTACHED', at: next.updated_at, task_id: taskId, external_job_id: task.external_job_id, revision: next.revision }].slice(-200);
  return next;
}
async function persistChecked(persist, mission, metadata, expectedRevision) {
  const result = await persist(clone(mission), { ...metadata, expected_revision: Number(expectedRevision || 0), new_revision: Number(mission.revision || 0), compare_and_swap: true, production_deploy: false });
  if (result && result.ok === false) return { ok: false, error: result.code || result.error || 'MISSION_PERSIST_CONFLICT', persistence: result };
  return { ok: true };
}
export async function superviseMission(missionInput, approvals = {}, options = {}) {
  let mission = clone(missionInput); const events = []; const maxRounds = Math.max(1, Math.min(Number(options.max_rounds) || 20, 100)); const persist = typeof options.persist === 'function' ? options.persist : async () => ({ ok: true }); const dispatchWeb = typeof options.dispatch_web === 'function' ? options.dispatch_web : null; const observeWeb = typeof options.observe_web === 'function' ? options.observe_web : null;
  for (let round = 1; round <= maxRounds; round += 1) {
    if (terminalMission(mission.status)) break; let progressed = false;
    for (const task of mission.tasks.filter((item) => item.state === 'RUNNING' && executionEngine(item) === 'web')) {
      if (!observeWeb || !task.external_job_id) continue;
      const job = await observeWeb({ mission: clone(mission), task: clone(task), job_id: task.external_job_id, round });
      if (!job || !terminalWeb(job.status)) continue;
      const expectedRevision = Number(mission.revision || 0);
      const reconciled = reconcileMissionTaskFromWebJob(mission, task.task_id, job);
      if (!reconciled.ok || reconciled.pending) continue;
      mission = reconciled.mission; events.push({ round, task_id: task.task_id, engine: 'web', action: 'reconcile', status: job.status });
      const persisted = await persistChecked(persist, mission, { reason: 'web_reconciled', task_id: task.task_id, round }, expectedRevision);
      if (!persisted.ok) return { ok: false, mission, mission_id: mission.mission_id, mission_status: mission.status, error: persisted.error, persistence: persisted.persistence, events, production_deploy: false, automatic_multi_factory_execution: false, supervision_required: true };
      progressed = true;
    }
    const ready = mission.tasks.filter((task) => task.state === 'READY');
    for (const taskSnapshot of ready) {
      const task = mission.tasks.find((item) => item.task_id === taskSnapshot.task_id); if (!task || task.state !== 'READY') continue;
      const engine = executionEngine(task); const expectedRevision = Number(mission.revision || 0);
      const result = await executeMissionTask(mission, task.task_id, approvalFor(task, approvals), taskOptions(task, options));
      if (!result.ok) { events.push({ round, task_id: task.task_id, engine, action: 'blocked', error: result.error }); continue; }
      mission = result.mission; progressed = true;
      if (engine === 'web') {
        if (dispatchWeb) {
          const dispatch = await dispatchWeb({ mission: clone(mission), task_id: task.task_id, request: clone(result.factory_request), contract: clone(result.contract), round });
          if (dispatch?.production_deploy === true) throw new Error('PRODUCTION_SIDE_EFFECT_REJECTED');
          mission = attachWebDispatch(mission, task.task_id, dispatch || {}, result.factory_request);
          events.push({ round, task_id: task.task_id, engine, action: 'dispatch', job_id: mission.tasks.find((item) => item.task_id === task.task_id)?.external_job_id || null });
        } else {
          mission = attachWebDispatch(mission, task.task_id, {}, result.factory_request);
          events.push({ round, task_id: task.task_id, engine, action: 'prepared', job_id: mission.tasks.find((item) => item.task_id === task.task_id)?.external_job_id || null });
        }
      } else events.push({ round, task_id: task.task_id, engine, action: 'execute', state: mission.tasks.find((item) => item.task_id === task.task_id)?.state || null });
      const persisted = await persistChecked(persist, mission, { reason: engine === 'web' ? 'web_dispatched' : 'task_executed', task_id: task.task_id, round }, expectedRevision);
      if (!persisted.ok) return { ok: false, mission, mission_id: mission.mission_id, mission_status: mission.status, error: persisted.error, persistence: persisted.persistence, events, production_deploy: false, automatic_multi_factory_execution: false, supervision_required: true };
    }
    if (!progressed) break;
  }
  const pendingWebTasks = mission.tasks.filter((task) => task.state === 'RUNNING' && executionEngine(task) === 'web').map((task) => task.task_id); const blockedReadyTasks = mission.tasks.filter((task) => task.state === 'READY').map((task) => task.task_id);
  return { ok: true, mission, mission_id: mission.mission_id, mission_status: mission.status, completed: mission.status === 'COMPLETED', pending_web_tasks: pendingWebTasks, ready_but_not_executed: blockedReadyTasks, events, production_deploy: false, automatic_multi_factory_execution: false, supervision_required: true };
}
export function missionSupervisorManifest() { return { version: '4.9', engine_revision: 'max-state-cas-1', mode: 'supervised_multi_factory_loop', supported_engines: ['web','automation','ai','business'], durable_persistence_hook: true, compare_and_swap_persistence: true, stale_writer_rejected_by_contract: true, web_dispatch_hook: true, web_observation_hook: true, explicit_adapter_approval_required: true, ai_injected_runner_required: true, automatic_multi_factory_execution: false, production_deploy: false }; }
