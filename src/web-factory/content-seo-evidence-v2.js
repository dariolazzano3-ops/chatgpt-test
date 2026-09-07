import { createSeoArchitecture, createStructuredDataContract, createLocalSeoContract, runTechnicalSeoQa } from './seo-quality-v2.js';

export const CONTENT_FACT_STATES=Object.freeze(['CONFIRMED','DERIVED_SAFE','NEEDS_CONFIRMATION','PROHIBITED']);
export const CONTENT_SURFACES=Object.freeze(['BRAND_VOICE','PAGE_INTENT','SECTION_COPY','PRODUCT_COPY','MENU_COPY','FAQ','CTA','MICROCOPY','ALT_TEXT']);

const arr=(v)=>Array.isArray(v)?v:[];
const obj=(v)=>v&&typeof v==='object'&&!Array.isArray(v)?structuredClone(v):{};
const text=(v,max=2000)=>String(v??'').replace(/\s+/g,' ').trim().slice(0,max);
const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,Number.isFinite(Number(v))?Number(v):0));
const normalize=(v)=>text(v,8000).toLowerCase();
const safeStates=new Set(['CONFIRMED','DERIVED_SAFE']);
const schemaStates=new Set(['CONFIRMED']);

function factId(raw,index){
  return text(raw.fact_id||raw.claim_id||raw.id||('fact-'+(index+1)),180);
}
function sourceRefs(raw={}){
  return [...new Set(arr(raw.source_refs||raw.sources).map(v=>text(typeof v==='object'?v.source_id||v.id:v,300)).filter(Boolean))];
}
function stateOf(raw={}){
  const state=text(raw.fact_state||raw.state||raw.status||'NEEDS_CONFIRMATION',80).toUpperCase();
  return CONTENT_FACT_STATES.includes(state)?state:'NEEDS_CONFIRMATION';
}
function surfaceOf(raw={}){
  const surface=text(raw.surface||raw.content_surface||raw.type||'SECTION_COPY',80).toUpperCase();
  return CONTENT_SURFACES.includes(surface)?surface:'SECTION_COPY';
}

export function normalizeContentFact(raw={},index=0){
  const state=stateOf(raw);
  const value=text(raw.value??raw.content??raw.claim,4000);
  const refs=sourceRefs(raw);
  const confidence=clamp(raw.confidence??(state==='CONFIRMED'?1:state==='DERIVED_SAFE'?0.75:0));
  const issues=[];
  if(!value)issues.push({code:'FACT_VALUE_REQUIRED',severity:'BLOCK'});
  if(safeStates.has(state)&&!refs.length)issues.push({code:'RENDERABLE_FACT_SOURCE_REQUIRED',severity:'BLOCK'});
  if(state==='DERIVED_SAFE'&&!text(raw.derivation,1000))issues.push({code:'DERIVED_SAFE_DERIVATION_REQUIRED',severity:'BLOCK'});
  if(state==='CONFIRMED'&&confidence<0.8)issues.push({code:'CONFIRMED_FACT_CONFIDENCE_TOO_LOW',severity:'BLOCK',confidence});
  if(state==='DERIVED_SAFE'&&confidence<0.5)issues.push({code:'DERIVED_SAFE_CONFIDENCE_TOO_LOW',severity:'BLOCK',confidence});
  return{
    schema:'riosystems.content-fact.v2',
    fact_id:factId(raw,index),
    field_path:text(raw.field_path||raw.field||raw.key,240)||null,
    surface:surfaceOf(raw),
    value,
    fact_state:state,
    source_refs:refs,
    confidence,
    derivation:text(raw.derivation,1000)||null,
    project_scope:text(raw.project_scope,320)||null,
    renderable:safeStates.has(state)&&issues.length===0,
    schema_eligible:schemaStates.has(state)&&issues.length===0,
    issues
  };
}

export function deriveLocalBusinessContentFacts(data={},projectScope=null){
  const facts=[];
  const fields=[
    ['business.local_name',data.name,'BRAND_VOICE'],
    ['business.address',data.address,'MICROCOPY'],
    ['business.service_area',data.service_area,'PAGE_INTENT'],
    ['business.opening_hours',data.opening_hours,'MICROCOPY'],
    ['business.contact',data.contact,'CTA'],
    ['business.phone',data.phone,'CTA'],
    ['business.email',data.email,'CTA']
  ];
  for(const [field,value,surface] of fields){
    if(value===null||value===undefined||value==='')continue;
    facts.push(normalizeContentFact({
      fact_id:'local-'+field.replace(/[^a-z0-9]+/gi,'-').toLowerCase(),
      field_path:field,
      surface,
      value,
      fact_state:'CONFIRMED',
      source_refs:['local_business_data'],
      confidence:1,
      project_scope:projectScope
    },facts.length));
  }
  return facts;
}

