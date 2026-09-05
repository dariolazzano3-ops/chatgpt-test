import assert from 'node:assert/strict';
import { createOperatorRuntime } from '../src/operator-runtime-v1.js';
import { createMemoryOperatorRuntimeStore } from '../src/operator-runtime-store-v1.js';
import { createOperatorRuntimeApiService } from '../src/operator-runtime-api-v1.js';
import { withProjectSourceIntakeRuntimeService } from '../src/operator-project-source-intake-runtime-v1.js';
import { registerProjectSource, registerProjectAsset, upsertProjectFact } from '../src/project-source-intake-v1.js';
import { handleOperatorDashboard, dashboardHumanInputClosureManifest } from '../src/operator-dashboard-human-input-closure-v1.js';

const operatorId='operator:ferrari-human-input@example.test';
const scope='gelato-donatello:gelato-donatello-website-v1';
const project={customer_id:'gelato-donatello',project_id:'gelato-donatello-website-v1',scope_key:scope,name:'Gelato Donatello',industry:'gelateria',country:'DE',language:'de',state:'ACTIVE',blocked:false,production_deploy:false};
const created=createOperatorRuntime({operator_id:operatorId,portfolio:{operator_id:operatorId,projects:[project],production_deploy:false},at:'2026-09-05T02:00:00.000Z'});
assert.equal(created.ok,true);
const store=createMemoryOperatorRuntimeStore([created.runtime]);
const core=createOperatorRuntimeApiService({operator_id:operatorId,store});
const service=withProjectSourceIntakeRuntimeService({service:core,store,operator_id:operatorId});
const authorize=async()=>({ok:true,status:200,operator_id:operatorId,email:'ferrari-human-input@example.test'});
const options={runtime_service:service,authorize};

let read=await service.getProjectSourceIntake({scope_key:scope},{at:'2026-09-05T02:01:00.000Z'});
assert.equal(read.ok,true);
let state=read.body.state;
let source=registerProjectSource(state,{
  source_id:'gelato-owned-website',
  source_type:'OWNED_WEBSITE',
  source_role:'PROJECT_SOURCE',
  locator:'https://gelato-donatello.de/',
  display_name:'Gelato existing website',
  ownership_status:'OWNED_CONFIRMED',
  website_usage:{content:true,structure_reference:true,design_reference:true}
},{at:'2026-09-05T02:01:10.000Z'});
assert.equal(source.ok,true);
state=source.state;
for(let i=1;i<=5;i++){
  const asset=registerProjectAsset(state,{
    asset_id:`gelato-asset-${i}`,
    source_id:'gelato-owned-website',
    storage_ref:`private://gelato/asset-${i}.jpg`,
    mime_type:'image/jpeg',
    usage_role:i===1?'HERO':'GALLERY',
    rights_status:'OWNED_CONFIRMED'
  },{at:`2026-09-05T02:01:${10+i}.000Z`});
  assert.equal(asset.ok,true);
  state=asset.state;
}
const rejectedFlavor=upsertProjectFact(state,{
  fact_id:'rejected-live-flavor-45',
  field_path:'products.flavor_count',
  value:'über 45 verschiedene Eissorten',
  origin:'EXTRACTED',
  verification_status:'REJECTED',
  source_refs:['gelato-owned-website']
},{at:'2026-09-05T02:01:30.000Z'});
assert.equal(rejectedFlavor.ok,true);
state=rejectedFlavor.state;
let saved=await service.saveProjectSourceIntake({state,expected_revision:read.body.runtime_revision,event:'SYNTHETIC_FERRARI_HUMAN_INPUT_FIXTURE_READY'});
assert.equal(saved.ok,true);

async function getPayload(){
  const response=await handleOperatorDashboard(new Request('https://operator.example.test/operator/api/project-source-intake?scope_key='+encodeURIComponent(scope)),{}, {},options);
  assert.equal(response.status,200);
  return response.json();
}
async function decide(question_id,controls,extra={}){
  const response=await handleOperatorDashboard(new Request('https://operator.example.test/operator/api/project-source-intake/human-decision',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({scope_key:scope,context_scope_key:scope,question_id,controls,interaction_started_at:'2026-09-05T02:02:00.000Z',...extra})
  }),{}, {},options);
  const body=await response.json();
  return {response,body};
}

