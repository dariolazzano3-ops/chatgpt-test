import assert from 'node:assert/strict';
import { createProjectSourceIntakeState, upsertProjectFact } from '../src/project-source-intake-v1.js';
import {
  buildBusinessEntityFingerprint,
  extractBusinessEvidenceFromImport,
  evaluateBusinessEntityMatch,
  ingestAnchorBusinessEvidence,
  ingestEntityMatchedPublicSource,
  corroborateProjectFacts,
  evaluateSourceFreshness,
  entityAwareMultiSourceVerificationManifest
} from '../src/project-entity-aware-multi-source-verification-v1.js';

const scope='gelato-donatello:gelato-donatello-website-v1';
const at='2026-09-05T10:00:00.000Z';
const anchorImport={
  ok:true,
  source_url:'https://gelato-donatello.de/',
  canonical_source_url:'https://gelato-donatello.de/',
  pages:[{
    url:'https://gelato-donatello.de/',
    title:'Gelato Donatello',
    headings:{h1:['Gelato Donatello']},
    visible_text:'Gelato Donatello Hauptstraße 4, 66346 Köllerbach Telefon 06806 9394980 Täglich von 12.00 bis 22.00 (von März bis Oktober)',
    contacts:{phones:['06806 9394980'],emails:[]},
    address_candidates:['Hauptstraße 4, 66346 Köllerbach'],
    opening_hour_candidates:['Täglich von 12.00 bis 22.00 (von März bis Oktober)'],
    service_product_candidates:['Eis'],
    social_links:[],
    ctas:['Kontakt'],
    brand_signals:{og_site_name:'Gelato Donatello'}
  },{
    url:'https://gelato-donatello.de/impressum/',
    title:'Impressum - Gelato Donatello',
    headings:{h1:['Impressum']},
    visible_text:'Gelato Donatello UG (haftungsbeschränkt) Geschäftsführer: Herr Fabrizio Lazzano Hauptstraße 4 66346 Püttlingen Telefon +49 176 200 150 65 E-Mail Fabrizio.lazzano@freenet.de Ust ID DE 306 726 779',
    contacts:{phones:['+49 176 200 150 65'],emails:['Fabrizio.lazzano@freenet.de']},
    address_candidates:['Hauptstraße 4, 66346 Püttlingen'],
    opening_hour_candidates:[],
    service_product_candidates:[],
    social_links:[],
    ctas:[],
    brand_signals:{}
  }],
  business_facts:{phones:['06806 9394980','+49 176 200 150 65'],emails:['Fabrizio.lazzano@freenet.de']},
  extracted_candidates:{social_links:[]},
  conversion_inventory:{detected_ctas:['Kontakt']}
};

const fpResult=buildBusinessEntityFingerprint(anchorImport,{project_id:'gelato-donatello-website-v1',scope_key:scope,business_name:'Gelato Donatello',generated_at:at});
assert.equal(fpResult.ok,true);
const fp=fpResult.fingerprint;
assert.equal(fp.anchor_domain,'gelato-donatello.de');
assert.ok(fp.normalized_phones.length>=2);
assert.ok(fp.legal_entities.some((v)=>/UG/i.test(v)));

const listingEvidence=extractBusinessEvidenceFromImport({
  source_url:'https://directory.example/gelato',
  canonical_source_url:'https://directory.example/gelato',
  pages:[{
    url:'https://directory.example/gelato',title:'Gelato Donatello GmbH',
    headings:{h1:['Gelato Donatello GmbH']},
    visible_text:'Gelato Donatello GmbH Hauptstraße 4, 66346 Püttlingen 06806 9394980 Webseite https://gelato-donatello.de/',
    contacts:{phones:['06806 9394980'],emails:[]},
    address_candidates:['Hauptstraße 4, 66346 Püttlingen'],
    opening_hour_candidates:['Montag 13:00-21:30'],
    service_product_candidates:['Eiscafé'],
    social_links:[],ctas:['Anrufen'],brand_signals:{og_site_name:'Gelato Donatello GmbH'}
  }],
  business_facts:{phones:['06806 9394980'],emails:[]},
  conversion_inventory:{detected_ctas:['Anrufen']}
},{source_url:'https://directory.example/gelato',fetched_at:at});
const matchA=evaluateBusinessEntityMatch(fp,listingEvidence,{declared_domains:['gelato-donatello.de']});
assert.ok(['ENTITY_MATCH_CONFIRMED','ENTITY_MATCH_HIGH_CONFIDENCE'].includes(matchA.state));
assert.equal(matchA.facts_may_be_ingested,true);

