import crypto from "node:crypto";

const clean=(v,max=4000)=>String(v??"").trim().slice(0,max);
const lower=(v)=>clean(v).toLowerCase();
const uniq=(xs)=>[...new Set(xs.filter(Boolean))];
const hash=(v)=>crypto.createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0,24);
const includesAny=(text,words)=>words.some((word)=>text.includes(word));

export const UNIVERSAL_MISSION_RUN_VERSION="1.0";

const CAPABILITIES=Object.freeze({
  growth_gtm:{factory:"growth_gtm",value:"demand_and_positioning",provider:"riosystems-growth-gtm-v1",fallback:null,quality:["gtm_strategy_valid","evidence_states_explicit"],deliverable:"growth_delivery_manifest"},
  web_presence:{factory:"web",value:"conversion_surface",provider:"riosystems-native-web+cloudflare-pages-free",fallback:"riosystems-native-web-local-artifact",quality:["build_valid","responsive_valid","seo_valid","accessibility_valid"],deliverable:"website_delivery_manifest"},
  business_crm:{factory:"business_crm",value:"structured_business_state",provider:"supabase-free",fallback:"synthetic-business-repository",quality:["schema_valid","project_isolated","state_valid"],deliverable:"business_delivery_manifest"},
  automation_followup:{factory:"automation",value:"reliable_process_flow",provider:"make-core",fallback:"activepieces-cloud-free",quality:["graph_valid","idempotency_valid","side_effect_policy_valid"],deliverable:"automation_delivery_manifest"},
  ai_assistance:{factory:"ai",value:"bounded_ai_intelligence",provider:"cloudflare-workers-ai-free",fallback:"deterministic-ai-fixture",quality:["schema_valid","quality_gate_passed","budget_valid"],deliverable:"ai_delivery_manifest"},
  analytics:{factory:"analytics",value:"measurable_outcomes",provider:"posthog-free",fallback:"synthetic-analytics-fixture",quality:["event_contract_valid","pii_policy_valid"],deliverable:"analytics_delivery_manifest"}
});

const DEPENDENCIES=Object.freeze({
  growth_gtm:[],
  business_crm:[],
  web_presence:["growth_gtm"],
  ai_assistance:["business_crm"],
  automation_followup:["business_crm","growth_gtm"],
  analytics:["web_presence","business_crm"]
});

export function compileUniversalMission(input={}){
  const missionText=clean(input.mission_text||input.prompt||input.request);
  if(!missionText) return {ok:false,error:"MISSION_TEXT_REQUIRED"};
  const mission={
    schema:"riosystems.universal-mission.v1",
    mission_id:clean(input.mission_id,160)||`mission-${hash({missionText,project_id:input.project_id,customer_id:input.customer_id})}`,
    customer_id:clean(input.customer_id,160)||null,
    project_id:clean(input.project_id,160)||null,
    business_name:clean(input.business_name,200)||"Unspecified synthetic business",
    industry:clean(input.industry,160)||"unknown",
    country:clean(input.country,80)||"DE",
    language:clean(input.language,40)||"de",
    mission_text:missionText,
    business_goals:Array.isArray(input.business_goals)?input.business_goals.map((v)=>clean(v,300)):[],
    known_constraints:Array.isArray(input.known_constraints)?input.known_constraints.map((v)=>clean(v,300)):[],
    existing_systems:Array.isArray(input.existing_systems)?input.existing_systems.map((v)=>clean(v,160)):[],
    requested_outcomes:Array.isArray(input.requested_outcomes)?input.requested_outcomes.map((v)=>clean(v,300)):[],
    budget_policy:{variable_cost_ceiling_eur:Number(input.budget_policy?.variable_cost_ceiling_eur??0),paid_overflow:false,...input.budget_policy},
    approval_policy:{external_writes_require_approval:true,production_requires_explicit_approval:true,...input.approval_policy},
    data_policy:{synthetic_only:true,real_customer_data:false,...input.data_policy},
    environment:clean(input.environment,40)||"staging",
    production_authorized:input.production_authorized===true,
    assumptions:[]
  };
  const blocking=[];
  if(!mission.customer_id) blocking.push("customer_id");
  if(!mission.project_id) blocking.push("project_id");
  if(mission.environment!=="staging") blocking.push("environment_must_be_staging");
  if(mission.production_authorized) blocking.push("production_not_allowed_in_v1");
  if(mission.budget_policy.variable_cost_ceiling_eur>0) blocking.push("variable_cost_ceiling_must_be_zero");
  if(mission.data_policy.real_customer_data===true||mission.data_policy.synthetic_only===false) blocking.push("synthetic_data_required");
  if(mission.industry==="unknown") mission.assumptions.push({field:"industry",value:"unknown",impact:"planning_only",blocking:false});
  if(!mission.business_goals.length) mission.assumptions.push({field:"business_goals",value:["fulfil_requested_outcomes"],impact:"planning_only",blocking:false});
  return blocking.length?{ok:false,error:"MISSION_PREFLIGHT_BLOCKED",blocking_fields:blocking,mission}:{ok:true,mission};
}

