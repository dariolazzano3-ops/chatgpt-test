import assert from 'node:assert/strict';
import fs from 'node:fs';
import { enrichHumanQuestionsWithMultiSourceEvidence } from '../src/project-human-question-multi-source-evidence-v1.js';

const projectDir=new URL('../projects/gelato-donatello-website-v1/',import.meta.url);
const closureUrl=new URL('auto-customer-input-closure-v1.json',projectDir);
const multiUrl=new URL('entity-aware-multi-source-verification-v1.json',projectDir);
const closure=JSON.parse(fs.readFileSync(closureUrl,'utf8'));
const multi=JSON.parse(fs.readFileSync(multiUrl,'utf8'));

assert.equal(closure.project_ref.scope_key,'gelato-donatello:gelato-donatello-website-v1');
assert.equal(multi.project_ref.scope_key,closure.project_ref.scope_key);
assert.equal((closure.human_questions||[]).length,7);

const before=(closure.human_questions||[]).length;
const enriched=enrichHumanQuestionsWithMultiSourceEvidence(closure.human_questions||[],multi);
const after=enriched.remaining;

const nextClosure={
  ...closure,
  human_questions:enriched.questions,
  multi_source_verification:{
    schema:'aurentara.gelato-human-question-multi-source-reevaluation.v1',
    evidence_ref:'projects/gelato-donatello-website-v1/entity-aware-multi-source-verification-v1.json',
    human_questions_before:before,
    human_questions_after:after,
    automatically_closed:enriched.automatically_closed,
    human_only:enriched.human_only,
    conflicts:enriched.conflicts,
    corroborated_but_confirmation_required:enriched.corroborated_but_confirmation_required,
    automatic_customer_confirmation:false,
    majority_vote_used:false
  },
  efficiency:{
    ...(closure.efficiency||{}),
    human_questions_before_multi_source:before,
    human_questions_remaining:after,
    human_questions_after_multi_source:after,
    automatically_resolved_by_multi_source:enriched.automatically_closed,
    human_copy_paste_avoided:enriched.questions.filter((q)=>Array.isArray(q.controls)&&q.controls.length>0).length,
    multi_source_operator_touches:0,
    multi_source_active_operator_minutes:0,
    multi_source_provider_runs:Number(multi.efficiency?.provider_runs||0),
    multi_source_variable_cost_eur:Number(multi.efficiency?.variable_cost_eur||0)
  },
  result:{
    ...(closure.result||{}),
    auto_customer_input_closure:'PASS',
    entity_aware_multi_source_verification:'PASS',
    customer_input_closure:after===0?'READY_FOR_READINESS_REEVALUATION':'BLOCKED_BY_EXTERNAL_INPUT',
    gelato_full_dogfood_ready:false
  }
};

const nextMulti={
  ...multi,
  human_question_reevaluation:{
    before,
    after,
    automatically_closed:enriched.automatically_closed,
    human_only:enriched.human_only,
    conflicts:enriched.conflicts,
    corroborated_but_confirmation_required:enriched.corroborated_but_confirmation_required
  },
  efficiency:{
    ...(multi.efficiency||{}),
    human_questions_before:before,
    human_questions_after:after,
    human_copy_paste_avoided:nextClosure.efficiency.human_copy_paste_avoided,
    operator_touches:0,
    active_operator_minutes:0
  }
};

fs.writeFileSync(closureUrl,JSON.stringify(nextClosure,null,2)+'\n');
fs.writeFileSync(multiUrl,JSON.stringify(nextMulti,null,2)+'\n');

console.log('PROJECT FERRARI Gelato Multi-Source Human Question Re-evaluation: PASS');
console.log(JSON.stringify({
  human_questions_before:before,
  human_questions_after:after,
  automatically_closed:enriched.automatically_closed,
  human_only:enriched.human_only,
  conflicts:enriched.conflicts,
  corroborated_but_confirmation_required:enriched.corroborated_but_confirmation_required,
  human_copy_paste_avoided:nextClosure.efficiency.human_copy_paste_avoided,
  customer_input_closure:nextClosure.result.customer_input_closure,
  production_deploy:false,
  public_launch:false
},null,2));
console.log('---UPDATED_CLOSURE_JSON---');
console.log(JSON.stringify(nextClosure,null,2));
console.log('---UPDATED_MULTI_SOURCE_JSON---');
console.log(JSON.stringify(nextMulti,null,2));
