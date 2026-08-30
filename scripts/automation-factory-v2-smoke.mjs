import assert from 'node:assert/strict';
import {
  automationFactoryV2Manifest, compileNaturalLanguageAutomation, discoverAutomationOpportunities,
  canonicalGraph, eventContract, mapFields, detectSchemaDrift, dependencyGraph, analyzeBlastRadius,
  reverseEngineerWorkflow, planProviderMigration, providerCapabilityMatrix, routeProvider, planFallbackRoute,
  dryRunAutomation, syntheticWorkflowTest, syntheticExecute, shadowCompare, VersionRegistry, rollbackPlan,
  canaryReleaseContract, classifyFailure, autoRepairPlan, retrySchedule, CircuitBreaker, DeadLetterQueue,
  recoveryInbox, replayPlan, selfHealingDecision, rateLimitDecision, concurrencyDecision, timeoutPolicy,
  sagaContract, approvalNode, evaluatePolicy, credentialRoute, isolationCheck, optimizeAutomation,
  lintAutomation, qualityGate, reliabilityMetrics, slaContract, crossFactoryRequest, recipeCatalog,
  compileRecipe, websiteBusinessReferenceFlow, webhookContract, scheduleContract, processingSemantics,
  deliveryManifestV2, costGovernance
} from '../src/automation-v2/index.js';
import { InMemoryIdempotencyStore } from '../src/automation-v1/idempotency.js';

const manifest=automationFactoryV2Manifest();
assert.equal(manifest.extends,'automation-factory-v1');
assert.equal(manifest.production,false);
assert.ok(manifest.capabilities.includes('provider_migration'));

const compiled=compileNaturalLanguageAutomation({project_id:'bakery-muller',text:'Wenn ein neuer Lead über das Website Formular kommt, validiere ihn, speichere ihn in Supabase, analysiere ihn mit AI, benachrichtige Sales und dokumentiere alles in Analytics.'});
assert.equal(compiled.ok,true); assert.equal(compiled.spec.project_id,'bakery-muller');
assert.equal(compiled.provider_specific_logic,false); assert.ok(compiled.spec.actions.some(x=>x.type==='ai_task'));
assert.equal(compiled.spec.cost_class,'ZERO_DEV');

const discovery=discoverAutomationOpportunities({project_id:'bakery-muller',business_goal:'Wir verlieren Leads, weil niemand schnell genug reagiert.'});
assert.ok(discovery.automation_opportunities.length>=1); assert.equal(discovery.automation_opportunities[0].automatic_activation,false);

const event=eventContract({event_id:'evt-lead-1',event_type:'website.form_submitted',project_id:'bakery-muller',source:'web-factory',payload_schema:{first_name:'string',email:'string'},correlation_id:'corr-1',idempotency_key:'lead-1',sensitivity_class:'synthetic'});
assert.equal(event.ok,true); assert.equal(event.event.correlation_id,'corr-1');
const leadGraphResult=websiteBusinessReferenceFlow('bakery-muller'); assert.equal(leadGraphResult.ok,true); const leadGraph=leadGraphResult.graph;
assert.equal(leadGraph.provider_neutral,true); assert.ok(leadGraph.graph_hash);

const mapping=mapFields({source_fields:[{name:'first_name'},{name:'email'}],target_fields:[{name:'given_name'},{name:'emailAddress'}]});
assert.equal(mapping.mappings[0].target_field,'given_name'); assert.equal(mapping.mappings[0].mapping_type,'semantic_alias');
assert.equal(mapping.mappings[0].manual_review_required,false);
const lowMap=mapFields({source_fields:['mystery'],target_fields:['given_name']}); assert.equal(lowMap.mappings[0].manual_review_required,true);

const drift=detectSchemaDrift({known:{fields:{first_name:'string',email:'string'}},observed:{fields:{given_name:'string',email:'string'}},affected_nodes:['map_lead']});
assert.deepEqual(drift.removed_fields,['first_name']); assert.deepEqual(drift.added_fields,['given_name']); assert.equal(drift.repair_possible,true); assert.equal(drift.manual_review_required,true);

