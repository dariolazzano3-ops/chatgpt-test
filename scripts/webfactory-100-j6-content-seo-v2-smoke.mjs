import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  CONTENT_FACT_STATES,
  CONTENT_SURFACES,
  normalizeContentFact,
  createEvidenceSafeContentContract,
  runContentRenderGuard,
  createSeoEvidenceBundle,
  applySeoStaticArtifacts,
  contentSeoEvidenceManifest,
  executeWebFactoryTask,
  runWebOperatingSystemV2
} from '../src/web-factory/index.js';

const mission={
  project_slug:'gelato-donatello-j6',
  project_scope_key:'customer:gelato-donatello:website-v1',
  business_name:'Gelato Donatello',
  industry:'gelateria',
  services:['Speiseeis','Eistorten'],
  target_audience:'Lokale Gäste und Familien',
  primary_goal:'Sortiment verständlich zeigen',
  conversion_goal:'Besuch im Geschäft',
  brand_positioning:'Handwerkliches Gelato mit klarer Sortimentsdarstellung',
  seo_location:'Saarbrücken',
  language:'de'
};

assert.deepEqual(CONTENT_FACT_STATES,['CONFIRMED','DERIVED_SAFE','NEEDS_CONFIRMATION','PROHIBITED']);
for(const surface of ['BRAND_VOICE','PAGE_INTENT','SECTION_COPY','PRODUCT_COPY','MENU_COPY','FAQ','CTA','MICROCOPY','ALT_TEXT']){
  assert.ok(CONTENT_SURFACES.includes(surface));
}

const derived=normalizeContentFact({
  fact_id:'derived-cta',
  surface:'CTA',
  value:'Heute Sortiment entdecken',
  fact_state:'DERIVED_SAFE',
  source_refs:['fact-menu-available'],
  confidence:0.8,
  derivation:'Neutral CTA derived from confirmed menu availability.'
});
assert.equal(derived.renderable,true);
assert.equal(derived.schema_eligible,false);

const safe=createEvidenceSafeContentContract({
  mission,
  claims:[
    {fact_id:'address',field_path:'business.address',surface:'MICROCOPY',value:'Musterstraße 12, 66111 Saarbrücken',fact_state:'CONFIRMED',source_refs:['operator-confirmation'],confidence:1},
    {fact_id:'phone',field_path:'business.phone',surface:'CTA',value:'+49 681 123456',fact_state:'CONFIRMED',source_refs:['operator-confirmation'],confidence:1},
    {fact_id:'email',field_path:'business.email',surface:'CTA',value:'hallo@example.test',fact_state:'CONFIRMED',source_refs:['operator-confirmation'],confidence:1},
    {fact_id:'hours',field_path:'business.opening_hours',surface:'MICROCOPY',value:'Mo–So 12:00–20:00',fact_state:'CONFIRMED',source_refs:['operator-confirmation'],confidence:1},
    {fact_id:'menu-price',field_path:'menu.price.vanille',surface:'MENU_COPY',value:'1,60 €',fact_state:'CONFIRMED',source_refs:['approved-price-list'],confidence:1},
    {fact_id:'derived-cta',surface:'CTA',value:'Heute Sortiment entdecken',fact_state:'DERIVED_SAFE',source_refs:['menu-price'],confidence:0.8,derivation:'Neutral CTA from confirmed menu data.'},
    {fact_id:'history-unconfirmed',field_path:'business.founded',surface:'STORY',value:'Seit 1987',fact_state:'NEEDS_CONFIRMATION',source_refs:['unverified-website'],confidence:0.4},
    {fact_id:'best-claim',field_path:'marketing.superlative',surface:'SECTION_COPY',value:'Bestes Eis Deutschlands',fact_state:'PROHIBITED',source_refs:['unverified-marketing'],confidence:0}
  ],
  content:{menu:{price:'1,60 €'}}
});
assert.equal(safe.status,'PASS');
assert.ok(safe.confirmed_fact_ids.includes('menu-price'));
assert.ok(safe.derived_safe_fact_ids.includes('derived-cta'));
assert.ok(safe.needs_confirmation_fact_ids.includes('history-unconfirmed'));
assert.ok(safe.prohibited_fact_ids.includes('best-claim'));
assert.equal(safe.facts.find(f=>f.fact_id==='best-claim').renderable,false);
assert.equal(safe.facts.find(f=>f.fact_id==='history-unconfirmed').renderable,false);
assert.equal(safe.policy.prohibited_rendering_allowed,false);
assert.equal(safe.policy.schema_requires_confirmed_fact,true);

const attempted=createEvidenceSafeContentContract({
  mission,
  claims:[{fact_id:'forbidden',value:'Unbelegter Testsieger',fact_state:'PROHIBITED'}],
  attempted_render_claim_ids:['forbidden']
});
assert.equal(attempted.status,'BLOCK');
assert.ok(attempted.blocking_issues.some(i=>i.code==='PROHIBITED_FACT_RENDER_ATTEMPT'));

