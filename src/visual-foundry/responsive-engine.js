const clean=(v,max=500)=>String(v??'').trim().slice(0,max);
const clone=v=>structuredClone(v);

export const RESPONSIVE_MODES=Object.freeze(['EXPLICIT_REFERENCE','INFERRED_RESPONSIVE']);

function viewportKey(viewport={}){
  const width=Number(viewport.width),height=Number(viewport.height),dpr=Number(viewport.device_pixel_ratio??1);
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<320||height<320) throw new Error('RESPONSIVE_VIEWPORT_INVALID');
  return `${width}x${height}@${dpr}`;
}

export function createResponsiveReferenceSet(records=[]){
  const approved=(Array.isArray(records)?records:[]).filter(r=>r?.schema==='riosystems.reference-record.v1'&&r.status==='APPROVED');
  const byViewport={};
  for(const record of approved){
    const key=viewportKey(record.viewport);
    if(byViewport[key]) throw new Error('RESPONSIVE_APPROVED_REFERENCE_AMBIGUOUS:'+key);
    byViewport[key]={reference_id:record.reference_id,version:record.version,viewport:clone(record.viewport),hash:record.hash};
  }
  return {schema:'riosystems.responsive-reference-set.v1',references:byViewport,approved_reference_count:Object.keys(byViewport).length};
}

export function resolveResponsiveMode(referenceSet={},viewport={}){
  const key=viewportKey(viewport);
  const reference=referenceSet.references?.[key]||null;
  return reference
    ? {mode:'EXPLICIT_REFERENCE',reference:clone(reference),viewport_key:key}
    : {mode:'INFERRED_RESPONSIVE',reference:null,viewport_key:key};
}

export function evaluateResponsiveViewport(input={}){
  const resolved=resolveResponsiveMode(input.reference_set||{},input.viewport);
  if(resolved.mode==='EXPLICIT_REFERENCE'){
    const visual=input.visual_acceptance;
    if(!visual||visual.schema!=='riosystems.visual-acceptance.v1'){
      return {schema:'riosystems.responsive-viewport-result.v1',mode:'EXPLICIT_REFERENCE',status:'NOT_EVALUATED',claim:'REFERENCE_COMPARISON_REQUIRED',viewport:clone(input.viewport),reference:resolved.reference,critical_deltas:null};
    }
    const critical=Number(visual.responsive_critical_delta_count??visual.critical_delta_count??0);
    const pass=visual.status==='PASS'&&critical===0;
    return {
      schema:'riosystems.responsive-viewport-result.v1',
      mode:'EXPLICIT_REFERENCE',
      status:pass?'REFERENCE_MATCH_PASS':'REFERENCE_MATCH_FAIL',
      claim:'REFERENCE_MATCH',
      viewport:clone(input.viewport),
      reference:resolved.reference,
      visual_acceptance:visual.status,
      critical_deltas:critical
    };
  }

  const metrics=input.inferred_metrics||{};
  const overflow=Number(metrics.horizontal_overflow_px??Infinity);
  const critical=Number(metrics.critical_responsive_deltas??0);
  const essential=metrics.essential_content_visible===true;
  const nav=metrics.primary_navigation_usable===true;
  const interaction=metrics.primary_actions_usable===true;
  const evaluated=Number.isFinite(overflow)&&typeof metrics.essential_content_visible==='boolean'&&typeof metrics.primary_navigation_usable==='boolean'&&typeof metrics.primary_actions_usable==='boolean';
  if(!evaluated){
    return {schema:'riosystems.responsive-viewport-result.v1',mode:'INFERRED_RESPONSIVE',status:'NOT_EVALUATED',claim:'NO_REFERENCE_MATCH_CLAIM',viewport:clone(input.viewport),reference:null};
  }
  const pass=overflow<=0&&critical===0&&essential&&nav&&interaction;
  return {
    schema:'riosystems.responsive-viewport-result.v1',
    mode:'INFERRED_RESPONSIVE',
    status:pass?'INFERRED_RESPONSIVE_PASS':'INFERRED_RESPONSIVE_FAIL',
    claim:'NO_REFERENCE_MATCH_CLAIM',
    viewport:clone(input.viewport),
    reference:null,
    horizontal_overflow_px:overflow,
    critical_deltas:critical,
    essential_content_visible:essential,
    primary_navigation_usable:nav,
    primary_actions_usable:interaction
  };
}

export function aggregateResponsiveAcceptance(results=[]){
  const items=Array.isArray(results)?results.map(clone):[];
  if(!items.length) return {schema:'riosystems.responsive-acceptance.v1',status:'NOT_EVALUATED',results:[],explicit_reference_count:0,inferred_count:0};
  const failed=items.filter(x=>['REFERENCE_MATCH_FAIL','INFERRED_RESPONSIVE_FAIL'].includes(x.status));
  const pending=items.filter(x=>x.status==='NOT_EVALUATED');
  const status=failed.length?'FAIL':pending.length?'NOT_EVALUATED':'PASS';
  return {
    schema:'riosystems.responsive-acceptance.v1',
    status,
    results:items,
    explicit_reference_count:items.filter(x=>x.mode==='EXPLICIT_REFERENCE').length,
    inferred_count:items.filter(x=>x.mode==='INFERRED_RESPONSIVE').length,
    reference_match_claims:items.filter(x=>x.claim==='REFERENCE_MATCH').map(x=>viewportKey(x.viewport)),
    inferred_passes:items.filter(x=>x.status==='INFERRED_RESPONSIVE_PASS').map(x=>viewportKey(x.viewport)),
    mobile_without_reference_never_claims_match:true
  };
}