const initial=await getPayload();
assert.equal(initial.human_input_closure.open_input_count,7);
assert.equal(initial.workspace.sections.open_inputs.length,7);
assert.equal(initial.workspace.sections.open_inputs.some((q)=>q.id==='CONTACT_DETAILS'),true);
assert.equal(initial.workspace.sections.open_inputs.some((q)=>q.id==='BUSINESS_MODEL'),false);
assert.equal(initial.workspace.sections.open_inputs.find((q)=>q.id==='CONTACT_DETAILS').controls[0].candidates.length,2);
assert.equal(initial.workspace.sections.open_inputs.find((q)=>q.id==='TARGET_CUSTOMERS').controls[0].candidates.length,4);

const cross=await handleOperatorDashboard(new Request('https://operator.example.test/operator/api/project-source-intake/human-decision',{
  method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({scope_key:scope,context_scope_key:'other:project',question_id:'OPENING_HOURS',controls:{opening_hours:{confirmed:true}}})
}),{}, {},options);
assert.equal(cross.status,409);

let result=await decide('CONTACT_DETAILS',{
  phone:{values:['06806 9394980']},
  address:{value:'Hauptstraße 4, 66346 Köllerbach'},
  email:{confirmed:true}
});
assert.equal(result.response.status,200);
assert.equal(result.body.human_input_closure.open_input_count,6);

read=await service.getProjectSourceIntake({scope_key:scope});
state=read.body.state;
const phoneConfirmed=state.facts.find((f)=>f.field_path==='business.phone'&&f.value==='06806 9394980');
const phoneRejected=state.facts.find((f)=>f.field_path==='business.phone'&&f.value==='+49 176 200 150 65');
const addressConfirmed=state.facts.find((f)=>f.field_path==='business.address'&&f.value==='Hauptstraße 4, 66346 Köllerbach');
const addressRejected=state.facts.find((f)=>f.field_path==='business.address'&&f.value==='Hauptstraße 4, 66346 Püttlingen');
assert.equal(phoneConfirmed.verification_status,'OPERATOR_CONFIRMED');
assert.equal(phoneRejected.verification_status,'REJECTED');
assert.equal(addressConfirmed.verification_status,'OPERATOR_CONFIRMED');
assert.equal(addressRejected.verification_status,'REJECTED');
assert.equal(state.facts.find((f)=>f.fact_id==='rejected-live-flavor-45').verification_status,'REJECTED');
assert.equal(state.facts.some((f)=>f.field_path==='business.name'&&f.verification_status==='OPERATOR_CONFIRMED'),true);

result=await decide('OPENING_HOURS',{opening_hours:{confirmed:true}});
assert.equal(result.response.status,200);
assert.equal(result.body.human_input_closure.open_input_count,5);

result=await decide('LEGAL_CURRENTNESS',{
  entity:{confirmed:true},
  responsible_person:{confirmed:true},
  vat_id:{confirmed:true},
  privacy_basis:{confirmed:true}
});
assert.equal(result.response.status,200);
assert.equal(result.body.human_input_closure.open_input_count,4);

result=await decide('TARGET_CUSTOMERS',{target_customers:{values:['lokale Laufkundschaft und Eisgäste','Familien']}});
assert.equal(result.response.status,200);
assert.equal(result.body.human_input_closure.open_input_count,3);

result=await decide('PRIMARY_CONVERSION',{primary_conversion:{value:'Vor-Ort-Besuch'}});
assert.equal(result.response.status,200);
assert.equal(result.body.human_input_closure.open_input_count,2);

