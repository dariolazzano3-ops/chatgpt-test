import assert from "node:assert/strict";
import { capabilityRegistry, routeCapability } from "../src/capability-router.js";

const registry = capabilityRegistry();
assert.equal(registry.version, "3.6");
assert.equal(registry.principles.production_requires_explicit_approval, true);
assert.equal(registry.capabilities.find((item) => item.id === "web_evolve")?.status, "available");
assert.equal(registry.capabilities.find((item) => item.id === "automation_build")?.status, "planned");

const edit = routeCapability({ project: "riosystems", prompt: "Ändere die bestehende Webseite und verbessere den CTA" });
assert.equal(edit.capability, "web_evolve");
assert.equal(edit.engine, "evolve");
assert.equal(edit.production_deploy, false);

const automation = routeCapability({ prompt: "Automatisiere den Lead Workflow und verbinde die API" });
assert.equal(automation.capability, "automation_build");
assert.equal(automation.status, "planned");

const compound = routeCapability({ prompt: "Baue eine Website, richte ein CRM ein und automatisiere die Leads" });
assert.equal(compound.capability, "multi_capability");
assert.ok(compound.required_capabilities.includes("web_generate"));
assert.ok(compound.required_capabilities.includes("business_system_build"));
assert.ok(compound.required_capabilities.includes("automation_build"));
assert.equal(compound.production_deploy, false);

const unknown = routeCapability({ prompt: "Mach etwas besonderes" });
assert.equal(unknown.ok, false);
assert.equal(unknown.error, "CAPABILITY_UNRESOLVED");

console.log("LEAN V3.6 capability routing smoke passed");