export function analyzeMissionBusiness(mission={}){
  const t=lower(mission.mission_text);
  const problems=[];
  if(includesAny(t,["kundengewinn","kunden gewinnen","leads","nachfrage","wachstum","growth"])) problems.push("customer_acquisition");
  if(includesAny(t,["anfrage","kontakt","crm","nachverfolg","nachfassen","pipeline","vertrieb"])) problems.push("lead_and_customer_state");
  if(includesAny(t,["automatis","workflow","nachverfolg","nachfassen","bearbeitung"])) problems.push("process_reliability");
  if(includesAny(t,["website","webseite","landingpage","online","modernisier","digital"])) problems.push("digital_conversion_surface");
  if(includesAny(t,["ki"," ai ","assistent","chatbot","klassifiz","zusammenfass"])) problems.push("ai_assistance");
  return {industry:mission.industry,market_scope:includesAny(t,["lokal","local","regional"])?"local":"unspecified",problems:uniq(problems),goals:mission.business_goals.length?mission.business_goals:["fulfil_requested_outcomes"],assumptions:[...mission.assumptions],evidence_mode:"mission_text_only"};
}

export function selectMissionCapabilities(mission={},analysis=analyzeMissionBusiness(mission)){
  const t=lower(mission.mission_text);
  const selected=[]; const reason={};
  const add=(id,why)=>{if(!selected.includes(id)){selected.push(id);reason[id]=why;}};
  if(includesAny(t,["kundengewinn","kunden gewinnen","lead","marketing","growth","go-to-market","seo","lokal","local"])) add("growth_gtm","mission_requires_demand_or_acquisition");
  if(includesAny(t,["website","webseite","landingpage","online","modernisier","digital","kundengewinn"])) add("web_presence","mission_requires_digital_conversion_surface");
  if(includesAny(t,["anfrage","crm","lead","kunde","nachverfolg","pipeline","vertrieb"])) add("business_crm","mission_requires_structured_business_state");
  if(includesAny(t,["automatis","workflow","anfragenbearbeitung","bearbeitung","nachverfolg","nachfassen","follow-up","followup"])) add("automation_followup","mission_requires_repeatable_process");
  if(includesAny(t,["ki"," ai ","assistent","chatbot","klassifiz","zusammenfass","qualifizier"])) add("ai_assistance","mission_explicitly_requires_ai");
  if(selected.includes("growth_gtm")||selected.includes("web_presence")) add("analytics","outcomes_require_measurement");
  const rejected=Object.keys(CAPABILITIES).filter((id)=>!selected.includes(id)).map((id)=>({capability:id,reason:id==="ai_assistance"?"no_explicit_ai_value_required":"not_required_by_current_mission"}));
  return {selected:selected.map((id)=>({capability:id,factory:CAPABILITIES[id].factory,business_value:CAPABILITIES[id].value,reason:reason[id]})),rejected};
}

function providerFor(capability,mission){
  const spec=CAPABILITIES[capability];
  const approval_required=capability==="automation_followup"||capability==="business_crm"||capability==="analytics";
  return {primary:spec.provider,fallback:spec.fallback,selection_reason:`zero_cost_staging_policy:${capability}`,estimated_variable_cost_eur:0,paid_fallback_allowed:false,external_write_approval_required:approval_required,execution_mode:"synthetic_staging"};
}

export function buildCapabilityDependencyPlan(mission={},selection=selectMissionCapabilities(mission)){
  const ids=selection.selected.map((x)=>x.capability);
  const tasks=ids.map((id,index)=>({
    task_id:`${mission.project_id}:task:${String(index+1).padStart(2,"0")}:${id}`,
    capability:id,
    factory:CAPABILITIES[id].factory,
    reason:selection.selected.find((x)=>x.capability===id)?.reason,
    dependencies:(DEPENDENCIES[id]||[]).filter((dep)=>ids.includes(dep)),
    provider:providerFor(id,mission),
    quality_criteria:[...CAPABILITIES[id].quality],
    approval_requirements:providerFor(id,mission).external_write_approval_required?["external_write_approval_if_real_dispatch"]:[],
    expected_deliverable:CAPABILITIES[id].deliverable,
    status:"PLANNED"
  }));
  const rank=(id,seen=new Set())=>{if(seen.has(id)) return 0;seen.add(id);return 1+Math.max(0,...(DEPENDENCIES[id]||[]).filter((d)=>ids.includes(d)).map((d)=>rank(d,seen)));};
  tasks.sort((a,b)=>rank(a.capability)-rank(b.capability)||a.capability.localeCompare(b.capability));
  return {schema:"riosystems.capability-dependency-plan.v1",project_id:mission.project_id,selected_capabilities:tasks,rejected_capabilities:selection.rejected,execution_order:tasks.map((t)=>t.task_id),variable_cost_ceiling_eur:0,production_deploy:false};
}