const registry=[
 {automation_id:'web-intake',project_id:'p1',produces:['lead.created'],consumes:['website.form_submitted'],providers:['cloudflare-workers-free'],data_refs:['lead.v1'],previous_known_good_version:1},
 {automation_id:'lead-qualify',project_id:'p1',produces:['lead.updated'],consumes:['lead.created'],providers:['make-core'],data_refs:['lead.v1'],previous_known_good_version:2},
 {automation_id:'sales-notify',project_id:'p1',produces:[],consumes:['lead.updated'],providers:['make-core'],data_refs:['lead.v1'],previous_known_good_version:4}
];
const deps=dependencyGraph(registry); assert.equal(deps.dependencies.length,2);
const blast=analyzeBlastRadius({change:{event_type:'lead.created'},automations:registry}); assert.ok(blast.affected_automations.includes('web-intake')); assert.ok(blast.affected_automations.includes('lead-qualify')); assert.equal(blast.known,true);
assert.equal(analyzeBlastRadius({change:{event_type:'x'},automations:[]}).safe_to_change,false);

const makeFixture={automation_id:'make-lead',trigger:{type:'webhook',credential_ref:'cred-webhook'},steps:[{id:'map',type:'code',mappings:{first_name:'firstName'}},{id:'save',type:'database',operation:'insert',credential_ref:'cred-db'},{id:'notify',type:'email',credential_ref:'cred-mail'}],error_handling:{retry:2}};
const reversed=reverseEngineerWorkflow({provider:'make-core',workflow:makeFixture,project_id:'p1'}); assert.equal(reversed.ok,true); assert.equal(reversed.secrets_extracted,false); assert.ok(reversed.graph.nodes.every(n=>!('credential' in n)));
const migration=planProviderMigration({source_provider:'make-core',target_provider:'n8n-client-owned',workflow:makeFixture,project_id:'p1'}); assert.equal(migration.migration_report.compatibility_status,'COMPATIBLE_FOR_SYNTHETIC_TRANSLATION'); assert.equal(migration.translation.external_write,false);
const partial=planProviderMigration({source_provider:'n8n-client-owned',target_provider:'cloudflare-workers-free',workflow:{trigger:{type:'webhook'},steps:[{type:'database'}]},project_id:'p1'}); assert.equal(partial.migration_report.compatibility_status,'PARTIAL_OR_UNSUPPORTED');

const matrix=providerCapabilityMatrix(); assert.equal(matrix['make-core'].role,'PRIMARY'); assert.equal(matrix['activepieces-cloud-free'].role,'SECONDARY'); assert.equal(matrix['n8n-client-owned'].role,'SPECIALIST');
assert.equal(routeProvider({capabilities:['webhook'],small_code:true}).selected,'cloudflare-workers-free');
assert.equal(routeProvider({capabilities:['webhook','database'],self_hosted:true}).selected,'activepieces-cloud-free');
assert.equal(routeProvider({capabilities:['webhook','database'],customer_environment:'customer_owned'}).selected,'n8n-client-owned');
assert.equal(routeProvider({capabilities:['webhook','database']}).selected,'make-core');
const fallback=planFallbackRoute({from_provider:'make-core',requirements:{capabilities:['webhook','database']},credential_availability:{'activepieces-cloud-free':true},policy_permits:true,cost_gate_permits:true}); assert.equal(fallback.ok,true); assert.equal(fallback.to_provider,'activepieces-cloud-free'); assert.equal(fallback.automatic_switch,false);
assert.equal(planFallbackRoute({from_provider:'make-core',requirements:{capabilities:['database']},credential_availability:{'activepieces-cloud-free':true},policy_permits:false,cost_gate_permits:true}).ok,false);

const dry=dryRunAutomation({graph:leadGraph,input:{first_name:'Ada',email:'ada@example.test'}}); assert.equal(dry.ok,true); assert.equal(dry.real_external_writes,false); assert.ok(dry.planned_side_effects.every(x=>x.external_performed===false));
const store=new InMemoryIdempotencyStore();
const leadTest=await syntheticWorkflowTest({graph:leadGraph,event:event.event,input:{first_name:'Ada',email:'ADA@EXAMPLE.TEST'},idempotency_store:store}); assert.equal(leadTest.ok,true); assert.equal(leadTest.run.real_external_writes,false); assert.equal(leadTest.run.trace.correlation_id,'corr-1');
const duplicate=await syntheticExecute({graph:leadGraph,event:event.event,input:{first_name:'Ada',email:'ADA@EXAMPLE.TEST'},idempotency_store:store}); assert.ok(duplicate.steps.some(x=>x.status==='DUPLICATE_SKIPPED'));
const shadow=await shadowCompare({active_graph:leadGraph,candidate_graph:leadGraph,event:event.event,input:{first_name:'Ada'}}); assert.equal(shadow.compatibility_status,'COMPATIBLE'); assert.equal(shadow.external_side_effects,false);

