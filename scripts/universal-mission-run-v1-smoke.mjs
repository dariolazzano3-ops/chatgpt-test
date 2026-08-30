import assert from "node:assert/strict";
import { runUniversalMission, assertMissionProjectIsolation, compileUniversalMission } from "../src/universal-mission-run.js";

const bakery=runUniversalMission({
  customer_id:"synthetic-customer-bakery",
  project_id:"bakery-muller:universal-regression-v1",
  business_name:"Bäckerei Müller",
  industry:"bakery",
  country:"DE",
  language:"de",
  mission_text:"Modernisiere die Website der lokalen Bäckerei Müller, verbessere Kundengewinnung, erfasse Anfragen strukturiert im CRM und automatisiere die sichere Nachverfolgung.",
  business_goals:["mehr qualifizierte lokale Anfragen","strukturierte Nachverfolgung"],
  requested_outcomes:["Website","Growth Plan","CRM","Follow-up","Analytics"],
  budget_policy:{variable_cost_ceiling_eur:0,paid_overflow:false},
  approval_policy:{external_writes_require_approval:true},
  data_policy:{synthetic_only:true,real_customer_data:false},
  environment:"staging",
  production_authorized:false
});
assert.equal(bakery.ok,true);
assert.equal(bakery.delivery.final_delivery_status,"SIMULATED_HANDOFF_READY");
assert.equal(bakery.quality.status,"PASS");
assert.equal(bakery.command_center.costs.variable_eur,0);
assert.equal(bakery.command_center.technical_details.production_deploy,false);
assert.ok(bakery.plan.selected_capabilities.some((x)=>x.capability==="growth_gtm"));
assert.ok(bakery.plan.selected_capabilities.some((x)=>x.capability==="web_presence"));
assert.ok(bakery.plan.selected_capabilities.some((x)=>x.capability==="business_crm"));
assert.ok(bakery.plan.selected_capabilities.some((x)=>x.capability==="automation_followup"));

const craft=runUniversalMission({
  customer_id:"synthetic-customer-craft",
  project_id:"handwerk-modernisierung:universal-v1",
  business_name:"Muster Handwerksbetrieb",
  industry:"handwerk",
  country:"DE",
  language:"de",
  mission_text:"Modernisiere einen lokalen Handwerksbetrieb und baue ein System für Kundengewinnung, Anfragenbearbeitung und strukturierte Nachverfolgung.",
  known_constraints:["nur synthetische Daten","keine Production"],
  requested_outcomes:["Kundengewinnung","Anfragenbearbeitung","strukturierte Nachverfolgung"],
  budget_policy:{variable_cost_ceiling_eur:0,paid_overflow:false},
  approval_policy:{external_writes_require_approval:true,production_requires_explicit_approval:true},
  data_policy:{synthetic_only:true,real_customer_data:false},
  environment:"staging",
  production_authorized:false
},{fail_once_capability:"automation_followup"});
assert.equal(craft.ok,true);
assert.equal(craft.delivery.final_delivery_status,"SIMULATED_HANDOFF_READY");
assert.equal(craft.execution.status,"SYNTHETIC_STAGING_COMPLETED");
assert.equal(craft.execution.variable_cost_eur,0);
assert.deepEqual(craft.execution.real_providers_involved,[]);
assert.equal(craft.quality.status,"PASS");
assert.equal(craft.command_center.retries,1);
const automation=craft.execution.results.find((x)=>x.capability==="automation_followup");
assert.equal(automation.retries.length,1);
assert.equal(automation.provider,"activepieces-cloud-free");
assert.ok(craft.plan.rejected_capabilities.some((x)=>x.capability==="ai_assistance"));
assert.ok(craft.command_center.factory_status.every((x)=>x.provider_selection_reason));
assert.ok(craft.plan.selected_capabilities.every((x)=>Array.isArray(x.dependencies)));
assert.ok(craft.plan.selected_capabilities.every((x)=>x.provider.estimated_variable_cost_eur===0));
assert.ok(craft.execution.results.every((x)=>x.output.synthetic===true&&x.output.external_write_performed===false));

const isolation=assertMissionProjectIsolation(bakery,craft);
assert.equal(isolation.ok,true);
assert.deepEqual(isolation.overlap,[]);

const blockedProduction=compileUniversalMission({
  customer_id:"synthetic-customer-block",
  project_id:"blocked-production",
  mission_text:"Baue eine Website",
  environment:"production",
  production_authorized:true,
  budget_policy:{variable_cost_ceiling_eur:10},
  data_policy:{synthetic_only:false,real_customer_data:true}
});
assert.equal(blockedProduction.ok,false);
assert.equal(blockedProduction.error,"MISSION_PREFLIGHT_BLOCKED");
assert.ok(blockedProduction.blocking_fields.includes("production_not_allowed_in_v1"));
assert.ok(blockedProduction.blocking_fields.includes("variable_cost_ceiling_must_be_zero"));
assert.ok(blockedProduction.blocking_fields.includes("synthetic_data_required"));

const missingIds=compileUniversalMission({mission_text:"Plane eine lokale Kundengewinnung",environment:"staging"});
assert.equal(missingIds.ok,false);
assert.ok(missingIds.blocking_fields.includes("customer_id"));
assert.ok(missingIds.blocking_fields.includes("project_id"));

console.log(JSON.stringify({
  ok:true,
  suite:"universal-mission-run-v1",
  bakery:{status:bakery.delivery.final_delivery_status,capabilities:bakery.delivery.selected_capabilities,quality:bakery.quality.quality_score},
  handwerk:{status:craft.delivery.final_delivery_status,capabilities:craft.delivery.selected_capabilities,quality:craft.quality.quality_score,retries:craft.command_center.retries},
  isolation:isolation.status,
  safety:{production:false,synthetic_only:true,variable_cost_eur:0,real_provider_calls:0}
},null,2));