const registerEvidence=extractBusinessEvidenceFromImport({
  source_url:'https://register.example/company/103261',
  pages:[{
    url:'https://register.example/company/103261',title:'Gelato Donatello GmbH',
    headings:{h1:['Gelato Donatello GmbH']},
    visible_text:'Gelato Donatello GmbH Hauptstraße 4, 66346 Püttlingen Geschäftsführer Fabrizio Lazzano HRB 103261',
    contacts:{phones:[],emails:[]},
    address_candidates:['Hauptstraße 4, 66346 Püttlingen'],
    opening_hour_candidates:[],service_product_candidates:['Herstellung und Vertrieb von Speiseeis'],
    social_links:[],ctas:[],brand_signals:{}
  }]
},{source_url:'https://register.example/company/103261',business_name_candidates:['Gelato Donatello GmbH'],fetched_at:at});
const matchB=evaluateBusinessEntityMatch(fp,registerEvidence,{});
assert.ok(['ENTITY_MATCH_CONFIRMED','ENTITY_MATCH_HIGH_CONFIDENCE'].includes(matchB.state));

const foreignEvidence=extractBusinessEvidenceFromImport({
  source_url:'https://foreign.example/',
  pages:[{
    url:'https://foreign.example/',title:'Gelato Donatello',
    headings:{h1:['Gelato Donatello']},
    visible_text:'Gelato Donatello Via Roma 99, 20100 Milano +39 02 999999',
    contacts:{phones:['+39 02 999999'],emails:[]},
    address_candidates:['Via Roma 99, 20100 Milano'],
    opening_hour_candidates:[],service_product_candidates:[],social_links:[],ctas:[],brand_signals:{}
  }]
},{source_url:'https://foreign.example/',business_name_candidates:['Gelato Donatello'],fetched_at:at});
const foreignMatch=evaluateBusinessEntityMatch(fp,foreignEvidence,{});
assert.ok(['ENTITY_MATCH_AMBIGUOUS','ENTITY_MATCH_REJECTED'].includes(foreignMatch.state));
assert.equal(foreignMatch.facts_may_be_ingested,false);

const created=createProjectSourceIntakeState({operator_id:'operator:test',customer_id:'gelato-donatello',project_id:'gelato-donatello-website-v1',scope_key:scope,at});
let state=created.state;
const anchorEvidence=extractBusinessEvidenceFromImport(anchorImport,{source_url:'https://gelato-donatello.de/',business_name:'Gelato Donatello',fetched_at:at});
let ingested=ingestAnchorBusinessEvidence(state,{evidence:anchorEvidence,source_url:'https://gelato-donatello.de/',fetched_at:at},{at});
assert.equal(ingested.ok,true);
state=ingested.state;

ingested=ingestEntityMatchedPublicSource(state,{source_url:'https://directory.example/gelato',source_role:'REPUTABLE_BUSINESS_LISTING',evidence:listingEvidence,entity_match:matchA,fetched_at:at,visible_updated_at:'2026-08-12T00:00:00.000Z'},{at});
assert.equal(ingested.ok,true);
state=ingested.state;
ingested=ingestEntityMatchedPublicSource(state,{source_url:'https://register.example/company/103261',source_role:'OFFICIAL_BUSINESS_REGISTER',evidence:registerEvidence,entity_match:matchB,fetched_at:at},{at});
assert.equal(ingested.ok,true);
state=ingested.state;