const versions=new VersionRegistry(); assert.equal(versions.publish({automation_id:'a1',version:1,graph:leadGraph,validation_status:'KNOWN_GOOD',change_reason:'baseline'}).ok,true); assert.equal(versions.publish({automation_id:'a1',version:1,graph:leadGraph}).ok,false); assert.equal(versions.publish({automation_id:'a1',version:2,graph:leadGraph,validation_status:'SYNTHETIC_ONLY',change_reason:'candidate'}).ok,true);
const rb=rollbackPlan({automation_id:'a1',current_version:2,history:versions.list('a1'),reason:'candidate failed'}); assert.equal(rb.ok,true); assert.equal(rb.rollback.previous_known_good_version,1);
assert.equal(rollbackPlan({automation_id:'x',current_version:1,history:[],reason:'none'}).ok,false);
const canary=canaryReleaseContract({automation_id:'a1',current_version:1,next_version:2,percentage:5}); assert.equal(canary.traffic.next,5); assert.equal(canary.activation_allowed,false);

const failure={code:'ETIMEDOUT',api_key:'must-not-leak'}; assert.equal(classifyFailure(failure),'timeout'); const repair=autoRepairPlan(failure); assert.equal(repair.automatic_allowed,true); const retry=retrySchedule(failure,{strategy:'exponential_backoff',max_attempts:3,delay_ms:100}); assert.equal(retry.attempts.length,2); assert.deepEqual(retry.attempts.map(x=>x.delay_ms),[100,200]);
const breaker=new CircuitBreaker({failure_threshold:2}); assert.equal(breaker.recordFailure().state,'CLOSED'); assert.equal(breaker.recordFailure().state,'OPEN'); assert.equal(breaker.allowProbe(),true); assert.equal(breaker.snapshot().state,'HALF_OPEN'); assert.equal(breaker.recordSuccess().state,'CLOSED');
const failedRun=await syntheticExecute({graph:leadGraph,event:event.event,input:{first_name:'Ada'},failures:{ai_qualification:failure}}); assert.equal(failedRun.ok,false); assert.equal(failedRun.event_preserved,true); assert.equal(failedRun.steps.at(-1).error.api_key,'[REDACTED]');
const dlq=new DeadLetterQueue(); dlq.push({event:{...event.event,payload_reference:'secure-ref:evt-lead-1'},automation_id:leadGraph.automation_id,failure_reason:'timeout',retry_count:3,repair_status:'repair_available'}); assert.equal(dlq.list().length,1); assert.equal(dlq.list()[0].payload_duplicated,false); assert.equal(recoveryInbox(dlq.list())[0].state,'repair_available');
const heal=selfHealingDecision(failure); assert.equal(heal.execute_safe_patch,true); const replay=replayPlan({original_event:event.event,original_version:1,target_version:1,replay_reason:'timeout repaired'}); assert.equal(replay.ok,true); const replayRun=await syntheticExecute({graph:leadGraph,event:{...event.event,event_id:'evt-lead-1-replay'},input:{first_name:'Ada'},idempotency_store:new InMemoryIdempotencyStore()}); assert.equal(replayRun.ok,true); dlq.remove('evt-lead-1'); assert.equal(dlq.list().length,0);
assert.equal(autoRepairPlan({code:'AUTHENTICATION_FAILURE'}).automatic_allowed,false);

assert.equal(approvalNode({approval_id:'ap1',project_id:'p1',reason:'production change',state:'waiting'}).approval.state,'waiting');
for(const operation of ['execution','retry','fallback','replay','deployment']) assert.equal(evaluatePolicy({operation,project_id:'p1',context:{production:false,variable_cost_eur:0}}).ok,true);
assert.equal(evaluatePolicy({operation:'execution',project_id:'p1',context:{external_write:true,approved:false}}).ok,false);
assert.equal(evaluatePolicy({operation:'execution',project_id:'p1',context:{source_project_id:'p2'}}).ok,false);
const cred=credentialRoute({credential_ref:'cred-1',project_id:'p1',provider:'make-core',credential_registry:{'cred-1':{project_id:'p1',provider:'make-core',environment:'staging',permission_scope:['read','write:synthetic']}}}); assert.equal(cred.ok,true); assert.equal(cred.credential.secret_value_exposed,false); assert.equal(isolationCheck({request_project_id:'p1',resource_project_id:'p2'}).ok,false);

const lint=lintAutomation(leadGraph); assert.equal(lint.ok,true);
const optGraph=structuredClone(leadGraph); optGraph.nodes.splice(-1,0,{id:'poll',type:'action',config:{poll_interval_ms:1000},idempotency_key:'p',idempotency_required:true,timeout_ms:1000,validation:true,observability:true,project_id:'bakery-muller'}); optGraph.edges=[];
assert.ok(optimizeAutomation(optGraph).optimization_opportunities.some(x=>x.type==='excessive_polling'));
assert.equal(qualityGate({graph:leadGraph,synthetic_test_passed:true,provider_supported:true,policy_compliant:true}).passed,true);

