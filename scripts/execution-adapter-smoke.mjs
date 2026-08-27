import assert from "node:assert/strict";
import { buildOrchestrationPlan } from "../src/orchestration-planner.js";
import { createMission } from "../src/orchestration-state.js";
import { listExecutionAdapters } from "../src/execution-adapters.js";
import { prepareMissionTaskDispatch, reconcileMissionTaskResult, webFactoryJobToAdapterResult } from "../src/mission-execution-bridge.js";

const adapters = listExecutionAdapters();
assert.equal(adapters.find((item) => item.engine === "web")?.available, true);
assert.equal(adapters.find((item) => item.engine === "ai")?.available, false);
assert.ok(adapters.every((item) => item.automatic_execution === false));
assert.ok(adapters.every((item) => item.production_deploy === false));

const plan = buildOrchestrationPlan({ prompt: "Ändere die bestehende Website und verbessere den CTA", project: "multiproject-alpha" });
assert.equal(plan.ok, true);
const mission = createMission({ plan });
assert.equal(mission.ok, true);
const task = mission.tasks.find((item) => item.state === "READY");
assert.ok(task);

const denied = prepareMissionTaskDispatch(mission, task.task_id, { authorized: false });
assert.equal(denied.ok, false);
assert.equal(denied.error, "ADAPTER_DISPATCH_APPROVAL_REQUIRED");

const prepared = prepareMissionTaskDispatch(mission, task.task_id, { authorized: true, production_deploy: false });
assert.equal(prepared.ok, true);
assert.equal(prepared.factory_request.mode, "edit");
assert.equal(prepared.factory_request.target_project_slug, "multiproject-alpha");
assert.equal(prepared.factory_request.production_deploy, false);
assert.equal(prepared.dispatch.automatic_dispatch, false);
assert.equal(prepared.mission.tasks.find((item) => item.task_id === task.task_id)?.state, "RUNNING");

const pending = webFactoryJobToAdapterResult({ status: "QA_RUNNING", job_id: "job-1" });
assert.equal(pending.status, "PENDING");

const factoryResult = webFactoryJobToAdapterResult({
  status: "READY_FOR_REVIEW",
  job_id: "job-1",
  project_slug: "multiproject-alpha",
  revision: 9,
  commit_sha: "abc123",
  preview_url: "https://preview.example.invalid",
  qa_status: "passed",
  qa_attempt: 1,
  production_deploy: false
});
assert.equal(factoryResult.status, "COMPLETED");

const reconciled = reconcileMissionTaskResult(prepared.mission, task.task_id, prepared.envelope, factoryResult);
assert.equal(reconciled.ok, true);
assert.equal(reconciled.mission.tasks.find((item) => item.task_id === task.task_id)?.state, "COMPLETED");
assert.equal(reconciled.mission.tasks.find((item) => item.task_id === task.task_id)?.outputs.preview_url, "https://preview.example.invalid");
assert.equal(reconciled.mission.safeguards.production_deploy, false);

const rejectedProduction = reconcileMissionTaskResult(prepared.mission, task.task_id, prepared.envelope, {
  status: "COMPLETED",
  outputs: {},
  production_deploy: true
});
assert.equal(rejectedProduction.ok, false);
assert.equal(rejectedProduction.error, "PRODUCTION_SIDE_EFFECT_REJECTED");

console.log("LEAN V3.9 execution adapter smoke passed");
