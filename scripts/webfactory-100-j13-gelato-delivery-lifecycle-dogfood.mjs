import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createJ13DeliveryLifecycle,
  j13DeliveryLifecycleManifest
} from '../src/web-factory/delivery-lifecycle-v1.js';

const root=new URL('../projects/gelato-donatello-website-v1/',import.meta.url);
const project=JSON.parse(await readFile(new URL('project.json',root),'utf8'));
const delivery=JSON.parse(await readFile(new URL('customer-delivery-contract-v1.json',root),'utf8'));
const human=JSON.parse(await readFile(new URL('dashboard-human-input-closure-ux-v1-evidence.json',root),'utf8'));
const reassessment=JSON.parse(await readFile(new URL('premium-reassessment-v1.json',root),'utf8'));

assert.equal(project.scope_key,'gelato-donatello:gelato-donatello-website-v1');
assert.equal(human.current_real_gelato_state.human_questions_remaining,7);
assert.equal(human.current_real_gelato_state.full_dogfood,'NOT_YET_PASS');
assert.equal(reassessment.premium_delivery_ready,false);
assert.equal(reassessment.public_launch_ready,false);

const openInputs=delivery.missing_inputs.map((id)=>({
  id:String(id).toUpperCase(),
  question:id==='current_contact_details'
    ? 'Aktuelle Kontaktdaten bestätigen'
    : 'Offene Kundenangabe: '+id
}));

const projectForJ13={
  customer_id:project.customer_id,
  project_id:project.project_id,
  scope_key:project.scope_key,
  name:project.name,
  capabilities:[{id:'web_presence',required:true}],
  missions:[],
  deliveries:[],
  delivery_contract:delivery
};

const blocked=createJ13DeliveryLifecycle(projectForJ13,{
  pre_delivery_evidence:{
    project:{scope_key:project.scope_key},
    source:{
      workspace:{
        knowledge_review:{status:'NOT_VERIFIED'},
        sections:{project_knowledge:[]}
      },
      human_input_closure:{
        open_input_count:human.current_real_gelato_state.human_questions_remaining,
        open_inputs:openInputs
      }
    },
    preview:{available:false,status:'NOT_AVAILABLE'},
    website_approval:{status:'NOT_VERIFIED'}
  }
});

assert.equal(blocked.ok,false);
assert.equal(blocked.status,'PRE_DELIVERY_BLOCKED');
assert.equal(blocked.error,'J13_J12_DELIVERY_HANDOFF_REQUIRED');
assert.equal(blocked.scope_key,project.scope_key);
assert.equal(blocked.j12_next_best_action.code,'CONFIRM_CONTACT_DETAILS');
assert.equal(blocked.j12_next_best_action.target,'approvals');
assert.match(blocked.j12_next_best_action.label,/Kontaktdaten/i);

assert.equal(blocked.automatic_customer_communication,false);
assert.equal(blocked.automatic_execution,false);
assert.equal(blocked.automatic_merge,false);
assert.equal(blocked.production_deploy,false);
assert.equal(blocked.public_launch,false);
assert.equal(blocked.dns_change,false);
assert.equal(blocked.billing_activation,false);
assert.equal(blocked.automatic_paid_activation,false);
assert.equal(blocked.external_writes,false);
assert.equal(blocked.variable_cost_eur,0);

assert.equal(reassessment.premium_delivery_ready,false);
assert.equal(reassessment.public_launch_ready,false);
assert.equal(human.current_real_gelato_state.full_dogfood,'NOT_YET_PASS');

const manifest=j13DeliveryLifecycleManifest();
assert.equal(manifest.j12_entry_gate_required,'READY_FOR_DELIVERY_LIFECYCLE');
assert.equal(manifest.external_activation_separate,true);
assert.equal(manifest.automatic_customer_communication,false);

console.log(JSON.stringify({
  ok:true,
  suite:'webfactory-100-j13-gelato-delivery-lifecycle-dogfood',
  project_scope:project.scope_key,
  real_repository_evidence:true,
  j13_status:blocked.status,
  blocked_by_j12_action:blocked.j12_next_best_action.code,
  human_questions_remaining:human.current_real_gelato_state.human_questions_remaining,
  premium_delivery_ready:reassessment.premium_delivery_ready,
  public_launch_ready:reassessment.public_launch_ready,
  full_dogfood:human.current_real_gelato_state.full_dogfood,
  customer_review_started:false,
  handoff_created:false,
  delivery_package_created:false,
  no_fake_pass:'PASS',
  automatic_customer_communication:false,
  automatic_execution:false,
  production_deploy:false,
  public_launch:false,
  dns_change:false,
  billing_activation:false,
  external_writes:false
},null,2));