export function deriveMissionContentFacts(mission={}){
  const facts=[];
  const push=(field,value,surface='PAGE_INTENT')=>{
    if(value===null||value===undefined||value===''||(Array.isArray(value)&&!value.length))return;
    if(Array.isArray(value)){
      value.forEach((item,index)=>push(field+'['+index+']',item,surface));
      return;
    }
    facts.push(normalizeContentFact({
      fact_id:'mission-'+field.replace(/[^a-z0-9]+/gi,'-').toLowerCase(),
      field_path:field,
      surface,
      value,
      fact_state:'CONFIRMED',
      source_refs:['website_mission'],
      confidence:1,
      project_scope:mission.project_scope_key||mission.project_slug||null
    },facts.length));
  };
  push('business_name',mission.business_name,'BRAND_VOICE');
  push('industry',mission.industry,'PAGE_INTENT');
  push('services',mission.services,'PRODUCT_COPY');
  push('target_audience',mission.target_audience,'PAGE_INTENT');
  push('primary_goal',mission.primary_goal,'PAGE_INTENT');
  push('conversion_goal',mission.conversion_goal,'CTA');
  push('brand_positioning',mission.brand_positioning,'BRAND_VOICE');
  push('seo_location',mission.seo_location,'PAGE_INTENT');
  return facts;
}

function flattenStrings(value,prefix='',out=[]){
  if(Array.isArray(value)){
    value.forEach((v,i)=>flattenStrings(v,prefix+'['+i+']',out));
    return out;
  }
  if(value&&typeof value==='object'){
    for(const [k,v] of Object.entries(value))flattenStrings(v,prefix?prefix+'.'+k:k,out);
    return out;
  }
  if(typeof value==='string'&&text(value,4000))out.push({path:prefix,value:text(value,4000)});
  return out;
}
function surfaceForContentPath(path=''){
  if(/faq/i.test(path))return 'FAQ';
  if(/cta/i.test(path))return 'CTA';
  if(/menu|price|pricing/i.test(path))return 'MENU_COPY';
  if(/service|product|benefit|stats?/i.test(path))return 'PRODUCT_COPY';
  if(/alt/i.test(path))return 'ALT_TEXT';
  if(/headline|subheadline|body/i.test(path))return 'SECTION_COPY';
  return 'MICROCOPY';
}

export function deriveMissionExistingContentFacts(mission={}){
  const leaves=flattenStrings(mission.existing_content||{});
  return leaves.map((leaf,index)=>normalizeContentFact({
    fact_id:'mission-content-'+String(index+1),
    field_path:'existing_content.'+leaf.path,
    surface:surfaceForContentPath(leaf.path),
    value:leaf.value,
    fact_state:'CONFIRMED',
    source_refs:['website_mission.existing_content'],
    confidence:1,
    project_scope:mission.project_scope_key||mission.project_slug||null
  },index));
}

function factualPath(path=''){
  return /(price|pricing|phone|email|address|opening|hours|rating|review|testimonial|award|certif|founded|year|stat|product|menu|service|offer|location|contact)/i.test(path);
}
function valueCovered(value,facts){
  const n=normalize(value);
  return facts.some(f=>f.renderable&&(normalize(f.value)===n||normalize(f.value).includes(n)||n.includes(normalize(f.value))));
}