const none=reliabilityMetrics([]); assert.equal(none.data_available,false); assert.equal(none.success_rate,null);
const metrics=reliabilityMetrics([{status:'COMPLETED',duration:10,retry_count:0,completed_at:'t1'},{status:'FAILED',duration:20,retry_count:1,completed_at:'t2',recovery_status:'RECOVERED'}]); assert.equal(metrics.success_rate,.5); assert.equal(metrics.failure_rate,.5); assert.equal(slaContract('CRITICAL').monitoring,'full');
assert.equal(processingSemantics().global_exactly_once_guaranteed,false);

const aiReq=crossFactoryRequest({factory:'ai',project_id:'p1',operation:'lead.qualify',payload:{lead_ref:'synthetic:1'},correlation_id:'corr-x'}); assert.equal(aiReq.ok,true); assert.equal(aiReq.request.domain_logic_owned_by_target,true); assert.equal(crossFactoryRequest({factory:'unknown',project_id:'p1'}).ok,false);

const recipes=recipeCatalog(); for(const name of ['lead_intake','contact_form','booking_followup','support_escalation','review_request','sales_notification','CRM_sync','AI_lead_qualification','customer_onboarding']) assert.ok(recipes[name]);
for(const name of ['lead_intake','booking_followup','support_escalation','CRM_sync','customer_onboarding']){const g=compileRecipe({recipe:name,project_id:`test-${name}`,parameters:{synthetic:true}}); assert.equal(g.ok,true); const e=eventContract({event_id:`evt-${name}`,event_type:'automation.test_event',project_id:`test-${name}`,sensitivity_class:'synthetic'}); const r=await syntheticWorkflowTest({graph:g.graph,event:e.event,input:{synthetic:true}}); assert.equal(r.ok,true,`${name} synthetic E2E must pass`);}

assert.equal(scheduleContract({mode:'cron',expression:'0 8 * * *',timezone:'Europe/Berlin'}).ok,true); assert.equal(scheduleContract({mode:'cron',expression:'0 8 * * *'}).ok,false);
assert.equal(webhookContract({webhook_id:'wh1',project_id:'p1',event_type:'lead.created',auth_mode:'none',signature_validation:false}).ok,false);
const wh=webhookContract({webhook_id:'wh1',project_id:'p1',event_type:'lead.created',auth_mode:'signature',signature_validation:true,secret_ref:'cred:webhook-signature'}); assert.equal(wh.ok,true); assert.equal(wh.webhook.replay_protection,true); assert.equal(wh.webhook.timestamp_validation,true);

assert.equal(rateLimitDecision({current_count:60,limit:60}).action,'queue_delay'); assert.equal(concurrencyDecision({active:2,max_parallel:2}).allowed,false); assert.equal(timeoutPolicy({timeout_ms:999999}).timeout_ms,30000);
const saga=sagaContract({steps:['create_lead','notify'],compensation_steps:['mark_notification_cancelled']}); assert.equal(saga.automatic_destructive_compensation,false);

const cost=costGovernance({estimated_execution_cost:0,estimated_monthly_runs:1000,provider_cost_class:'ZERO_DEV'}); assert.equal(cost.estimated_monthly_cost,0); assert.equal(cost.automatic_paid_overflow,false);
const delivery=deliveryManifestV2({automation_id:leadGraph.automation_id,version:1,goal:'Lead flow',canonical_graph:leadGraph,provider_route:routeProvider({capabilities:['webhook','database']}),provider_artifacts:[{provider:'make-core',mode:'plan_only'}],event_contracts:[event.event],schema_contracts:[event.event.payload_schema],credential_refs:['cred-1'],policies:{production:false},approvals:[],test_results:[leadTest],reliability_class:'IMPORTANT',retry_policy:retry.policy,recovery_policy:{dlq:true},observability:leadTest.run.trace,runtime_cost_class:'ZERO_DEV'});
for(const field of ['automation_id','version','goal','canonical_graph','provider_route','provider_artifacts','event_contracts','schema_contracts','credential_refs','policies','approvals','test_results','reliability_class','retry_policy','recovery_policy','observability','runtime_cost_class','warnings','production_status']) assert.ok(field in delivery);
assert.equal(delivery.production_status,'LOCKED_FALSE'); assert.equal(delivery.cost.estimated_monthly_cost,0);

console.log('automation-factory-v2-smoke: ok');