const rejectedIngest=ingestEntityMatchedPublicSource(state,{source_url:'https://foreign.example/',source_role:'SECONDARY_WEB_SOURCE',evidence:foreignEvidence,entity_match:foreignMatch,fetched_at:at},{at});
assert.equal(rejectedIngest.ok,true);
assert.equal(rejectedIngest.accepted,false);
assert.equal(rejectedIngest.state.sources.length,state.sources.length);

const corroborated=corroborateProjectFacts(state,{at,reference_time_ms:Date.parse(at)});
assert.equal(corroborated.ok,true);
state=corroborated.state;
const phoneSummary=corroborated.summaries.find((s)=>s.field_path==='business.phone');
assert.ok(phoneSummary);
assert.equal(phoneSummary.conflict,true,'mobile imprint phone and landline must remain conflict');
assert.equal(phoneSummary.majority_vote_used,false);
const addressSummary=corroborated.summaries.find((s)=>s.field_path==='business.address');
assert.equal(addressSummary.conflict,true,'Köllerbach/Püttlingen locality variants must not be silently normalized');
const legalSummary=corroborated.summaries.find((s)=>s.field_path==='legal.entity');
assert.equal(legalSummary.conflict,true,'UG/GmbH change must remain explicit conflict');

const provenanceFact=state.facts.find((fact)=>fact.field_path==='business.phone'&&fact.source_refs.some((id)=>id.includes('directory')));
assert.ok(provenanceFact);
assert.ok(provenanceFact.provenance[0].source_url);
assert.ok(provenanceFact.provenance[0].fetched_at);
assert.ok(provenanceFact.provenance[0].entity_match_state);
assert.equal(provenanceFact.verification_status==='CUSTOMER_CONFIRMED',false);

const confirmed=upsertProjectFact(state,{field_path:'business.test_authoritative',value:'A',origin:'MANUAL',verification_status:'OPERATOR_CONFIRMED',source_refs:[]},{at});
state=confirmed.state;
const externalConflict=upsertProjectFact(state,{field_path:'business.test_authoritative',value:'B',origin:'EXTRACTED',verification_status:'UNVERIFIED',source_refs:[state.sources.find((s)=>s.source_type==='PUBLIC_WEB_SOURCE').source_id],preserve_confirmed_precedence:true},{at});
assert.equal(externalConflict.ok,true);
assert.equal(externalConflict.confirmed_precedence_preserved,true);
assert.equal(externalConflict.state.facts.find((f)=>f.value==='A').verification_status,'OPERATOR_CONFIRMED');
assert.equal(externalConflict.state.facts.find((f)=>f.value==='B').verification_status,'UNVERIFIED');

const fresh=evaluateSourceFreshness({visible_updated_at:'2026-08-12T00:00:00.000Z'},'business.phone',{reference_time_ms:Date.parse(at)});
assert.equal(fresh.state,'FRESH');
const stale=evaluateSourceFreshness({visible_updated_at:'2024-01-01T00:00:00.000Z'},'business.opening_hours',{reference_time_ms:Date.parse(at)});
assert.equal(stale.state,'STALE');

for(const source of state.sources) assert.equal(source.scope_key,scope);
for(const fact of state.facts) assert.equal(fact.scope_key,scope);

const manifest=entityAwareMultiSourceVerificationManifest();
assert.equal(manifest.existing_project_source_intake_reused,true);
assert.equal(manifest.existing_fact_engine_reused,true);
assert.equal(manifest.majority_vote,false);
assert.equal(manifest.automatic_customer_confirmation,false);
assert.equal(manifest.login_bypass,false);
assert.equal(manifest.anti_bot_bypass,false);
assert.equal(manifest.production_deploy,false);

console.log(JSON.stringify({
  ok:true,
  suite:'project-ferrari-entity-aware-multi-source-verification-v1',
  anchor_fingerprint:'PASS',
  entity_match_positive:'PASS',
  foreign_entity_fail_closed:'PASS',
  provenance:'PASS',
  conflict_preservation:'PASS',
  confirmed_precedence:'PASS',
  freshness:'PASS',
  project_isolation:'PASS',
  automatic_customer_confirmation:false,
  majority_vote:false,
  production_deploy:false,
  paid_provider_calls:0,
  variable_cost_eur:0
},null,2));
