import assert from 'node:assert/strict';
import fs from 'node:fs';
import { importProjectWebsiteSource } from '../src/project-source-website-import-v1.js';
import { createProjectSourceIntakeState } from '../src/project-source-intake-v1.js';
import {
  buildBusinessEntityFingerprint,
  extractBusinessEvidenceFromImport,
  evaluateBusinessEntityMatch,
  ingestAnchorBusinessEvidence,
  ingestEntityMatchedPublicSource,
  corroborateProjectFacts,
  discoverAnchorLinkedPublicSources
} from '../src/project-entity-aware-multi-source-verification-v1.js';

const scopeKey='gelato-donatello:gelato-donatello-website-v1';
const projectId='gelato-donatello-website-v1';
const fetchedAt=new Date().toISOString();

const anchor=await importProjectWebsiteSource({
  source_url:'https://gelato-donatello.de/',
  max_pages:10,
  max_depth:2,
  discover_sitemap:true
});
assert.equal(anchor.ok,true,'Gelato anchor source must remain readable');
assert.equal(anchor.robots_status,'RESPECTED');

const fingerprintResult=buildBusinessEntityFingerprint(anchor,{
  project_id:projectId,
  scope_key:scopeKey,
  business_name:'Gelato Donatello',
  confirmed_business_names:['Gelato Donatello'],
  generated_at:fetchedAt
});
assert.equal(fingerprintResult.ok,true);
const fingerprint=fingerprintResult.fingerprint;

const created=createProjectSourceIntakeState({
  operator_id:'operator:project-ferrari-entity-aware-capture',
  customer_id:'gelato-donatello',
  project_id:projectId,
  scope_key:scopeKey,
  at:fetchedAt
});
assert.equal(created.ok,true);
let state=created.state;

const anchorEvidence=extractBusinessEvidenceFromImport(anchor,{
  source_url:anchor.canonical_source_url||anchor.source_url,
  business_name:'Gelato Donatello',
  fetched_at:fetchedAt
});
const anchorIngested=ingestAnchorBusinessEvidence(state,{
  evidence:anchorEvidence,
  source_url:anchorEvidence.source_url,
  fetched_at:fetchedAt
},{at:fetchedAt});
assert.equal(anchorIngested.ok,true);
state=anchorIngested.state;

