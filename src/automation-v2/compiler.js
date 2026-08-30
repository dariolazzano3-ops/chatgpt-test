import { automationSpec } from './contracts.js';
const clean=(v,n=500)=>String(v??'').trim().slice(0,n); const lower=(v)=>clean(v,2000).toLowerCase();

function inferTrigger(text){ if(/jeden|täglich|daily|schedule|cron|alle\s+\d+/.test(text)) return {type:'schedule'}; if(/form|lead|webhook|kommt|eingeh/.test(text)) return {type:'event',event_type:/form/.test(text)?'website.form_submitted':'lead.created'}; return {type:'manual'}; }
function inferActions(text){ const out=[]; if(/validier|prüf/.test(text)) out.push({type:'validation'}); if(/supabase|crm|speicher/.test(text)) out.push({type:'database',operation:'write'}); if(/ai|analys|qualifiz/.test(text)) out.push({type:'ai_task',factory:'ai'}); if(/benachr|notify|sales|intern/.test(text)) out.push({type:'notification',channel:'internal'}); if(/analytics|dokument|track/.test(text)) out.push({type:'action',action:'analytics'}); if(!out.length) out.push({type:'action',action:'business_process'}); return out; }
export function compileNaturalLanguageAutomation({project_id,text}={}){
  const t=lower(text); const result=automationSpec({project_id,goal:clean(text,1200),trigger:inferTrigger(t),conditions:/wenn|falls/.test(t)?[{type:'intent_condition',expression:'derived_from_intent'}]:[],actions:inferActions(t),data_dependencies:[...new Set((t.match(/supabase|crm|website|ai|analytics|sales/g)||[]))],provider_requirements:{provider_neutral:true},approval_requirements:['SAFE_SYNTHETIC_WRITE'],failure_policy:{mode:'fail_closed',dlq:true},retry_policy:{strategy:'bounded_retry',max_attempts:3},validation_rules:['schema_valid','project_isolated','idempotent_writes'],observability_requirements:['trace','node_status','retry','recovery'],cost_class:'ZERO_DEV'});
  return {...result,source:'natural_language',provider_specific_logic:false};
}

const DISCOVERY_RULES=[
  {rx:/lead|anfrag/,problem:'slow_lead_response',automation:'lead_intake + AI qualification + sales notification',effect:'shorter response time',integrations:['website','business','ai','notification'],priority:'HIGH'},
  {rx:/termin|booking|vergess/,problem:'missed_appointments',automation:'booking reminders and follow-up',effect:'fewer missed appointments',integrations:['calendar','notification'],priority:'HIGH'},
  {rx:/rechnung|invoice|nachfass/,problem:'manual_invoice_followup',automation:'scheduled invoice follow-up with approval gate',effect:'less manual follow-up',integrations:['business','notification'],priority:'MEDIUM'},
  {rx:/bewertung|review/,problem:'missing_review_requests',automation:'post-service review request flow',effect:'more review requests',integrations:['business','notification'],priority:'MEDIUM'},
  {rx:/support|ticket|eskal/,problem:'slow_support_escalation',automation:'support triage and escalation',effect:'faster escalation',integrations:['support','ai','notification'],priority:'HIGH'}
];
export function discoverAutomationOpportunities({business_goal='',project_id=''}={}){
  const t=lower(business_goal); const matched=DISCOVERY_RULES.filter(r=>r.rx.test(t)); const rules=matched.length?matched:[{problem:'manual_process_unknown',automation:'instrument process and identify repeatable event/action pairs',effect:'visibility before automation',integrations:['observability'],priority:'LOW'}];
  return {schema:'riosystems.automation-discovery.v2',project_id:clean(project_id,160),automation_opportunities:rules.map((r,i)=>({opportunity_id:`opp-${i+1}`,problem:r.problem,proposed_automation:r.automation,expected_business_effect:r.effect,complexity:r.integrations.length>3?'MEDIUM':'LOW',risk:r.problem.includes('invoice')?'MEDIUM':'LOW',required_integrations:r.integrations,estimated_runtime_cost_class:'UNKNOWN_UNTIL_ROUTED',recommended_priority:r.priority,automatic_activation:false})),production:false};
}
