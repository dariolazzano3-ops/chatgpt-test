import assert from "node:assert/strict";
import { capabilityRegistry, routeCapability } from "../src/capability-router.js";

const registry = capabilityRegistry();
assert.equal(registry.version, "3.6");
assert.equal(registry.architecture, "multi_factory_capability_registry");
assert.equal(registry.principles.core_routes_work, true);
assert.equal(registry.principles.domain_engines_remain_modular, true);
assert.equal(registry.principles.unavailable_capabilities_are_never_faked, true);
assert.equal(registry.principles.production_requires_explicit_approval, true);

for (const id of ["web_generate", "web_rebuild", "web_evolve"]) {
  assert.equal(registry.capabilities.find((item) => item.id === id)?.status, "available");
}
for (const id of ["app_build", "automation_build", "ai_system_build", "business_system_build"]) {
  assert.equal(registry.capabilities.find((item) => item.id === id)?.status, "planned");
}

const routed = routeCapability({ project: "riosystems", prompt: "Bearbeite die bestehende Website" });
assert.equal(routed.capability, "web_evolve");
assert.equal(routed.production_deploy, false);
console.log("LEAN V3.6 multi-factory readiness passed");