const researchCandidates=[
  {
    url:'https://openregister.de/company/DE-HRB-V1109-103261',
    source_role:'OFFICIAL_BUSINESS_REGISTER',
    discovery_method:'PUBLIC_SEARCH_RESULT',
    display_name:'OpenRegister Gelato Donatello GmbH',
    business_name_candidates:['Gelato Donatello GmbH'],
    declared_domains:['gelato-donatello.de']
  },
  {
    url:'https://www.companyhouse.de/Gelato-Donatello-GmbH-Puettlingen',
    source_role:'OFFICIAL_BUSINESS_REGISTER',
    discovery_method:'PUBLIC_SEARCH_RESULT',
    display_name:'CompanyHouse Gelato Donatello GmbH',
    business_name_candidates:['Gelato Donatello GmbH'],
    visible_updated_at:'2025-11-04T00:00:00.000Z'
  },
  {
    url:'https://www.11880.com/branchenbuch/puettlingen/070941287B112915352/gelato-donatello-gmbh.html',
    source_role:'REPUTABLE_BUSINESS_LISTING',
    discovery_method:'PUBLIC_SEARCH_RESULT',
    display_name:'11880 Gelato Donatello GmbH',
    business_name_candidates:['Gelato Donatello GmbH'],
    declared_domains:['gelato-donatello.de'],
    visible_updated_at:'2026-08-12T00:00:00.000Z'
  },
  {
    url:'https://branchenbuch.meinestadt.de/puettlingen/company/15122700',
    source_role:'REPUTABLE_BUSINESS_LISTING',
    discovery_method:'PUBLIC_SEARCH_RESULT',
    display_name:'meinestadt Gelato Donatello GmbH',
    business_name_candidates:['Gelato Donatello GmbH']
  },
  {
    url:'https://www.dnb.com/business-directory/company-profiles.gelato_donatello_gmbh.8e01e73eb43737ffb365ac9b5169991b.html',
    source_role:'REPUTABLE_BUSINESS_LISTING',
    discovery_method:'PUBLIC_SEARCH_RESULT',
    display_name:'D&B Gelato Donatello GmbH',
    business_name_candidates:['Gelato Donatello GmbH'],
    declared_domains:['gelato-donatello.de']
  },
  {
    url:'https://www.viaductus.de/firma/DE-V1109-HRB-103261-gelato-donatello-gmbh-puettlingen',
    source_role:'REPUTABLE_BUSINESS_LISTING',
    discovery_method:'PUBLIC_SEARCH_RESULT',
    display_name:'Viaductus Gelato Donatello GmbH',
    business_name_candidates:['Gelato Donatello GmbH']
  },
  {
    url:'https://restaurantguru.com/Gelato-Donatello-GmbH-Puttlingen',
    source_role:'THIRD_PARTY_DIRECTORY',
    discovery_method:'PUBLIC_SEARCH_RESULT',
    display_name:'Restaurant Guru Gelato Donatello GmbH',
    business_name_candidates:['Gelato Donatello GmbH'],
    declared_domains:['gelato-donatello.de'],
    social_links:['https://www.instagram.com/gelatodonatello/'],
    visible_updated_at:'2025-12-27T00:00:00.000Z'
  },
  {
    url:'https://www.regional.de/Saarland/Eiscafe-in-Voelklingen.htm',
    source_role:'THIRD_PARTY_DIRECTORY',
    discovery_method:'PUBLIC_SEARCH_RESULT',
    display_name:'Regional Saarland listing',
    business_name_candidates:['Gelato Donatello GmbH'],
    declared_domains:['gelato-donatello.de']
  },
  {
    url:'https://www.instagram.com/gelatodonatello/',
    source_role:'SECONDARY_WEB_SOURCE',
    discovery_method:'INDIRECT_SOCIAL_HANDLE_FROM_BUSINESS_LISTING',
    display_name:'Instagram @gelatodonatello',
    business_name_candidates:['Gelato Donatello']
  }
];

const anchorLinked=discoverAnchorLinkedPublicSources(anchor);
const candidates=[...anchorLinked,...researchCandidates].filter((item,index,all)=>all.findIndex((other)=>other.url===item.url)===index);
const discoveries=[];
let fetchErrors=0;
let providerRuns=0;

for(const candidate of candidates){
  providerRuns+=1;
  const imported=await importProjectWebsiteSource({
    source_url:candidate.url,
    max_pages:4,
    max_depth:1,
    discover_sitemap:false
  });
  if(!imported.ok){
    fetchErrors+=1;
    discoveries.push({
      ...candidate,
      fetch_status:'REJECTED_BY_EXISTING_IMPORT_GUARDS',
      fetch_error:imported.error||null,
      robots_status:imported.robots_status||null,
      entity_match_state:'NOT_EVALUATED_FETCH_BLOCKED',
      accepted:false
    });
    continue;
  }
  const evidence=extractBusinessEvidenceFromImport(imported,{
    source_url:imported.canonical_source_url||candidate.url,
    business_name_candidates:candidate.business_name_candidates,
    domain_candidates:candidate.declared_domains,
    social_links:candidate.social_links,
    fetched_at:fetchedAt,
    visible_updated_at:candidate.visible_updated_at
  });
  const match=evaluateBusinessEntityMatch(fingerprint,evidence,{
    declared_domains:candidate.declared_domains||[],
    discovery_method:candidate.discovery_method
  });
  const accepted=match.facts_may_be_ingested===true;
  let ingested={ok:true,state,facts_ingested:0};
  if(accepted){
    ingested=ingestEntityMatchedPublicSource(state,{
      source_url:evidence.source_url||candidate.url,
      display_name:candidate.display_name,
      source_role:candidate.source_role,
      discovery_method:candidate.discovery_method,
      evidence,
      entity_match:match,
      fetched_at:fetchedAt,
      visible_updated_at:candidate.visible_updated_at
    },{at:fetchedAt});
    assert.equal(ingested.ok,true);
    state=ingested.state;
  }
  discoveries.push({
    ...candidate,
    fetch_status:'FETCHED',
    robots_status:imported.robots_status,
    pages_analyzed:imported.pages_analyzed,
    entity_match_state:match.state,
    entity_match_score:match.score,
    matched_signals:match.signals,
    accepted,
    facts_ingested:ingested.facts_ingested||0,
    evidence:{
      business_name:evidence.business_name,
      phones:evidence.phones,
      emails:evidence.emails,
      addresses:evidence.addresses,
      opening_hours:evidence.opening_hours,
      legal_entities:evidence.legal_entities,
      responsible_people:evidence.responsible_people,
      vat_ids:evidence.vat_ids,
      social_links:evidence.social_links,
      products_services:evidence.products_services.slice(0,20),
      conversion_signals:evidence.conversion_signals,
      fetched_at:evidence.fetched_at,
      visible_updated_at:evidence.visible_updated_at
    }
  });
}

