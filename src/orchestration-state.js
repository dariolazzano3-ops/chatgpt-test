import crypto from "node:crypto";
import { buildOrchestrationPlan } from "./orchestration-planner.js";

const TERMINAL = new Set(["COMPLETED", "BLOCKED", "FAILED", "CANCELLED"]);
const clean = (value, max = 4000) => String(value || "").trim().slice(0, max);
const now = () => new Date().toISOString();

function digest(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function taskState(task) {
  if (task.execution_state !== "READY_FOR_ENGINE") return "BLOCKED";
  if (task.depends_on?.length) return "WAITING_DEPENDENCIES";
  return "READY";
}

export function createMission(input = {}) {
  const plan = input.plan?.ok ? input.plan : buildOrchestrationPlan(input);
  if (!plan?.ok) return { ok: false, error: plan?.error || "MISSION_PLAN_REQUIRED", plan };

  const createdAt = now();
  const tasks = plan.tasks.map((task) => ({
    task_id: task.task_id,
    capability: task.capability,
    domain: task.domain,
    engine: task.engine,
    goal: task.goal,
    depends_on: [...(task.depends_on || [])],
    state: taskState(task),
    attempt: 0,
    max_attempts: 3,
    inputs: {},
    outputs: {},
    external_job_id: null,
    started_at: null,
    completed_at: null,
    last_error: null,
    production_deploy: false
  }));

  const missionCore = { orchestration_id: plan.orchestration_id, prompt: plan.prompt, project: plan.project, tasks: tasks.map(({ started_at, completed_at, last_error, ...task }) => task) };
  return {
    ok: true,
    schema_version: 1,
    orchestration_version: "3.8",
    mission_id: `mission-${digest(missionCore).slice(0, 24)}`,
    orchestration_id: plan.orchestration_id,
    prompt: plan.prompt,
    project: plan.project,
    status: tasks.every((task) => task.state === "BLOCKED") ? "BLOCKED" : "READY",
    revision: 1,
    tasks,
    events: [{ type: "MISSION_CREATED", at: createdAt, orchestration_id: plan.orchestration_id }],
    created_at: createdAt,
    updated_at: createdAt,
    safeguards: {
      automatic_multi_factory_execution: false,
      production_deploy: false,
      manual_production_approval_required: true,
      unavailable_capabilities_never_executed: true,
      task_attempts_bounded: true
    }
  };
}

function cloneMission(mission) {
  return JSON.parse(JSON.stringify(mission));
}

function findTask(mission, taskId) {
  return mission.tasks.find((task) => task.task_id === taskId);
}

function depsCompleted(mission, task) {
  return (task.depends_on || []).every((id) => findTask(mission, id)?.state === "COMPLETED");
}

function refreshReadyStates(mission) {
  for (const task of mission.tasks) {
    if (task.state === "WAITING_DEPENDENCIES" && depsCompleted(mission, task)) task.state = "READY";
  }
}

function refreshMissionStatus(mission) {
  const states = mission.tasks.map((task) => task.state);
  if (states.every((state) => state === "COMPLETED" || state === "BLOCKED")) mission.status = states.includes("BLOCKED") ? "PARTIALLY_BLOCKED" : "COMPLETED";
  else if (states.some((state) => state === "FAILED")) mission.status = "FAILED";
  else if (states.some((state) => state === "RUNNING")) mission.status = "RUNNING";
  else mission.status = "READY";
}

export function transitionMissionTask(missionInput, taskId, action, payload = {}) {
  const mission = cloneMission(missionInput || {});
  if (!Array.isArray(mission.tasks)) return { ok: false, error: "INVALID_MISSION" };
  const task = findTask(mission, taskId);
  if (!task) return { ok: false, error: "MISSION_TASK_NOT_FOUND" };
  const at = now();

  if (action === "start") {
    if (task.state !== "READY") return { ok: false, error: "TASK_NOT_READY", state: task.state };
    if (!depsCompleted(mission, task)) return { ok: false, error: "TASK_DEPENDENCIES_INCOMPLETE" };
    if (task.attempt >= task.max_attempts) return { ok: false, error: "TASK_ATTEMPT_LIMIT_REACHED" };
    task.state = "RUNNING";
    task.attempt += 1;
    task.started_at = at;
    task.last_error = null;
    task.inputs = { ...(payload.inputs || {}) };
    task.external_job_id = clean(payload.external_job_id, 200) || null;
  } else if (action === "complete") {
    if (task.state !== "RUNNING") return { ok: false, error: "TASK_NOT_RUNNING", state: task.state };
    task.state = "COMPLETED";
    task.outputs = { ...(payload.outputs || {}) };
    task.completed_at = at;
    task.last_error = null;
  } else if (action === "fail") {
    if (task.state !== "RUNNING") return { ok: false, error: "TASK_NOT_RUNNING", state: task.state };
    task.state = task.attempt < task.max_attempts && payload.retryable === true ? "READY" : "FAILED";
    task.last_error = { code: clean(payload.code, 120) || "TASK_FAILED", message: clean(payload.message, 500) || null, retryable: payload.retryable === true };
  } else if (action === "cancel") {
    if (TERMINAL.has(task.state)) return { ok: false, error: "TASK_ALREADY_TERMINAL" };
    task.state = "CANCELLED";
  } else {
    return { ok: false, error: "UNKNOWN_MISSION_ACTION" };
  }

  refreshReadyStates(mission);
  refreshMissionStatus(mission);
  mission.revision = Number(mission.revision || 0) + 1;
  mission.updated_at = at;
  mission.events = [...(mission.events || []), { type: `TASK_${action.toUpperCase()}`, at, task_id: taskId, state: task.state }].slice(-200);
  mission.safeguards = { ...(mission.safeguards || {}), automatic_multi_factory_execution: false, production_deploy: false, manual_production_approval_required: true };
  return { ok: true, mission };
}

export function buildTaskExecutionContract(mission, taskId) {
  const task = findTask(mission || {}, taskId);
  if (!task) return { ok: false, error: "MISSION_TASK_NOT_FOUND" };
  const dependencyOutputs = {};
  for (const dependencyId of task.depends_on || []) dependencyOutputs[dependencyId] = findTask(mission, dependencyId)?.outputs || {};
  return {
    ok: true,
    contract_version: 1,
    mission_id: mission.mission_id,
    task_id: task.task_id,
    capability: task.capability,
    domain: task.domain,
    engine: task.engine,
    goal: task.goal,
    state: task.state,
    attempt: task.attempt,
    max_attempts: task.max_attempts,
    project: mission.project || null,
    prompt: mission.prompt,
    dependency_outputs: dependencyOutputs,
    required_result: {
      status: ["COMPLETED", "FAILED"],
      outputs_object_required_on_success: true,
      error_object_required_on_failure: true
    },
    safeguards: {
      production_deploy: false,
      manual_production_approval_required: true,
      cross_factory_side_effects_require_explicit_contract: true
    }
  };
}

export function resumeMission(missionInput) {
  const mission = cloneMission(missionInput || {});
  if (!Array.isArray(mission.tasks)) return { ok: false, error: "INVALID_MISSION" };
  for (const task of mission.tasks) {
    if (task.state === "RUNNING") {
      task.state = task.attempt < task.max_attempts ? "READY" : "FAILED";
      task.last_error = { code: "INTERRUPTED_EXECUTION", message: "Recovered from interrupted orchestration state", retryable: task.attempt < task.max_attempts };
    }
  }
  refreshReadyStates(mission);
  refreshMissionStatus(mission);
  const at = now();
  mission.revision = Number(mission.revision || 0) + 1;
  mission.updated_at = at;
  mission.events = [...(mission.events || []), { type: "MISSION_RESUMED", at }].slice(-200);
  return { ok: true, mission };
}
