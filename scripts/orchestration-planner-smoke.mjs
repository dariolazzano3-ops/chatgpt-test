import assert from "node:assert/strict";
import { buildOrchestrationPlan, orchestrationCapabilities } from "../src/orchestration-planner.js";

const caps = orchestrationCapabilities();
assert.equal(caps.version, "3.7");
assert.equal(caps.automatic_execution_enabled, false);
assert.equal(caps.production_deploy, false);

const single = buildOrchestrationPlan({ project: "riosystems", prompt: "Ändere die bestehende Webseite und verbessere den CTA" });
assert.equal(single.ok, true);
assert.equal(single.mode, "single_capability");
assert.equal(single.tasks.length, 1);
assert.equal(single.tasks[0].capability, "web_evolve");
assert.equal(single.tasks[0].execution_state, "READY_FOR_ENGINE");
assert.equal(single.execution.status, "READY");

const compound = buildOrchestrationPlan({ prompt: "Baue eine Website, richte ein CRM ein und automatisiere die Leads" });
assert.equal(compound.ok, true);
assert.equal(compound.mode, "multi_capability");
assert.ok(compound.tasks.some((task) => task.capability === "web_generate"));
assert.ok(compound.tasks.some((task) => task.capability === "business_system_build"));
assert.ok(compound.tasks.some((task) => task.capability === "automation_build"));
assert.equal(compound.execution.status, "PARTIALLY_BLOCKED");
const automation = compound.tasks.find((task) => task.capability === "automation_build");
assert.ok(automation.depends_on.length >= 1);
assert.equal(automation.production_deploy, false);
assert.equal(compound.safeguards.manual_production_approval_required, true);

const app = buildOrchestrationPlan({ prompt: "Baue ein internes Dashboard als App" });
assert.equal(app.tasks[0].capability, "app_build");
assert.equal(app.tasks[0].execution_state, "BLOCKED_CAPABILITY_NOT_IMPLEMENTED");
assert.equal(app.execution.executable_task_ids.length, 0);

console.log("LEAN V3.7 orchestration planner smoke passed");
