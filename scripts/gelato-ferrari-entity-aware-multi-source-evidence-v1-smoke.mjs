import assert from 'node:assert/strict';
import fs from 'node:fs';

const projectDir=new URL('../projects/gelato-donatello-website-v1/',import.meta.url);
const multi=JSON.parse(fs.readFileSync(new URL('entity-aware-multi-source-verification-v1.json',projectDir),'utf8'));
const closure=JSON.parse(fs.readFileSync(new URL('auto-customer-input-closure-v1.json',projectDir),'utf8'));

assert.equal(multi.schema,'aurentara.gelato-entity-aware-multi-source-verification.v1');
assert.equal(multi.project_ref.scope_key,'gelato-donatello:gelato-donatello-website-v1');
assert.match(multi.primary_anchor.source_url,/gelato-donatello\.de/);
assert.equal(multi.primary_anchor.robots_status,'RESPECTED');
assert.ok(Number(multi.discovery.sources_discovered)>=5);
assert.ok(Number(multi.discovery.sources_accepted)>=1,'at least one non-anchor public source must be entity-matched');
assert.ok(Number(multi.discovery.sources_rejected)>=1,'blocked/ambiguous/rejected public candidates must remain visible');
for(const item of multi.discovery.results||[]){
  if(item.accepted) assert.ok(['ENTITY_MATCH_CONFIRMED','ENTITY_MATCH_HIGH_CONFIDENCE'].includes(item.entity_match_state),item.url);
  if(['ENTITY_MATCH_AMBIGUOUS','ENTITY_MATCH_REJECTED'].includes(item.entity_match_state)) assert.equal(item.accepted,false,item.url);
}
assert.ok(Number(multi.fact_corroboration.facts_extracted)>0);
assert.ok(Number(multi.fact_corroboration.facts_corroborated)>=1,'multi-source corroboration must be demonstrated');
assert.ok(Number(multi.fact_corroboration.conflicts_found)>=1,'conflicts must not be majority-voted away');
assert.equal(multi.fact_corroboration.conflicts_resolved_automatically,0);
assert.equal(multi.fact_corroboration.majority_vote_used,false);
assert.equal(multi.fact_corroboration.automatic_customer_confirmation,false);

const summaries=multi.fact_corroboration.summaries||[];
for(const field of ['business.phone','business.address','business.opening_hours','legal.entity']){
  assert.ok(summaries.some((item)=>item.field_path===field),field+' multi-source summary missing');
}
const legal=summaries.find((item)=>item.field_path==='legal.entity');
assert.ok(legal.candidate_groups.some((group)=>/UG/i.test(String(group.value)))||legal.candidate_groups.some((group)=>/GmbH/i.test(String(group.value))));
assert.equal(legal.majority_vote_used,false);

assert.equal(closure.multi_source_verification.human_questions_before,7);
assert.equal(closure.multi_source_verification.human_questions_after,(closure.human_questions||[]).length);
assert.equal(closure.multi_source_verification.automatic_customer_confirmation,false);
assert.equal(closure.multi_source_verification.majority_vote_used,false);
assert.ok(closure.multi_source_verification.human_only.includes('TARGET_CUSTOMERS'));
assert.ok(closure.multi_source_verification.human_only.includes('PRIMARY_CONVERSION'));
assert.ok(closure.multi_source_verification.human_only.includes('FINAL_ASSET_QUALITY_APPROVAL'));
assert.ok(closure.multi_source_verification.human_only.includes('FINAL_HUMAN_QUALITY_APPROVAL'));
for(const q of closure.human_questions||[]){
  assert.ok(q.multi_source_verification?.research_state,q.id);
  assert.equal(q.multi_source_verification.automatic_customer_confirmation,false,q.id);
}
assert.equal(closure.result.entity_aware_multi_source_verification,'PASS');
assert.equal(closure.result.gelato_full_dogfood_ready,false);
assert.equal(multi.safety.login_bypass,false);
assert.equal(multi.safety.private_social_data,false);
assert.equal(multi.safety.anti_bot_bypass,false);
assert.equal(multi.safety.production_deploy,false);
assert.equal(multi.safety.public_launch,false);
assert.equal(multi.safety.dns_changed,false);
assert.equal(multi.safety.billing,false);
assert.equal(multi.safety.paid_overflow,false);
assert.equal(Number(multi.safety.paid_provider_calls||0),0);
assert.equal(Number(multi.efficiency.variable_cost_eur||0),0);

console.log(JSON.stringify({
  ok:true,
  suite:'gelato-ferrari-entity-aware-multi-source-evidence-v1',
  anchor:'PASS',
  sources_discovered:multi.discovery.sources_discovered,
  sources_accepted:multi.discovery.sources_accepted,
  sources_rejected:multi.discovery.sources_rejected,
  facts_extracted:multi.fact_corroboration.facts_extracted,
  facts_corroborated:multi.fact_corroboration.facts_corroborated,
  conflicts_found:multi.fact_corroboration.conflicts_found,
  human_questions_before:closure.multi_source_verification.human_questions_before,
  human_questions_after:closure.multi_source_verification.human_questions_after,
  human_only:closure.multi_source_verification.human_only,
  customer_input_closure:closure.result.customer_input_closure,
  gelato_full_dogfood_ready:false,
  production_deploy:false,
  public_launch:false,
  paid_provider_calls:0,
  variable_cost_eur:0
},null,2));