const corroborated=corroborateProjectFacts(state,{at:fetchedAt});
assert.equal(corroborated.ok,true);
state=corroborated.state;

const accepted=discoveries.filter((item)=>item.accepted);
const rejected=discoveries.filter((item)=>!item.accepted);
const factsExtracted=state.facts.length;
const factsCorroborated=corroborated.summaries.filter((item)=>item.classification==='CORROBORATED_CANDIDATE'||item.classification==='CONFIRMED').length;
const conflicts=corroborated.summaries.filter((item)=>item.conflict);

const evidence={
  schema:'aurentara.gelato-entity-aware-multi-source-verification.v1',
  project_ref:{customer_id:'gelato-donatello',project_id:projectId,scope_key:scopeKey},
  generated_at:fetchedAt,
  primary_anchor:{
    source_url:anchor.canonical_source_url||anchor.source_url,
    robots_status:anchor.robots_status,
    pages_analyzed:anchor.pages_analyzed,
    fingerprint
  },
  discovery:{
    anchor_linked_candidates:anchorLinked,
    research_candidates:researchCandidates,
    sources_discovered:candidates.length,
    sources_accepted:accepted.length,
    sources_rejected:rejected.length,
    results:discoveries
  },
  fact_corroboration:{
    summaries:corroborated.summaries,
    facts_extracted:factsExtracted,
    facts_corroborated:factsCorroborated,
    conflicts_found:conflicts.length,
    conflicts_resolved_automatically:0,
    majority_vote_used:false,
    automatic_customer_confirmation:false
  },
  project_state_projection:{
    source_count:state.sources.length,
    fact_count:state.facts.length,
    scope_key:state.scope_key,
    foreign_scope_mutations:0
  },
  efficiency:{
    anchor_sources:1,
    sources_discovered:candidates.length,
    sources_accepted:accepted.length,
    sources_rejected:rejected.length,
    facts_extracted:factsExtracted,
    facts_corroborated:factsCorroborated,
    conflicts_found:conflicts.length,
    conflicts_resolved_automatically:0,
    human_questions_before:7,
    human_questions_after:null,
    human_copy_paste_avoided:'MEASURED_AFTER_QUESTION_REEVALUATION',
    operator_touches:0,
    active_operator_minutes:0,
    fetch_errors:fetchErrors,
    provider_runs:providerRuns,
    variable_cost_eur:0
  },
  safety:{
    login_bypass:false,
    private_social_data:false,
    anti_bot_bypass:false,
    automatic_publication:false,
    automatic_customer_confirmation:false,
    secrets_in_evidence:false,
    production_deploy:false,
    public_launch:false,
    dns_changed:false,
    billing:false,
    paid_overflow:false,
    paid_provider_calls:0
  }
};

const target=new URL('../projects/gelato-donatello-website-v1/entity-aware-multi-source-verification-v1.json',import.meta.url);
fs.writeFileSync(target,JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify(evidence,null,2));
