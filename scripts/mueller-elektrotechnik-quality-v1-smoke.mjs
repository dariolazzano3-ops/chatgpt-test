import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createCommandCenterState, evaluateCommand, applyLocalCommand } from '../src/command-center.js';
import { compileProjectBlueprint } from '../src/project-blueprint.js';
import { evaluatePhase2Readiness } from '../src/phase2-readiness.js';
import { quickMissionCostEstimate, deepMissionCostPreflight, evaluateMissionCostCeiling } from '../src/mission-cost-preflight-v1.js';
import { normalizeBusinessProjectContract } from '../src/business-crm-contract.js';
import { compileAutomationPlan, dryRunAutomation } from '../src/automation-factory.js';

const root = new URL('../projects/mueller-elektrotechnik-digital-customer-system-v1/', import.meta.url);
const readJson = async (name) => JSON.parse(await readFile(new URL(name, root), 'utf8'));
const project = await readJson('project.json');
const customerSystem = await readJson('customer-system.json');
const commercialReview = await readJson('commercial-quality-review.json');
const deliverySummary = await readFile(new URL('delivery-summary.md', root), 'utf8');
const brief = customerSystem.brief;
const systemPlan = customerSystem.system_plan;
const crmInput = customerSystem.crm_contract;
const automationInput = customerSystem.automation_plan;
const analytics = customerSystem.analytics_plan;
const html = await readFile(new URL('index.html', root), 'utf8');

assert.equal(brief.synthetic, true);
assert.equal(brief.customer.real_company, false);
assert.equal(project.real_customer_data, false);
assert.equal(project.production_deploy, false);
assert.equal(project.public_deploy, false);
assert.equal(project.variable_cost_eur, 0);
assert.equal(project.external_customer_writes, 0);
assert.equal(project.state, 'DELIVERED');
assert.equal(project.missions.at(-1)?.status, 'DELIVERED');
assert.equal(project.deliveries.length, 1);
assert.equal(project.deliveries[0].status, 'DELIVERED');
assert.equal(project.deliveries[0].customer_sellable_preview, true);
assert.equal(project.deliveries[0].production_ready, false);
assert.equal(project.deliveries[0].sellability_gate, 'YES');
assert.equal(project.deliveries[0].commercial_quality_score, 8.5);

const phase2 = evaluatePhase2Readiness();
assert.equal(phase2.ready, true, 'existing Phase 2 project architecture must be ready');
const created = createCommandCenterState({ operator_id:'operator:synthetic-quality-run', portfolio:{operator_id:'operator:synthetic-quality-run',projects:[]}, at:'2026-09-02T21:45:00.000Z' });
assert.equal(created.ok, true);
const evaluated = evaluateCommand(created.state, {
  type:'CREATE_PROJECT', command_id:'first-customer-quality-run-v1:create-project',
  customer_id:'synthetic-mueller-elektrotechnik-saarbruecken', project_id:'mueller-elektrotechnik-digital-customer-system-v1',
  business_name:'Müller Elektrotechnik', industry:'Elektrohandwerk', country:'DE', language:'de', mission_context:brief.situation.company_profile,
  allowed_environments:['staging'], data_policy:{synthetic_only:true,real_customer_data:false},
  budget_policy:{variable_cost_ceiling_eur:0,paid_overflow:false}, production_authorized:false, production_deploy:false, created_at:'2026-09-02T21:45:00.000Z'
});
assert.equal(evaluated.ok, true);
assert.equal(evaluated.scope_key, project.scope_key);
assert.equal(evaluated.project.environment, 'staging');
assert.equal(evaluated.project.synthetic, true);
assert.equal(evaluated.project.budget_policy.variable_cost_ceiling_eur, 0);
const applied = applyLocalCommand(created.state, evaluated);
assert.equal(applied.ok, true); assert.equal(applied.state.portfolio.projects.length, 1); assert.equal(applied.external_side_effect_performed, false);

const blueprint = compileProjectBlueprint({ objective:'Moderne Website mit qualifiziertem Lead- und Kontaktflow, CRM-Pipeline, Follow-up Automation und Conversion Analytics für einen lokalen Elektrofachbetrieb.' });
assert.equal(blueprint.ok, true);
const blueprintIds = blueprint.blueprint.capabilities.map((item) => item.id);
for (const required of ['website','crm','lead-flow','analytics']) assert.ok(blueprintIds.includes(required), `blueprint capability ${required} missing`);
assert.equal(blueprint.blueprint.factories.includes('ai'), false, 'business need does not require AI');

const selectedCapabilities = [
  {capability:'web_presence',factory:'web',dependencies:[]},
  {capability:'business_crm',factory:'business',dependencies:['web_presence']},
  {capability:'automation_followup',factory:'automation',dependencies:['business_crm']},
  {capability:'analytics',factory:'automation',dependencies:['web_presence']}
];
const preflightInput = { route:'BALANCED', mission_type:'CUSTOMER_DIGITAL_SYSTEM', mission_text:systemPlan.objective,
  expected_capabilities:selectedCapabilities.map((item)=>item.capability), selected_capabilities:selectedCapabilities,
  requested_outcomes:systemPlan.capabilities.map((item)=>item.outcome), known_constraints:brief.constraints,
  external_dependencies_unknown:false, external_dependencies:[], force_deep_preflight:true };
