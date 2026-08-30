import { runTechnicalSeoQa } from './seo-quality-v2.js';
import { runResponsiveQa, repairResponsiveModel, runAccessibilityQa, repairAccessibilityModel, runPerformanceQa } from './seo-quality-v2.js';

const arr=(v)=>Array.isArray(v)?v:[];
const clone=(v)=>v==null?v:structuredClone(v);

export const REPAIR_PRIORITY = Object.freeze(['BLOCKING_TECHNICAL','SECURITY','ACCESSIBILITY','BROKEN_RESPONSIVE','SEO','CRO','VISUAL_POLISH']);

export function createRepairPriorityPlan(input = {}) {
  const buckets={ BLOCKING_TECHNICAL:[], SECURITY:[], ACCESSIBILITY:[], BROKEN_RESPONSIVE:[], SEO:[], CRO:[], VISUAL_POLISH:[] };
  for(const issue of arr(input.technical?.blocking_issues||input.technical?.issues)) buckets.BLOCKING_TECHNICAL.push(issue);
  for(const issue of arr(input.security?.issues)) buckets.SECURITY.push(issue);
  for(const issue of arr(input.accessibility?.issues)) buckets.ACCESSIBILITY.push(issue);
  for(const issue of arr(input.responsive?.issues)) buckets.BROKEN_RESPONSIVE.push(issue);
  for(const issue of arr(input.seo?.issues)) buckets.SEO.push(issue);
  for(const issue of arr(input.cro?.blocking_issues||input.cro?.issues)) buckets.CRO.push(issue);
  for(const issue of arr(input.visual?.blocking_issues||input.visual?.warnings)) buckets.VISUAL_POLISH.push(issue);
  return { schema:'riosystems.web-repair-priority.v2', order:[...REPAIR_PRIORITY], buckets, next:REPAIR_PRIORITY.find((key)=>buckets[key].length)||null, infinite_loop_allowed:false };
}

function safeSeoRepair(seo, architecture) {
  const next=clone(seo); const history=[]; let qa=runTechnicalSeoQa(next,architecture,{environment:'staging'});
  for(const issue of qa.issues){
    const page=arr(next.pages).find((p)=>p.page_id===issue.page_id); if(!page||issue.repairable!==true) continue;
    const before=clone(page);
    if(issue.code==='MISSING_TITLE') page.title=`${page.page_id} | Website`;
    if(issue.code==='DUPLICATE_TITLE') page.title=`${page.page_id} | Website`;
    if(issue.code==='MISSING_DESCRIPTION') page.description=`Information about ${page.page_id}`;
    if(issue.code==='H1_COUNT_INVALID') page.heading_hierarchy={...(page.heading_hierarchy||{}),h1_count:1,ordered:true};
    if(issue.code==='BROKEN_CANONICAL_INTENT') page.canonical_intent=page.page_id==='home'?'/':`/${page.page_id}/`;
    if(issue.code==='BROKEN_INTERNAL_LINK') page.internal_links=arr(page.internal_links).filter((l)=>l.to!==issue.target);
    if(issue.code==='STAGING_NOINDEX_MISTAKE') page.indexing_rule='staging_noindex';
    history.push({category:'SEO',issue:issue.code,page_id:page.page_id,before_state:before,after_state:clone(page),deterministic:true});
  }
  qa=runTechnicalSeoQa(next,architecture,{environment:'staging'});
  return { model:next, qa, history };
}

function performanceRepair(model={}) {
  const next=clone(model); const history=[]; const before=clone(next); let changed=false;
  if(arr(next.images).some((i)=>i.above_fold!==true&&i.lazy!==true)){ next.images=arr(next.images).map((i)=>i.above_fold===true?i:{...i,lazy:true});changed=true; }
  if(next.duplicate_assets===true){next.duplicate_assets=false;changed=true;}
  if(changed) history.push({category:'PERFORMANCE',before_state:before,after_state:clone(next),deterministic:true});
  return { model:next, qa:runPerformanceQa(next), history };
}