export function createEvidenceSafeContentContract(input={}){
  const missionFacts=deriveMissionContentFacts(input.mission||{});
  const missionContentFacts=deriveMissionExistingContentFacts(input.mission||{});
  const localFacts=deriveLocalBusinessContentFacts(input.local_business_data||{},input.project_scope||input.mission?.project_scope_key||input.mission?.project_slug||null);
  const explicit=arr(input.claims||input.content_claims).map((raw,index)=>normalizeContentFact(raw,index+missionFacts.length));
  const facts=[...missionFacts,...missionContentFacts,...localFacts,...explicit];
  const issues=facts.flatMap(f=>f.issues.map(issue=>({...issue,fact_id:f.fact_id})));
  const attempted=new Set(arr(input.attempted_render_claim_ids).map(v=>text(v,180)));
  for(const fact of facts){
    if(attempted.has(fact.fact_id)&&!fact.renderable){
      issues.push({code:fact.fact_state==='PROHIBITED'?'PROHIBITED_FACT_RENDER_ATTEMPT':'UNCONFIRMED_FACT_RENDER_ATTEMPT',severity:'BLOCK',fact_id:fact.fact_id});
    }
  }
  const suppliedLeaves=flattenStrings(input.content||{});
  for(const leaf of suppliedLeaves.filter(x=>factualPath(x.path))){
    if(!valueCovered(leaf.value,facts))issues.push({code:'FACTUAL_CONTENT_EVIDENCE_MISSING',severity:'BLOCK',field_path:leaf.path,value:leaf.value.slice(0,240)});
  }
  const renderable=facts.filter(f=>f.renderable);
  const bySurface=Object.fromEntries(CONTENT_SURFACES.map(surface=>[surface,renderable.filter(f=>f.surface===surface).map(f=>f.fact_id)]));
  return{
    schema:'riosystems.evidence-safe-content-contract.v2',
    project_scope:text(input.project_scope||input.mission?.project_scope_key||input.mission?.project_slug,320)||null,
    fact_states:[...CONTENT_FACT_STATES],
    content_surfaces:[...CONTENT_SURFACES],
    facts,
    renderable_fact_ids:renderable.map(f=>f.fact_id),
    confirmed_fact_ids:facts.filter(f=>f.fact_state==='CONFIRMED'&&f.renderable).map(f=>f.fact_id),
    derived_safe_fact_ids:facts.filter(f=>f.fact_state==='DERIVED_SAFE'&&f.renderable).map(f=>f.fact_id),
    needs_confirmation_fact_ids:facts.filter(f=>f.fact_state==='NEEDS_CONFIRMATION').map(f=>f.fact_id),
    prohibited_fact_ids:facts.filter(f=>f.fact_state==='PROHIBITED').map(f=>f.fact_id),
    generation_inputs_by_surface:bySurface,
    policy:{
      prohibited_rendering_allowed:false,
      needs_confirmation_rendering_allowed:false,
      derived_safe_rendering_allowed:true,
      confirmed_rendering_allowed:true,
      every_renderable_fact_requires_source:true,
      every_renderable_fact_requires_confidence:true,
      schema_requires_confirmed_fact:true
    },
    issues,
    blocking_issues:issues.filter(i=>i.severity==='BLOCK'),
    status:issues.some(i=>i.severity==='BLOCK')?'BLOCK':'PASS',
    production_deploy:false
  };
}

function htmlCorpus(artifact={}){
  return normalize(Object.entries(artifact.files||{}).filter(([name])=>/\.html?$/i.test(name)).map(([,value])=>String(value)).join('\n'));
}

export function runContentRenderGuard(artifact={},contract={}){
  const corpus=htmlCorpus(artifact);
  const issues=[];
  for(const fact of arr(contract.facts)){
    if(!fact.value)continue;
    const needle=normalize(fact.value);
    if(needle.length<3)continue;
    const rendered=corpus.includes(needle);
    if(rendered&&fact.fact_state==='PROHIBITED')issues.push({code:'PROHIBITED_FACT_RENDERED',severity:'BLOCK',fact_id:fact.fact_id});
    if(rendered&&fact.fact_state==='NEEDS_CONFIRMATION')issues.push({code:'UNCONFIRMED_FACT_RENDERED',severity:'BLOCK',fact_id:fact.fact_id});
    if(rendered&&safeStates.has(fact.fact_state)&&!fact.source_refs?.length)issues.push({code:'RENDERED_FACT_SOURCE_MISSING',severity:'BLOCK',fact_id:fact.fact_id});
  }
  return{
    schema:'riosystems.content-render-guard.v2',
    status:issues.length?'BLOCK':'PASS',
    issues,
    blocking_issues:issues,
    checked_html_files:Object.keys(artifact.files||{}).filter(name=>/\.html?$/i.test(name)).length,
    prohibited_rendering_allowed:false,
    production_deploy:false
  };
}

