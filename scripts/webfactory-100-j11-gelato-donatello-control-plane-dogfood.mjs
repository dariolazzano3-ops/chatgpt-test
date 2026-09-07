import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createJ11WebFactoryControlPlane,
  deriveJ11ActionMatrix
} from '../src/web-factory/dashboard-control-plane-v1.js';

const root=new URL('../projects/gelato-donatello-website-v1/',import.meta.url);
const project=JSON.parse(await readFile(new URL('project.json',root),'utf8'));
const dogfood=JSON.parse(await readFile(new URL('project-jaguar-dogfood-v1.json',root),'utf8'));
const reassessment=JSON.parse(await readFile(new URL('premium-reassessment-v1.json',root),'utf8'));
const delivery=JSON.parse(await readFile(new URL('customer-delivery-contract-v1.json',root),'utf8'));
const human=JSON.parse(await readFile(new URL('dashboard-human-input-closure-ux-v1-evidence.json',root),'utf8'));

assert.equal(project.scope_key,'gelato-donatello:gelato-donatello-website-v1');
assert.equal(project.safety.production_deploy,false);
assert.equal(project.safety.public_deploy,false);
assert.equal(project.safety.dns_changes,false);
assert.equal(project.safety.billing,false);
assert.equal(project.safety.external_writes,false);
assert.equal(delivery.cost_preflight.actual_variable_cost_eur,0);
assert.equal(delivery.current_status,'CUSTOMER_INPUT_CLOSURE');
assert.equal(delivery.delivery_definition.public,false);
assert.equal(delivery.delivery_definition.production,false);
assert.equal(human.current_real_gelato_state.human_questions_remaining,7);
assert.equal(human.current_real_gelato_state.full_dogfood,'NOT_YET_PASS');
assert.equal(reassessment.premium_delivery_ready,false);
assert.equal(reassessment.public_launch_ready,false);

const input={
  project:{
    ...project,
    build_profile:dogfood.mission.quality_level,
    current_cost_eur:delivery.cost_preflight.actual_variable_cost_eur
  },
  jaguar_version:'J11',
  source:{
    workspace:{
      knowledge_review:{
        status:'NOT_VERIFIED'
      }
    }
  },
  preview:{
    available:false,
    status:'NOT_AVAILABLE',
    mode:project.preview_policy.mode,
    external_publish:project.preview_policy.external_publish
  },
  delivery:{
    status:delivery.current_status,
    ready:false,
    customer_review_required:delivery.customer_review_required,
    missing_inputs:delivery.missing_inputs,
    human_questions_remaining:human.current_real_gelato_state.human_questions_remaining
  }
};

const cp=createJ11WebFactoryControlPlane(input);
assert.equal(cp.status,'READY');
assert.equal(cp.project_scope,project.scope_key);
assert.equal(cp.project_name,'Gelato Donatello');
assert.equal(cp.field_map.BUILD_PROFILE.value,'PREMIUM');
assert.equal(cp.field_map.JAGUAR_VERSION.value,'J11');
assert.equal(cp.field_map.COST.value,0);
assert.equal(cp.field_map.DELIVERY_STATE.value,'CUSTOMER_INPUT_CLOSURE');
assert.equal(cp.field_map.PREVIEW.value,'NOT_AVAILABLE');

for(const id of [
  'KNOWLEDGE_REVISION',
  'REFERENCE',
  'VISUAL_SCORE',
  'BUILD_QA',
  'PERFORMANCE',
  'ACCESSIBILITY'
]){
  assert.ok(cp.not_verified_fields.includes(id),id+' must remain NOT_VERIFIED');
  assert.equal(cp.field_map[id].status,'NOT_VERIFIED',id+' must not inherit unrelated historical score/evidence');
}

assert.equal(cp.field_map.PERFORMANCE.value,'NOT_VERIFIED');
assert.equal(cp.field_map.ACCESSIBILITY.value,'NOT_VERIFIED');
assert.equal(cp.field_map.VISUAL_SCORE.value,'NOT_VERIFIED');
assert.equal(cp.field_map.REFERENCE.value,'NOT_VERIFIED');
assert.equal(cp.no_fake_pass,true);
assert.equal(cp.missing_evidence_stays_not_verified,true);

const actions=deriveJ11ActionMatrix(input);
const byId=Object.fromEntries(actions.actions.map(x=>[x.id,x]));
assert.equal(byId.SKETCH.state,'AVAILABLE');
assert.equal(byId.CHANGES.state,'AVAILABLE');
assert.equal(byId.REFERENCE.state,'BLOCKED');
assert.equal(byId.VARIANT.state,'BLOCKED');
assert.equal(byId.BUILD.state,'BLOCKED');
assert.equal(byId.VISUAL_QA.state,'BLOCKED');
assert.equal(byId.DELTA_CLOSURE.state,'BLOCKED');
assert.equal(byId.REBUILD.state,'NOT_VERIFIED');
assert.equal(byId.PREVIEW.state,'BLOCKED');
assert.equal(byId.DELIVERY.state,'BLOCKED');

for(const action of actions.actions){
  assert.equal(action.automatic_execution,false,action.id);
  assert.equal(action.production_deploy,false,action.id);
  assert.equal(action.external_writes,false,action.id);
}

assert.equal(cp.technical_drawer.enabled,true);
assert.equal(cp.automatic_action_execution,false);
assert.equal(cp.automatic_merge,false);
assert.equal(cp.production_deploy,false);
assert.equal(cp.public_launch,false);
assert.equal(cp.dns_change,false);
assert.equal(cp.billing_activation,false);
assert.equal(cp.automatic_paid_activation,false);
assert.equal(cp.external_writes,false);
assert.equal(cp.variable_cost_eur,0);

console.log(JSON.stringify({
  ok:true,
  suite:'webfactory-100-j11-gelato-donatello-control-plane-dogfood',
  project_scope:cp.project_scope,
  actual_project_files_used:true,
  build_profile:cp.field_map.BUILD_PROFILE.value,
  jaguar_version:cp.field_map.JAGUAR_VERSION.value,
  cost_eur:cp.field_map.COST.value,
  delivery_state:cp.field_map.DELIVERY_STATE.value,
  human_questions_remaining:human.current_real_gelato_state.human_questions_remaining,
  premium_delivery_ready:reassessment.premium_delivery_ready,
  public_launch_ready:reassessment.public_launch_ready,
  knowledge_revision:cp.field_map.KNOWLEDGE_REVISION.value,
  reference:cp.field_map.REFERENCE.value,
  visual_score:cp.field_map.VISUAL_SCORE.value,
  performance:cp.field_map.PERFORMANCE.value,
  accessibility:cp.field_map.ACCESSIBILITY.value,
  no_fake_pass:'PASS',
  sketch_available:byId.SKETCH.state,
  changes_available:byId.CHANGES.state,
  build_blocked:byId.BUILD.state,
  delivery_blocked:byId.DELIVERY.state,
  automatic_execution:false,
  production_deploy:false,
  public_launch:false,
  dns_change:false,
  billing_activation:false,
  external_writes:false
},null,2));