const missingPriceEvidence=createEvidenceSafeContentContract({
  mission,
  content:{menu:{price:'9,99 €'}}
});
assert.equal(missingPriceEvidence.status,'BLOCK');
assert.ok(missingPriceEvidence.blocking_issues.some(i=>i.code==='FACTUAL_CONTENT_EVIDENCE_MISSING'));

const cleanArtifact={
  files:{
    'site/index.html':'<html><body><h1>Gelato Donatello</h1><p>1,60 €</p><a>Heute Sortiment entdecken</a></body></html>'
  }
};
assert.equal(runContentRenderGuard(cleanArtifact,safe).status,'PASS');

const prohibitedArtifact={
  files:{
    'site/index.html':'<html><body><h1>Gelato Donatello</h1><p>Bestes Eis Deutschlands</p></body></html>'
  }
};
const prohibitedGuard=runContentRenderGuard(prohibitedArtifact,safe);
assert.equal(prohibitedGuard.status,'BLOCK');
assert.ok(prohibitedGuard.blocking_issues.some(i=>i.code==='PROHIBITED_FACT_RENDERED'));

const unconfirmedArtifact={
  files:{'site/index.html':'<html><body><p>Seit 1987</p></body></html>'}
};
assert.equal(runContentRenderGuard(unconfirmedArtifact,safe).status,'BLOCK');

const architecture={
  site_map:[
    {page_id:'home',path:'/'},
    {page_id:'menu',path:'/menu/'},
    {page_id:'contact',path:'/contact/'}
  ],
  navigation:[
    {page_id:'home'},
    {page_id:'menu'},
    {page_id:'contact'}
  ],
  internal_links:[
    {from:'home',to:'menu'},
    {from:'home',to:'contact'},
    {from:'menu',to:'contact'}
  ]
};
const pageIntents=[
  {page_id:'home',page_type:'home',primary_message:'Gelato Donatello',goal:'Übersicht'},
  {page_id:'menu',page_type:'product',primary_message:'Sortiment',goal:'Sortiment zeigen'},
  {page_id:'contact',page_type:'contact',primary_message:'Kontakt',goal:'Besuch erleichtern'}
];

const seoBundle=createSeoEvidenceBundle({
  mission,
  content_contract:safe,
  architecture,
  page_intents:pageIntents,
  environment:'staging',
  redirects:[{from:'/sorten-alt/',to:'/menu/',status:301}],
  nap_occurrences:[
    {page_id:'home',name:'Gelato Donatello',address:'Musterstraße 12, 66111 Saarbrücken',phone:'+49 681 123456'},
    {page_id:'contact',name:'Gelato Donatello',address:'Musterstraße 12, 66111 Saarbrücken',phone:'+49 681 123456'}
  ]
});
assert.equal(seoBundle.status,'PASS');
assert.equal(seoBundle.technical.status,'PASS');
assert.equal(seoBundle.nap_integrity.status,'PASS');
assert.equal(seoBundle.structured_data.confirmed_facts_only,true);
assert.equal(seoBundle.schema_confirmed_facts_only,true);
assert.equal(seoBundle.structured_data.LocalBusiness.status,'READY');
assert.equal(seoBundle.structured_data.LocalBusiness.fields.name,'Gelato Donatello');
assert.equal(seoBundle.structured_data.LocalBusiness.fields.address,'Musterstraße 12, 66111 Saarbrücken');
assert.equal(seoBundle.structured_data.LocalBusiness.fields.telephone,'+49 681 123456');
assert.equal(seoBundle.structured_data.LocalBusiness.fields.openingHours,'Mo–So 12:00–20:00');
assert.equal(JSON.stringify(seoBundle.structured_data).includes('Bestes Eis Deutschlands'),false);
assert.equal(JSON.stringify(seoBundle.structured_data).includes('Seit 1987'),false);
assert.equal(seoBundle.local_seo.local_business,true);
assert.equal(seoBundle.local_seo.status,'READY');
assert.ok(seoBundle.sitemap.urls.some(url=>url.endsWith('/menu/')));
assert.equal(seoBundle.robots.policy,'noindex_disallow_all');
assert.equal(seoBundle.not_found.path,'/404.html');
assert.deepEqual(seoBundle.redirects.redirects,[{from:'/sorten-alt/',to:'/menu/',status:301}]);

const napMismatch=createSeoEvidenceBundle({
  mission,
  content_contract:safe,
  architecture,
  page_intents:pageIntents,
  nap_occurrences:[{page_id:'contact',name:'Gelato Donatello',address:'Falsche Straße 9',phone:'+49 681 123456'}]
});
assert.equal(napMismatch.status,'BLOCK');
assert.ok(napMismatch.blocking_issues.some(i=>i.code==='NAP_ADDRESS_MISMATCH'));