function confirmedValue(facts,patterns){
  const found=arr(facts).find(f=>f.schema_eligible&&patterns.some(pattern=>pattern.test(String(f.field_path||''))));
  return found?.value||null;
}
function baseUrl(mission={}){
  const raw=text(mission.existing_domain||mission.website_url,500).replace(/\/+$/,'');
  if(/^https:\/\/[a-z0-9.-]+(?::\d+)?(?:\/.*)?$/i.test(raw))return raw;
  return 'https://preview.invalid/'+text(mission.project_slug||'website',120);
}
function localIndustry(mission={}){
  return /local|bakery|bäckerei|restaurant|gelateria|gelato|eisdiele|ice cream|dentist|real estate|hospitality/i.test(String(mission.industry||''));
}
function safeRedirects(input=[]){
  const issues=[];const redirects=[];
  for(const [index,item] of arr(input).entries()){
    const from=text(item?.from||item?.source,300),to=text(item?.to||item?.target,300);
    const status=Number(item?.status||301);
    if(!from.startsWith('/')||!to.startsWith('/')){issues.push({code:'REDIRECT_PATH_INVALID',severity:'BLOCK',index});continue;}
    if(![301,302].includes(status)){issues.push({code:'REDIRECT_STATUS_INVALID',severity:'BLOCK',index,status});continue;}
    if(from===to){issues.push({code:'REDIRECT_LOOP',severity:'BLOCK',index,from});continue;}
    redirects.push({from,to,status});
  }
  return{redirects,issues};
}
function xmlEscape(v){return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function htmlEscape(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

export function createSeoEvidenceBundle(input={}){
  const mission=input.mission||{};
  const contentContract=input.content_contract||createEvidenceSafeContentContract({mission,claims:input.claims||input.content_claims,content:input.content});
  const architecture=input.architecture||{site_map:[],internal_links:[],navigation:[]};
  const seo=input.seo||createSeoArchitecture(input.page_intents||[],mission,architecture);
  const technical=runTechnicalSeoQa(seo,architecture,{environment:input.environment||'staging'});
  const facts=contentContract.facts||[];
  const confirmed=facts.filter(f=>f.schema_eligible);
  const confirmedField=(patterns)=>confirmedValue(confirmed,patterns);
  const name=confirmedField([/business_name$/i,/name$/i])||mission.business_name||null;
  const address=confirmedField([/address/i])||null;
  const phone=confirmedField([/phone|telephone/i])||null;
  const email=confirmedField([/email/i])||null;
  const openingHours=confirmedField([/opening.*hours|hours/i])||null;
  const url=baseUrl(mission);

  const organization=createStructuredDataContract('Organization',{
    name:confirmedField([/business_name$/i])||mission.business_name||null,
    url,
    areaServed:confirmedField([/seo_location/i])||null
  });
  const localData=localIndustry(mission)?createStructuredDataContract('LocalBusiness',{
    name,
    address,
    telephone:phone,
    email,
    openingHours,
    url
  }):{schema:'riosystems.structured-data-contract.v2',status:'NOT_APPLICABLE',type:'LocalBusiness',fields:{},fabricated_values_allowed:false};
  const localSeo=createLocalSeoContract(mission,{name,address,opening_hours:openingHours,contact:phone||email||confirmedField([/business\.contact|contact$/i])||null,service_area:confirmedField([/service_area|seo_location/i])||null});

  const napIssues=[];
  for(const occurrence of arr(input.nap_occurrences)){
    if(name&&occurrence.name&&normalize(occurrence.name)!==normalize(name))napIssues.push({code:'NAP_NAME_MISMATCH',severity:'BLOCK',page_id:occurrence.page_id||null});
    if(address&&occurrence.address&&normalize(occurrence.address)!==normalize(address))napIssues.push({code:'NAP_ADDRESS_MISMATCH',severity:'BLOCK',page_id:occurrence.page_id||null});
    if(phone&&occurrence.phone&&normalize(occurrence.phone)!==normalize(phone))napIssues.push({code:'NAP_PHONE_MISMATCH',severity:'BLOCK',page_id:occurrence.page_id||null});
  }
  const redirects=safeRedirects(input.redirects);
  const issues=[
    ...arr(technical.blocking_issues),
    ...napIssues,
    ...redirects.issues
  ];
  if(localIndustry(mission)&&localData.status==='READY'){
    const badFields=Object.keys(localData.fields||{}).filter(key=>{
      if(['url'].includes(key))return false;
      const val=localData.fields[key];
      if(val===null||val===undefined||val==='')return false;
      return !confirmed.some(f=>normalize(f.value)===normalize(val));
    });
    if(badFields.length)issues.push({code:'STRUCTURED_DATA_UNCONFIRMED_FIELD',severity:'BLOCK',fields:badFields});
  }

  const indexable=arr(seo.pages).filter(p=>p.indexing_rule!=='noindex').map(p=>p.canonical_intent);
  const base=baseUrl(mission);
  const sitemapUrls=[...new Set(indexable.map(p=>base+(p==='/'?'/':p)))];
  return{
    schema:'riosystems.seo-evidence-bundle.v2',
    project_scope:contentContract.project_scope,
    technical,
    metadata:{
      titles:arr(seo.pages).map(p=>({page_id:p.page_id,title:p.title})),
      descriptions:arr(seo.pages).map(p=>({page_id:p.page_id,description:p.description})),
      canonicals:arr(seo.pages).map(p=>({page_id:p.page_id,canonical:p.canonical_intent})),
      headings:arr(seo.pages).map(p=>({page_id:p.page_id,...p.heading_hierarchy})),
      internal_links:arr(architecture.internal_links)
    },
    alt_text_policy:{meaningful_images_require_alt:true,decorative_images_empty_alt:true,factual_alt_text_requires_safe_fact:true},
    sitemap:{status:'READY',urls:sitemapUrls},
    robots:{environment:input.environment||'staging',policy:(input.environment||'staging')==='staging'?'noindex_disallow_all':'production_policy_required'},
    not_found:{path:'/404.html',required:true},
    redirects,
    structured_data:{Organization:organization,LocalBusiness:localData,confirmed_facts_only:true},
    local_seo:localSeo,
    nap_integrity:{status:napIssues.length?'BLOCK':'PASS',canonical:{name,address,phone,email,opening_hours:openingHours},issues:napIssues},
    schema_confirmed_facts_only:true,
    issues,
    blocking_issues:issues.filter(i=>i.severity==='BLOCK'||i.severity==='blocking'),
    status:issues.length?'BLOCK':'PASS',
    production_deploy:false
  };
}

export function applySeoStaticArtifacts(build={},bundle={},input={}){
  if(!build?.artifact?.project_root||!build?.artifact?.files)return{ok:false,status:'BUILD_ARTIFACT_REQUIRED',production_deploy:false};
  const root=build.artifact.project_root;
  const base=text(input.base_url,500)||'https://preview.invalid/'+text(build.artifact.project?.slug||'website',120);
  const robots=bundle.robots?.policy==='noindex_disallow_all'?'User-agent: *\nDisallow: /\n':'User-agent: *\nDisallow:\n';
  const sitemap='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+
    arr(bundle.sitemap?.urls).map(url=>'  <url><loc>'+xmlEscape(url||base)+'</loc></url>').join('\n')+'\n</urlset>\n';
  const notFound='<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><title>404</title></head><body><main><h1>Seite nicht gefunden</h1><p>Die angeforderte Seite ist nicht verfügbar.</p><a href="/">Zur Startseite</a></main></body></html>';
  const redirects=arr(bundle.redirects?.redirects).map(r=>r.from+' '+r.to+' '+r.status).join('\n')+(arr(bundle.redirects?.redirects).length?'\n':'');
  build.artifact.files[root+'/robots.txt']=robots;
  build.artifact.files[root+'/sitemap.xml']=sitemap;
  build.artifact.files[root+'/404.html']=notFound;
  build.artifact.files[root+'/_redirects']=redirects;
  return{ok:true,status:'SEO_STATIC_ARTIFACTS_APPLIED',files:['robots.txt','sitemap.xml','404.html','_redirects'],production_deploy:false};
}

export function contentSeoEvidenceManifest(){
  return{
    schema:'riosystems.content-seo-evidence-manifest.v2',
    fact_states:[...CONTENT_FACT_STATES],
    content_surfaces:[...CONTENT_SURFACES],
    content_rules:['source_required','confidence_required','prohibited_never_render','needs_confirmation_never_render'],
    seo_rules:['title','meta_description','canonical','heading','internal_links','alt_text','sitemap','robots','404','redirects','structured_data','local_seo','nap_integrity'],
    schema_confirmed_facts_only:true,
    existing_seo_engine_reused:true,
    existing_project_content_rights_qa_reused:true,
    production_deploy:false
  };
}