export function missionCostApprovalPreflight(mission={},plan={}){
  const blockers=[];
  if(mission.production_authorized===true) blockers.push("production_authorized_not_allowed");
  if(mission.environment!=="staging") blockers.push("environment_not_staging");
  if(Number(mission.budget_policy?.variable_cost_ceiling_eur??0)!==0) blockers.push("non_zero_variable_budget");
  if(mission.data_policy?.synthetic_only!==true||mission.data_policy?.real_customer_data===true) blockers.push("non_synthetic_data_policy");
  const estimated=(plan.selected_capabilities||[]).reduce((n,t)=>n+Number(t.provider?.estimated_variable_cost_eur||0),0);
  if(estimated>0) blockers.push("estimated_variable_cost_above_zero");
  return {ok:blockers.length===0,status:blockers.length?"BLOCKED":"READY_FOR_SUPERVISED_SYNTHETIC_STAGING",blockers,estimated_variable_cost_eur:estimated,external_writes_authorized:false,production_deploy:false,approval_summary:(plan.selected_capabilities||[]).map((t)=>({task_id:t.task_id,requirements:t.approval_requirements,real_dispatch_authorized:false}))};
}

function syntheticFactoryOutput(task,mission,attempt,provider){
  return {schema:`riosystems.${task.factory}.synthetic-delivery.v1`,project_id:mission.project_id,customer_id:mission.customer_id,mission_id:mission.mission_id,task_id:task.task_id,capability:task.capability,provider,attempt,synthetic:true,external_provider_invoked:false,external_write_performed:false,production_deploy:false,quality_criteria:Object.fromEntries(task.quality_criteria.map((q)=>[q,true]))};
}

export function executeSupervisedSyntheticMission(mission={},plan={},options={}){
  const preflight=missionCostApprovalPreflight(mission,plan); if(!preflight.ok) return {ok:false,error:"MISSION_PREFLIGHT_BLOCKED",preflight};
  const results=[]; const completed=new Set(); const failOnce=clean(options.fail_once_capability,120);
  for(const task of plan.selected_capabilities||[]){
    const unresolved=task.dependencies.filter((d)=>!completed.has(d));
    if(unresolved.length) return {ok:false,error:"DEPENDENCY_NOT_SATISFIED",task_id:task.task_id,dependencies:unresolved,results};
    let attempt=1; let activeProvider=task.provider.primary; const retries=[];
    if(failOnce===task.capability){
      retries.push({attempt:1,provider:activeProvider,status:"SIMULATED_FAILED",retryable:true,reason:"injected_synthetic_failure"});
      if(task.provider.fallback){activeProvider=task.provider.fallback;attempt=2;} else return {ok:false,error:"NO_ZERO_COST_FALLBACK",task_id:task.task_id,results};
    }
    const output=syntheticFactoryOutput(task,mission,attempt,activeProvider);
    results.push({task_id:task.task_id,capability:task.capability,factory:task.factory,status:"COMPLETED",execution_mode:"SIMULATED_SUPERVISED_STAGING",provider:activeProvider,provider_selection_reason:task.provider.selection_reason,retries,output});
    completed.add(task.capability);
  }
  return {ok:true,status:"SYNTHETIC_STAGING_COMPLETED",results,preflight,real_providers_involved:[],simulated_provider_routes:results.map((r)=>r.provider),variable_cost_eur:0,production_deploy:false};
}

export function qualityControlMission(mission={},plan={},execution={}){
  const failures=[];
  if(!execution.ok) failures.push("execution_not_complete");
  if((execution.results||[]).length!==(plan.selected_capabilities||[]).length) failures.push("deliverable_count_mismatch");
  for(const result of execution.results||[]){
    if(result.output?.project_id!==mission.project_id||result.output?.customer_id!==mission.customer_id) failures.push(`scope_mismatch:${result.task_id}`);
    if(result.output?.synthetic!==true||result.output?.external_write_performed!==false||result.output?.production_deploy!==false) failures.push(`safety_violation:${result.task_id}`);
    if(Object.values(result.output?.quality_criteria||{}).some((v)=>v!==true)) failures.push(`quality_failed:${result.task_id}`);
  }
  const score=Math.max(0,100-failures.length*20);
  return {status:failures.length?"BLOCK":"PASS",quality_score:score,failures,checks:{project_isolation:!failures.some((x)=>x.startsWith("scope_mismatch")),synthetic_only:true,zero_variable_cost:execution.variable_cost_eur===0,production_disabled:execution.production_deploy===false}};
}