const quick = quickMissionCostEstimate(preflightInput);
const deep = deepMissionCostPreflight(preflightInput);
assert.equal(quick.selected_route, 'BALANCED'); assert.equal(quick.paid_calls_performed, 0); assert.equal(quick.additional_variable_cost_eur, 0);
assert.equal(deep.mode, 'DEEP_PREFLIGHT'); assert.equal(deep.production_deploy, false); assert.equal(deep.external_writes, false); assert.equal(deep.additional_variable_cost_eur, 0);
assert.ok(deep.low_estimate_eur > 0 && deep.high_estimate_eur >= deep.low_estimate_eur);
const ceiling = evaluateMissionCostCeiling({customer_id:'synthetic-mueller-elektrotechnik-saarbruecken',project_id:'mueller-elektrotechnik-digital-customer-system-v1',mission_id:'mueller-elektrotechnik:first-customer-quality-run-v1',actual_spend_eur:0,projected_final_cost_eur:0,approved_ceiling_eur:0});
assert.equal(ceiling.ok, true); assert.equal(ceiling.status, 'WITHIN_APPROVED_CEILING');

const crm = normalizeBusinessProjectContract(crmInput);
assert.equal(crm.ok, true, crm.error); assert.equal(crm.contract.sales_pipeline.stages.length, 8); assert.equal(crm.contract.safety.synthetic_test_data_only, true); assert.equal(crm.contract.safety.variable_cost_ceiling_eur, 0);
const automation = compileAutomationPlan(automationInput);
assert.equal(automation.ok, true); assert.equal(automation.external_execution_authorized, false);
const automationDryRun = dryRunAutomation(automation);
assert.equal(automationDryRun.ok, true); assert.equal(automationDryRun.status, 'READY_WITH_BLOCKED_EXTERNAL_STEPS'); assert.ok(automationDryRun.trace.some((item)=>item.status==='BLOCKED')); assert.ok(automationDryRun.trace.some((item)=>item.status==='SIMULATED'));
for (const event of ['PAGE_VIEW','PRIMARY_CTA_CLICK','CONTACT_START','CONTACT_SUBMIT','SERVICE_INTEREST']) assert.ok(analytics.events.some((item)=>item.event===event), `analytics event ${event} missing`);
assert.equal(analytics.execution, 'DESIGN_ONLY_NO_EXTERNAL_EVENTS'); assert.equal(analytics.events.every((item)=>item.pii===false), true);
for (const field of ['name','contact','postal_code','project_type']) assert.match(html, new RegExp(`name=["']${field}["']`), `lead field ${field} missing`);
assert.match(html, /meta name="robots" content="noindex,nofollow"/); assert.doesNotMatch(html, /https?:\/\//i, 'customer page must not load or post to external URLs');
assert.doesNotMatch(html, /Meisterbetrieb|5\s*Sterne|★★★★★|über\s+\d+\s+Kunden/i, 'unverified trust claims must not be invented'); assert.match(html, /vollständig synthetisches Testunternehmen/i); assert.match(html, /keine externe Übertragung/i);

assert.equal(commercialReview.sellability.gate, 'YES');
assert.equal(commercialReview.sellability.production_launch_claimed, false);
assert.ok(commercialReview.scores.overall_professionalism >= 8);
assert.equal(commercialReview.top_quality_gaps.length, 3);
assert.equal(commercialReview.provider_review.switch_recommended, false);
assert.equal(commercialReview.provider_review.ai_required, false);
assert.equal(commercialReview.safety.additional_variable_cost_eur, 0);
assert.match(deliverySummary, /Final overall commercial-quality score: \*\*8\.5 \/ 10\*\*/);
assert.match(deliverySummary, /Production OFF/);
assert.match(deliverySummary, /External customer writes 0/);

const summary = {status:'PASS',project:{scope_key:project.scope_key,state:project.state,capabilities:project.capabilities.map((item)=>item.id),delivery_status:project.deliveries[0].status,sellability_gate:commercialReview.sellability.gate,commercial_quality_score:commercialReview.scores.overall_professionalism},architecture:{phase2_ready:phase2.ready,authoritative_create_project:true,external_side_effect_performed:false},preflight:{route:deep.route,estimated_cost_eur:deep.estimated_cost_eur,low_estimate_eur:deep.low_estimate_eur,high_estimate_eur:deep.high_estimate_eur,confidence:deep.confidence,confidence_score:deep.confidence_score,expected_provider_classes:deep.expected_provider_classes,calculation_latency_ms:deep.calculation_latency_ms,paid_calls_performed:0,actual_variable_cost_eur:0},crm:{stages:crm.contract.sales_pipeline.stages.map((item)=>item.key),synthetic_only:true},automation:{dry_run_status:automationDryRun.status,blocked_external_steps:automationDryRun.trace.filter((item)=>item.status==='BLOCKED').map((item)=>item.step_id)},analytics:{mode:analytics.execution,event_count:analytics.events.length},safety:{production_deploy:false,public_deploy:false,real_customer_data:false,real_customer_ai_processing:false,billing:false,paid_provider_calls:0,external_customer_writes:0,additional_variable_cost_eur:0}};
console.log('AURENTARA FIRST CUSTOMER QUALITY RUN V1 contract: PASS'); console.log(JSON.stringify(summary,null,2));