result=await decide('FINAL_ASSET_QUALITY_APPROVAL',{asset_quality:{approved:true}});
assert.equal(result.response.status,200);
assert.equal(result.body.human_input_closure.open_input_count,1);
read=await service.getProjectSourceIntake({scope_key:scope});
assert.equal(read.body.state.assets.every((asset)=>asset.quality_state==='VERIFIED'),true);
assert.equal(result.body.human_input_closure.readiness.build_readiness.ready_for_build,true);

const noPreview=await decide('FINAL_HUMAN_QUALITY_APPROVAL',{human_quality:{approved:true,preview_seen:false}});
assert.equal(noPreview.response.status,400);
assert.equal(noPreview.body.error,'HUMAN_QUALITY_APPROVAL_PREVIEW_VIEW_REQUIRED');
let beforeFinal=await getPayload();
assert.equal(beforeFinal.human_input_closure.open_input_count,1);

result=await decide('FINAL_HUMAN_QUALITY_APPROVAL',{human_quality:{approved:true,preview_seen:true}});
assert.equal(result.response.status,200);
assert.equal(result.body.human_input_closure.open_input_count,0);
assert.equal(result.body.human_input_closure.resolved_input_count,7);
assert.equal(result.body.human_input_closure.readiness.human_quality_approval.approved,true);
assert.equal(result.body.human_input_closure.ai_auto_confirmation,false);
assert.equal(result.body.human_input_closure.project_scoped,true);

read=await service.getProjectSourceIntake({scope_key:scope});
state=read.body.state;
assert.equal(state.human_decisions.length,7);
for(const row of state.human_decisions){
  assert.equal(row.scope_key,scope);
  assert.equal(row.project_id,'gelato-donatello-website-v1');
  assert.equal(row.actor_type,'HUMAN_OPERATOR');
  assert.ok(row.decided_at);
  assert.ok(row.resulting_state_transition);
}
assert.equal(state.facts.find((f)=>f.fact_id==='rejected-live-flavor-45').verification_status,'REJECTED');
assert.equal(state.customer_delivery_contract_readiness.ready_for_build,true);
assert.notEqual(state.readiness_snapshots.at(-1)?.status,'BLOCKED');
assert.equal(state.human_input_readiness.build_readiness.ready_for_build,true);
assert.equal(result.body.human_input_closure.efficiency.questions_originally_possible,8);
assert.equal(result.body.human_input_closure.efficiency.automatically_resolved,1);
assert.equal(result.body.human_input_closure.efficiency.questions_shown_to_operator,7);
assert.equal(result.body.human_input_closure.efficiency.operator_touches,7);
assert.ok(result.body.human_input_closure.efficiency.duplicate_input_avoided>=7);
assert.ok(result.body.human_input_closure.efficiency.copy_paste_avoided>=6);

const manifest=dashboardHumanInputClosureManifest();
assert.equal(manifest.existing_masterdashboard_extended,true);
assert.equal(manifest.existing_fact_engine_reused,true);
assert.equal(manifest.existing_readiness_reused,true);
assert.equal(manifest.cross_project_mutation_blocked,true);
assert.equal(manifest.ai_auto_confirmation,false);
assert.equal(manifest.production_deploy,false);
assert.equal(manifest.public_launch,false);
assert.equal(manifest.paid_overflow,false);
assert.equal(manifest.paid_provider_calls,0);

console.log(JSON.stringify({
  ok:true,
  suite:'project-ferrari-dashboard-human-input-closure-v1',
  synthetic_fixture_only:true,
  real_gelato_decisions_mutated:false,
  exact_open_questions:7,
  automatically_resolved_not_asked:true,
  candidates_from_existing_evidence:true,
  project_fact_update:'PASS',
  conflict_resolution:'PASS',
  rejected_candidate_preservation:'PASS',
  readiness_recalculation:'PASS',
  open_input_count:'PASS',
  cross_project_mutation:'BLOCKED',
  final_human_approval_requires_preview:true,
  efficiency:result.body.human_input_closure.efficiency,
  production_deploy:false,
  public_launch:false,
  dns_changed:false,
  billing_changed:false,
  paid_provider_calls:0,
  variable_cost_eur:0
},null,2));
