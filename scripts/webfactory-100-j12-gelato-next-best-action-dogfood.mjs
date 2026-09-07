import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { deriveJ12NextBestAction } from '../src/web-factory/next-best-action-v1.js';

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

const result=deriveJ12NextBestAction({
  project:{
    scope_key:project.scope_key,
    name:project.name
  },
  source:{
    workspace:{
      knowledge_review:{
        status:'NOT_VERIFIED'
      },
      sections:{
        project_knowledge:[]
      }
    },
    human_input_closure:{
      open_input_count:human.current_real_gelato_state.human_questions_remaining,
      open_inputs:openInputs
    }
  },
  preview:{
    available:false,
    status:'NOT_AVAILABLE'
  },
  website_approval:{
    status:'NOT_VERIFIED'
  }
});

assert.equal(result.status,'READY');
assert.equal(result.project_scope,project.scope_key);
assert.equal(result.exactly_one_primary_action,true);
assert.equal(result.primary_button_count,1);
assert.equal(result.button_wall_forbidden,true);
assert.equal(result.primary_action.code,'CONFIRM_CONTACT_DETAILS');
assert.equal(result.primary_action.target,'approvals');
assert.equal(result.primary_action.priority,20);
assert.match(result.primary_action.label,/Kontaktdaten/i);
assert.equal(result.evidence_snapshot.human_inputs.open_count,7);
assert.equal(result.evidence_snapshot.human_inputs.contact_open_count,1);

assert.equal(result.evidence_snapshot.knowledge.status,'NOT_VERIFIED');
assert.equal(result.evidence_snapshot.reference.status,'NOT_VERIFIED');
assert.equal(result.evidence_snapshot.build.qa_status,'NOT_VERIFIED');
assert.equal(result.evidence_snapshot.visual.status,'NOT_VERIFIED');
assert.equal(result.evidence_snapshot.j9.performance_status,'NOT_VERIFIED');
assert.equal(result.evidence_snapshot.preview.available,false);
assert.equal(result.evidence_snapshot.website_approval.status,'NOT_VERIFIED');

assert.equal(result.automatic_execution,false);
assert.equal(result.automatic_merge,false);
assert.equal(result.production_deploy,false);
assert.equal(result.public_launch,false);
assert.equal(result.dns_change,false);
assert.equal(result.billing_activation,false);
assert.equal(result.automatic_paid_activation,false);
assert.equal(result.external_writes,false);
assert.equal(result.variable_cost_eur,0);

assert.equal(reassessment.premium_delivery_ready,false);
assert.equal(reassessment.public_launch_ready,false);
assert.equal(human.current_real_gelato_state.full_dogfood,'NOT_YET_PASS');

console.log(JSON.stringify({
  ok:true,
  suite:'webfactory-100-j12-gelato-next-best-action-dogfood',
  project_scope:result.project_scope,
  real_repository_evidence:true,
  human_questions_remaining:human.current_real_gelato_state.human_questions_remaining,
  next_best_action:result.primary_action.code,
  next_best_action_label:result.primary_action.label,
  next_best_action_target:result.primary_action.target,
  contact_confirmation_prioritized:'PASS',
  exactly_one_primary_action:'PASS',
  premium_delivery_ready:reassessment.premium_delivery_ready,
  public_launch_ready:reassessment.public_launch_ready,
  full_dogfood:human.current_real_gelato_state.full_dogfood,
  no_fake_pass:'PASS',
  automatic_execution:false,
  production_deploy:false,
  public_launch:false,
  dns_change:false,
  billing_activation:false,
  external_writes:false
},null,2));