const badRedirect=createSeoEvidenceBundle({
  mission,
  content_contract:safe,
  architecture,
  page_intents:pageIntents,
  redirects:[{from:'/same/',to:'/same/',status:301}]
});
assert.equal(badRedirect.status,'BLOCK');
assert.ok(badRedirect.blocking_issues.some(i=>i.code==='REDIRECT_LOOP'));

const dummyBuild={
  artifact:{
    project_root:'projects/gelato-j6',
    project:{slug:'gelato-j6'},
    files:{'projects/gelato-j6/index.html':'<html><body>ok</body></html>'}
  }
};
const applied=applySeoStaticArtifacts(dummyBuild,seoBundle,{});
assert.equal(applied.ok,true);
for(const file of ['robots.txt','sitemap.xml','404.html','_redirects']){
  assert.ok(Object.prototype.hasOwnProperty.call(dummyBuild.artifact.files,'projects/gelato-j6/'+file));
}
assert.ok(dummyBuild.artifact.files['projects/gelato-j6/robots.txt'].includes('Disallow: /'));
assert.ok(dummyBuild.artifact.files['projects/gelato-j6/sitemap.xml'].includes('<urlset'));
assert.ok(dummyBuild.artifact.files['projects/gelato-j6/404.html'].includes('404'));
assert.ok(dummyBuild.artifact.files['projects/gelato-j6/_redirects'].includes('/sorten-alt/ /menu/ 301'));

const adapter=executeWebFactoryTask({
  capability:'web.content-seo.v2',
  mission,
  claims:[
    {fact_id:'safe-copy',surface:'SECTION_COPY',value:'Handwerkliches Gelato',fact_state:'CONFIRMED',source_refs:['operator'],confidence:1}
  ]
});
assert.equal(adapter.ok,true);
assert.equal(adapter.status,'CONTENT_EVIDENCE_READY');

const manifestResult=executeWebFactoryTask({capability:'web.content-seo.v2',operation:'manifest'});
assert.equal(manifestResult.ok,true);
assert.equal(manifestResult.manifest.schema_confirmed_facts_only,true);

const fixture=JSON.parse(await readFile(new URL('../fixtures/web-factory/autonomous-local-service-bakery.json',import.meta.url),'utf8'));
const webOs=runWebOperatingSystemV2({
  ...fixture,
  content_claims:[
    {fact_id:'nonrendered-pending',field_path:'business.founded',surface:'SECTION_COPY',value:'Seit 1899',fact_state:'NEEDS_CONFIRMATION',source_refs:['unverified-import'],confidence:0.3}
  ],
  redirects:[{from:'/old-contact/',to:'/contact/',status:301}]
},{now:'2026-09-07T02:00:00.000Z',build_duration_ms:1});
assert.equal(webOs.ok,true);
assert.equal(webOs.content_evidence.contract.status,'PASS');
assert.equal(webOs.content_evidence.render_guard.status,'PASS');
assert.equal(webOs.SEO.evidence.status,'PASS');
assert.equal(webOs.SEO.evidence.schema_confirmed_facts_only,true);
for(const file of ['web-os-v2-content-evidence.json','web-os-v2-seo-evidence.json','robots.txt','sitemap.xml','404.html','_redirects']){
  assert.ok(webOs.artifact.files[webOs.artifact.project_root+'/'+file]);
}
assert.equal(webOs.delivery_manifest.content_evidence.contract.policy.prohibited_rendering_allowed,false);
assert.equal(webOs.delivery_manifest.SEO.evidence.alt_text_policy.factual_alt_text_requires_safe_fact,true);

const manifest=contentSeoEvidenceManifest();
assert.equal(manifest.existing_seo_engine_reused,true);
assert.equal(manifest.existing_project_content_rights_qa_reused,true);
assert.equal(manifest.schema_confirmed_facts_only,true);
assert.ok(manifest.seo_rules.includes('nap_integrity'));
assert.ok(manifest.seo_rules.includes('404'));
assert.ok(manifest.content_rules.includes('prohibited_never_render'));

console.log(JSON.stringify({
  ok:true,
  suite:'webfactory-100-j6-content-seo-v2',
  fact_states:CONTENT_FACT_STATES,
  prohibited_render_guard:'PASS',
  unconfirmed_render_guard:'PASS',
  factual_content_evidence_guard:'PASS',
  schema_confirmed_facts_only:'PASS',
  local_seo_gelateria:'PASS',
  nap_integrity:'PASS',
  sitemap:'PASS',
  robots:'PASS',
  not_found_404:'PASS',
  redirects:'PASS',
  web_os_v2_integration:'PASS',
  production_deploy:false
},null,2));
