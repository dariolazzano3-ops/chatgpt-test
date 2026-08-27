import assert from "node:assert/strict";
import { buildOrchestrationPlan } from "../src/orchestration-planner.js";
import { createMission, transitionMissionTask, buildTaskExecutionContract, resumeMission } from "../src/orchestration-state.js";

const plan = buildOrchestrationPlan({ prompt: "Baue eine Website, richte ein CRM ein und automatisiere die Leads" });
assert.equal(plan.ok, true);
const created = createMission({ plan });
assert.equal(created.ok, true);
assert.match(created.mission_id, /^mission-[a-f0-9]{24}$/);
assert.equal(created.safeguards.production_deploy, false);
assert.equal(created.orchestration_version, "3.8");
assert.ok(created.tasks.length >= 3);

const web = created.tasks.find((task) => task.capability === "web_generate");
assert.ok(web);
assert.equal(web.state, "READY");
const crm = created.tasks.find((task) => task.capability === "business_system_build");
assert.ok(crm);
assert.equal(crm.state, "BLOCKED");
const automation = created.tasks.find((task) => task.capability === "automation_build");
assert.ok(automation);
assert.ok(automation.depends_on.length >= 1);

let current = transitionMissionTask(created, web.task_id, "start", { inputs: { brief: "site" }, external_job_id: "job-web-1" });
assert.equal(current.ok, true);
assert.equal(current.mission.tasks.find((task) => task.task_id === web.task_id).state, "RUNNING");
current = transitionMissionTask(current.mission, web.task_id, "complete", { outputs: { preview_url: "https://preview.example" } });
assert.equal(current.ok, true);
assert.equal(current.mission.tasks.find((task) => task.task_id === web.task_id).state, "COMPLETED");

const contract = buildTaskExecutionContract(current.mission, automation.task_id);
assert.equal(contract.ok, true);
assert.equal(contract.safeguards.production_deploy, false);
assert.equal(contract.dependency_outputs[web.task_id]?.preview_url, "https://preview.example");

const isolated = createMission({ prompt: "Baue eine Website" });
const isolatedTask = isolated.tasks[0];
let interrupted = transitionMissionTask(isolated, isolatedTask.task_id, "start", { external_job_id: "job-interrupted" });
assert.equal(interrupted.ok, true);
const resumed = resumeMission(interrupted.mission);
assert.equal(resumed.ok, true);
assert.equal(resumed.mission.tasks[0].state, "READY");
assert.equal(resumed.mission.tasks[0].last_error.code, "INTERRUPTED_EXECUTION");

console.log("LEAN V3.8 orchestration state smoke passed");