export function buildUnifiedMissionDelivery(mission={},analysis={},plan={},execution={},quality={}){
  return {schema:"riosystems.unified-mission-delivery.v1",mission_id:mission.mission_id,customer_id:mission.customer_id,project_id:mission.project_id,business_name:mission.business_name,industry:mission.industry,mission:mission.mission_text,business_analysis:analysis,selected_capabilities:plan.selected_capabilities.map((t)=>t.capability),rejected_capabilities:plan.rejected_capabilities,deliverables:(execution.results||[]).map((r)=>({capability:r.capability,factory:r.factory,provider:r.provider,status:r.status,reference:r.output.schema})),quality,assumptions:mission.assumptions,execution_evidence:{mode:"synthetic_staging",real_provider_calls:0,external_writes:0,variable_cost_eur:0},final_delivery_status:quality.status==="PASS"?"SIMULATED_HANDOFF_READY":"BLOCKED",production_deploy:false};
}

export function commandCenterProjection(run={}){
  return {schema:"riosystems.command-center.universal-mission.v1",project:{customer_id:run.mission.customer_id,project_id:run.mission.project_id,business_name:run.mission.business_name},mission:run.mission.mission_text,selected_capabilities:run.plan.selected_capabilities.map((t)=>t.capability),rejected_capabilities:run.plan.rejected_capabilities,factory_status:(run.execution.results||[]).map((r)=>({factory:r.factory,capability:r.capability,status:r.status,provider:r.provider,provider_selection_reason:r.provider_selection_reason,retries:r.retries.length})),dependencies:run.plan.selected_capabilities.map((t)=>({capability:t.capability,depends_on:t.dependencies})),current_stage:run.delivery.final_delivery_status==="SIMULATED_HANDOFF_READY"?"DELIVERY_READY":"BLOCKED",costs:{variable_eur:0,ceiling_eur:0},approvals:run.preflight.approval_summary,quality_score:run.quality.quality_score,retries:(run.execution.results||[]).reduce((n,r)=>n+r.retries.length,0),blocker:run.quality.failures[0]||null,deliverables:run.delivery.deliverables,final_delivery_status:run.delivery.final_delivery_status,technical_details:{environment:run.mission.environment,synthetic_only:true,production_deploy:false}};
}

export function runUniversalMission(input={},options={}){
  const compiled=compileUniversalMission(input); if(!compiled.ok) return compiled;
  const mission=compiled.mission; const analysis=analyzeMissionBusiness(mission); const selection=selectMissionCapabilities(mission,analysis); const plan=buildCapabilityDependencyPlan(mission,selection); const preflight=missionCostApprovalPreflight(mission,plan); if(!preflight.ok) return {ok:false,error:"MISSION_PREFLIGHT_BLOCKED",mission,analysis,plan,preflight};
  const execution=executeSupervisedSyntheticMission(mission,plan,options); const quality=qualityControlMission(mission,plan,execution); const delivery=buildUnifiedMissionDelivery(mission,analysis,plan,execution,quality); const run={ok:execution.ok&&quality.status==="PASS",version:UNIVERSAL_MISSION_RUN_VERSION,mission,analysis,plan,preflight,execution,quality,delivery}; run.command_center=commandCenterProjection(run); return run;
}

export function assertMissionProjectIsolation(a={},b={}){
  const ids=(run)=>new Set([run.mission?.mission_id,run.mission?.customer_id,run.mission?.project_id,...(run.execution?.results||[]).flatMap((r)=>[r.output?.mission_id,r.output?.customer_id,r.output?.project_id,r.output?.task_id])].filter(Boolean));
  const A=ids(a),B=ids(b),overlap=[...A].filter((id)=>B.has(id));
  return {ok:overlap.length===0,status:overlap.length?"ISOLATION_FAILED":"ISOLATED",overlap};
}

export function universalMissionRunManifest() {
  return {
    schema: 'riosystems.universal-mission-run.manifest.v1',
    legacy_classification: 'KEEP',
    runtime_role: 'SYNTHETIC_TEST_HARNESS',
    canonical_runtime_execution_route: false,
    synthetic_only: true,
    real_provider_calls: false,
    provider_selection_is_fixture_only: true,
    legacy_specialist_names_are_not_canonical_factories: true,
    canonical_factories: ['web','automation','ai','business'],
    specialist_domains: ['growth_gtm','business_crm','analytics'],
    production_deploy: false,
    external_writes: false
  };
}
