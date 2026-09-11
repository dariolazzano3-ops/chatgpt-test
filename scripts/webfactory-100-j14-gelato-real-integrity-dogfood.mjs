import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { evaluateJ14RealProjectIntegrity } from '../src/web-factory/full-dogfood-closure-v1.js';
import { deriveJ12NextBestAction } from '../src/web-factory/next-best-action-v1.js';
import { createJ13DeliveryLifecycle } from '../src/web-factory/delivery-lifecycle-v1.js';

const root=new URL('../projects/gelato-donatello-website-v1/',import.meta.url);
const project=JSON.parse(await readFile(new URL('project.json',root),'utf8'));
const delivery=JSON.parse(await readFile(new URL('customer-delivery-contract-v1.json',root),'utf8'));
const human=JSON.parse(await readFile(new URL('dashboard-human-input-closure-ux-v1-evidence.json',root),'utf8'));
const reassessment=JSON.parse(await readFile(new URL('premium-reassessment-v1.json',root),'utf8'));

assert.equal(project.scope_key,'gelato-donatello:gelato-donatello-website-v1');
assert.equal(delivery.current_status,'CUSTOMER_INPUT_CLOSURE');
assert.ok(delivery.missing_inputs.length>0);
assert.equal(human.current_real_gelato_state.human_questions_remaining,7);
assert.equal(human.current_real_gelato_state.full_dogfood,'NOT_YET_PASS');
assert.equal(reassessment.premium_delivery_ready,false);
assert.equal(reassessment.public_launch_ready,false);

const openInputs=delivery.missing_inputs.map((id)=>({
  id:String(id).toUpperCase(),
  question:id==='current_contact_details'?'Aktuelle Kontaktdaten bestätigen':'Offene Kundenangabe: '+id
}));

const j12=deriveJ12NextBestAction({
  project:{scope_key:project.scope_key,name:project.name},
  source:{
    workspace:{knowledge_review:{status:'NOT_VERIFIED'},sections:{project_knowledge:[]}},
    human_input_closure:{
      open_input_count:human.current_real_gelato_state.human_questions_remaining,
      open_inputs:openInputs
    }
  },
  preview:{available:false,status:'NOT_AVAILABLE'},
  website_approval:{status:'NOT_VERIFIED'}
});
assert.equal(j12.status,'READY');
assert.equal(j12.primary_action.code,'CONFIRM_CONTACT_DETAILS');
assert.notEqual(j12.primary_action.code,'READY_FOR_DELIVERY_LIFECYCLE');

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
const j13=createJ13DeliveryLifecycle(projectForJ13,{
  pre_delivery_evidence:{
    project:{scope_key:project.scope_key},
    source:{
      workspace:{knowledge_review:{status:'NOT_VERIFIED'},sections:{project_knowledge:[]}},
      human_input_closure:{open_input_count:human.current_real_gelato_state.human_questions_remaining,open_inputs:openInputs}
    },
    preview:{available:false,status:'NOT_AVAILABLE'},
    website_approval:{status:'NOT_VERIFIED'}
  }
});
assert.equal(j13.ok,false);
assert.equal(j13.status,'PRE_DELIVERY_BLOCKED');
assert.equal(j13.error,'J13_J12_DELIVERY_HANDOFF_REQUIRED');

const blockers=[...delivery.missing_inputs,'final_human_quality_approval'];
const integrity=evaluateJ14RealProjectIntegrity({
  project_scope:project.scope_key,
  project_kind:'REAL',
  blockers,
  expected_blocked:true,
  claimed_ready:false,
  mutated:false,
  safety:{
    automatic_execution:false,
    automatic_merge:false,
    production_deploy:project.safety.production_deploy,
    public_launch:project.safety.public_deploy,
    dns_change:project.safety.dns_changes,
    billing_activation:project.safety.billing,
    automatic_paid_activation:false,
    external_writes:project.safety.external_writes
  },
  evidence:{
    delivery_status:delivery.current_status,
    human_questions_remaining:human.current_real_gelato_state.human_questions_remaining,
    full_dogfood:human.current_real_gelato_state.full_dogfood,
    premium_delivery_ready:reassessment.premium_delivery_ready,
    public_launch_ready:reassessment.public_launch_ready,
    j12_action:j12.primary_action.code,
    j13_status:j13.status
  }
});

assert.equal(integrity.status,'PASS');
assert.equal(integrity.project_kind,'REAL');
assert.equal(integrity.expected_blocked,true);
assert.equal(integrity.claimed_ready,false);
assert.equal(integrity.mutated,false);
assert.equal(integrity.fake_pass_detected,false);
assert.ok(integrity.blockers.length>=7);
assert.deepEqual(integrity.unsafe_flags,[]);

console.log(JSON.stringify({
  ok:true,
  suite:'webfactory-100-j14-gelato-real-integrity-dogfood',
  project_scope:project.scope_key,
  project_kind:'REAL',
  real_repository_evidence:true,
  j12_action:j12.primary_action.code,
  j13_status:j13.status,
  blocker_count:integrity.blockers.length,
  human_questions_remaining:human.current_real_gelato_state.human_questions_remaining,
  full_dogfood:human.current_real_gelato_state.full_dogfood,
  premium_delivery_ready:reassessment.premium_delivery_ready,
  public_launch_ready:reassessment.public_launch_ready,
  claimed_ready:false,
  fake_pass_detected:false,
  integrity_status:integrity.status,
  mutated:false,
  production_deploy:false,
  public_launch:false,
  dns_change:false,
  billing_activation:false,
  external_writes:false
},null,2));
