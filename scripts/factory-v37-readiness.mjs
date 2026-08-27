import assert from "node:assert/strict";
import { buildOrchestrationPlan, orchestrationCapabilities } from "../src/orchestration-planner.js";

const capabilities = orchestrationCapabilities();
assert.equal(capabilities.version, "3.7");
assert.equal(capabilities.automatic_execution_enabled, false);
assert.equal(capabilities.production_deploy, false);
assert.ok(capabilities.features.includes("compound_request_decomposition"));
assert.ok(capabilities.features.includes("dependency_ordering"));

const plan = buildOrchestrationPlan({ prompt: "Baue eine Website, richte ein CRM ein und automatisiere die Leads" });
assert.equal(plan.ok, true);
assert.equal(plan.mode, "multi_capability");
assert.equal(plan.safeguards.unavailable_capabilities_never_executed, true);
assert.equal(plan.safeguards.manual_production_approval_required, true);
assert.equal(plan.safeguards.cross_factory_side_effects_disabled, true);
assert.equal(plan.execution.automatic_execution_enabled, false);
assert.equal(plan.execution.status, "PARTIALLY_BLOCKED");
assert.ok(plan.graph.task_count >= 3);
assert.ok(plan.graph.blocked_count >= 1);
assert.ok(plan.tasks.every((task) => task.production_deploy === false));

console.log("LEAN V3.7 orchestration readiness passed");