export function runGeneralSelfHealingWebsiteLoop(input = {}, options = {}) {
  const maxAttempts=Math.min(5,Math.max(1,Number(options.max_attempts??3)));
  let seo=clone(input.seo||{}), responsive=clone(input.responsive_model||{}), accessibility=clone(input.accessibility_model||{}), performance=clone(input.performance_model||{});
  const history=[]; let last=null;
  for(let attempt=1;attempt<=maxAttempts;attempt++){
    const technical=input.technical_QA||{status:'PASS',issues:[],blocking_issues:[]};
    const seoQa=runTechnicalSeoQa(seo,input.architecture||{}, {environment:'staging'});
    const responsiveQa=runResponsiveQa(responsive); const accessibilityQa=runAccessibilityQa(accessibility); const performanceQa=runPerformanceQa(performance);
    const priority=createRepairPriorityPlan({technical,security:input.security_QA,accessibility:accessibilityQa,responsive:responsiveQa,seo:seoQa,cro:input.CRO_QA,visual:input.visual_QA});
    last={technical,seo:seoQa,responsive:responsiveQa,accessibility:accessibilityQa,performance:performanceQa,priority};
    const blocking=[technical.status==='FAIL'||technical.status==='BLOCK',seoQa.status==='BLOCK',responsiveQa.status==='BLOCK',accessibilityQa.status==='BLOCK',performanceQa.status==='BLOCK',input.security_QA?.status==='BLOCK',input.CRO_QA?.status==='BLOCK',input.visual_QA?.status==='BLOCK'].some(Boolean);
    if(!blocking) break;
    const before={seo:clone(seo),responsive:clone(responsive),accessibility:clone(accessibility),performance:clone(performance)};
    const applied=[];
    if(responsiveQa.status==='BLOCK'){const repaired=repairResponsiveModel(responsive,1);responsive=repaired.model;applied.push(...repaired.repair_history.map((r)=>({category:'RESPONSIVE',...r})));}
    if(accessibilityQa.status==='BLOCK'){const repaired=repairAccessibilityModel(accessibility,1);accessibility=repaired.model;applied.push(...repaired.repair_history.map((r)=>({category:'ACCESSIBILITY',...r})));}
    if(seoQa.status==='BLOCK'){const repaired=safeSeoRepair(seo,input.architecture||{});seo=repaired.model;applied.push(...repaired.history);}
    if(performanceQa.status!=='PASS'){const repaired=performanceRepair(performance);performance=repaired.model;applied.push(...repaired.history);}
    history.push({attempt,before_state:before,after_state:{seo:clone(seo),responsive:clone(responsive),accessibility:clone(accessibility),performance:clone(performance)},applied});
    if(!applied.length) break;
  }
  const final={ technical:input.technical_QA||{status:'PASS'}, seo:runTechnicalSeoQa(seo,input.architecture||{}, {environment:'staging'}), responsive:runResponsiveQa(responsive), accessibility:runAccessibilityQa(accessibility), performance:runPerformanceQa(performance), security:input.security_QA||{status:'PASS'}, CRO:input.CRO_QA||{status:'PASS'}, visual:input.visual_QA||{status:'PASS'} };
  const fail=final.technical.status==='FAIL'||final.technical.status==='BLOCK'||final.seo.status==='BLOCK'||final.responsive.status==='BLOCK'||final.accessibility.status==='BLOCK'||final.performance.status==='BLOCK'||final.security.status==='BLOCK'||final.CRO.status==='BLOCK'||final.visual.status==='BLOCK';
  return { schema:'riosystems.general-self-healing-web-loop.v2', status:fail?'BLOCK':'PASS', models:{seo,responsive,accessibility,performance}, final_QA:final, repair_history:history, attempts:history.length, max_attempts:maxAttempts, exhausted:fail&&history.length>=maxAttempts, fail_closed:fail, infinite_loop:false, priority:createRepairPriorityPlan({technical:final.technical,security:final.security,accessibility:final.accessibility,responsive:final.responsive,seo:final.seo,cro:final.CRO,visual:final.visual}) };
}

export function computeWebQualityScore(input = {}) {
  const checks={
    build_valid:['PASS','VERIFIED_WEBSITE_DELIVERABLE','VERIFIED_PREMIUM_WEB_DELIVERABLE','VERIFIED_AUTONOMOUS_PREMIUM_WEB_DELIVERABLE','VERIFIED_WEB_OS_V2_DELIVERABLE'].includes(input.build_status)||input.build_valid===true,
    responsive_valid:input.responsive?.status==='PASS', SEO_valid:['PASS','WARN'].includes(input.SEO?.status), accessibility_valid:input.accessibility?.status==='PASS',
    performance_valid:['PASS','WARN'].includes(input.performance?.status), visual_valid:['PASS','WARN'].includes(input.visual?.status), CRO_valid:input.CRO?.status==='PASS',
    integration_valid:input.integration?.status==='CONTRACTS_READY'||input.integration_valid===true, rights_valid:input.rights?.status==='PASS'||input.rights_valid===true
  };
  const entries=Object.entries(checks); const passed=entries.filter(([,v])=>v).length; const score=Math.round((passed/entries.length)*10000)/100;
  return { schema:'riosystems.web-quality-score.v2', status:passed===entries.length?'PASS':'FAIL', score, basis:'equal aggregation of explicit boolean quality gates only', checks, arbitrary_AI_grade:false, unverified_quality_claims:false };
}

export function createVisualRegressionFixture(reference = {}, generated = {}) {
  return { schema:'riosystems.visual-regression-fixture.v2', mode:'deterministic-structured-snapshot', reference:clone(reference), generated:clone(generated), equal:JSON.stringify(reference)===JSON.stringify(generated), screenshot_runtime_executed:false, pixel_claim:false };
}
