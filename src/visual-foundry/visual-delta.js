import crypto from 'node:crypto';

export const VISUAL_DELTA_CATEGORIES=Object.freeze(['STRUCTURE','GEOMETRY','TYPOGRAPHY','COLOR','EFFECT','ASSET','CONTENT','RESPONSIVE']);
export const VISUAL_DELTA_SEVERITIES=Object.freeze(['INFO','LOW','MEDIUM','HIGH','CRITICAL']);

const clean=(v,max=1000)=>String(v??'').trim().slice(0,max);
const clone=v=>structuredClone(v);

function severityRank(value){return VISUAL_DELTA_SEVERITIES.indexOf(String(value));}
function category(value){
  const v=clean(value,40).toUpperCase();
  if(!VISUAL_DELTA_CATEGORIES.includes(v))throw new Error('VISUAL_DELTA_CATEGORY_INVALID');
  return v;
}
function severity(value){
  const v=clean(value,40).toUpperCase();
  if(!VISUAL_DELTA_SEVERITIES.includes(v))throw new Error('VISUAL_DELTA_SEVERITY_INVALID');
  return v;
}
function viewport(input={}){
  const width=Number(input.width),height=Number(input.height),dpr=Number(input.device_pixel_ratio??1);
  if(!Number.isInteger(width)||width<320||width>4096)throw new Error('VISUAL_DELTA_VIEWPORT_WIDTH_INVALID');
  if(!Number.isInteger(height)||height<320||height>4096)throw new Error('VISUAL_DELTA_VIEWPORT_HEIGHT_INVALID');
  if(!Number.isFinite(dpr)||dpr<1||dpr>4)throw new Error('VISUAL_DELTA_DPR_INVALID');
  return {width,height,device_pixel_ratio:dpr};
}

export function createVisualDelta(input={}){
  const referenceId=clean(input.reference_id,180);
  const commit=clean(input.implementation_commit,180);
  if(!referenceId)throw new Error('VISUAL_DELTA_REFERENCE_ID_REQUIRED');
  if(!commit)throw new Error('VISUAL_DELTA_IMPLEMENTATION_COMMIT_REQUIRED');
  const cat=category(input.category);
  const sev=severity(input.severity||'MEDIUM');
  const blocking=input.blocking===true||sev==='CRITICAL';
  return {
    schema:'riosystems.visual-delta.v1',
    delta_id:clean(input.delta_id||'vd-'+crypto.randomUUID(),180),
    reference_id:referenceId,
    implementation_commit:commit,
    viewport:viewport(input.viewport),
    region:input.region?clean(input.region,180):null,
    component_id:input.component_id?clean(input.component_id,180):null,
    category:cat,
    severity:sev,
    expected:clone(input.expected??null),
    actual:clone(input.actual??null),
    difference:clone(input.difference??null),
    unit:clean(input.unit||'none',40),
    score:Number.isFinite(Number(input.score))?Number(input.score):null,
    blocking,
    evidence:clone(input.evidence??{}),
    repair_hint:input.repair_hint?clean(input.repair_hint,1200):null
  };
}

export function validateVisualDelta(delta={}){
  const issues=[];
  if(delta.schema!=='riosystems.visual-delta.v1')issues.push('VISUAL_DELTA_SCHEMA_INVALID');
  if(!clean(delta.delta_id,180))issues.push('VISUAL_DELTA_ID_REQUIRED');
  if(!clean(delta.reference_id,180))issues.push('VISUAL_DELTA_REFERENCE_ID_REQUIRED');
  if(!clean(delta.implementation_commit,180))issues.push('VISUAL_DELTA_IMPLEMENTATION_COMMIT_REQUIRED');
  try{viewport(delta.viewport)}catch(e){issues.push(String(e.message||e));}
  if(!VISUAL_DELTA_CATEGORIES.includes(String(delta.category)))issues.push('VISUAL_DELTA_CATEGORY_INVALID');
  if(!VISUAL_DELTA_SEVERITIES.includes(String(delta.severity)))issues.push('VISUAL_DELTA_SEVERITY_INVALID');
  if(typeof delta.blocking!=='boolean')issues.push('VISUAL_DELTA_BLOCKING_INVALID');
  if(delta.severity==='CRITICAL'&&delta.blocking!==true)issues.push('CRITICAL_DELTA_MUST_BLOCK');
  return {ok:issues.length===0,issues:[...new Set(issues)]};
}

function classifyScore(score,thresholds={}){
  const critical=Number(thresholds.critical??0.75);
  const high=Number(thresholds.high??0.9);
  const medium=Number(thresholds.medium??0.96);
  const low=Number(thresholds.low??0.985);
  if(score<critical)return 'CRITICAL';
  if(score<high)return 'HIGH';
  if(score<medium)return 'MEDIUM';
  if(score<low)return 'LOW';
  return 'INFO';
}

function pixelSimilarity(report){return 1-Math.min(1,Number(report?.pixel_difference?.ratio??1));}

export function deltasFromVisualMeasurement(input={}){
  const report=input.measurement_report;
  if(!report||report.schema!=='riosystems.visual-measurement-report.v1')throw new Error('VISUAL_MEASUREMENT_REPORT_REQUIRED');
  const common={reference_id:input.reference_id,implementation_commit:input.implementation_commit,viewport:input.viewport};
  const deltas=[];

  if(report.geometry?.dimensions_equal!==true){
    deltas.push(createVisualDelta({...common,category:'GEOMETRY',severity:'CRITICAL',expected:report.geometry?.reference,actual:report.geometry?.actual,difference:'DIMENSION_MISMATCH',unit:'px',score:0,blocking:true,evidence:{measurement:'image_dimensions'},repair_hint:'Align screenshot viewport and rendered page dimensions before further visual comparison.'}));
    return deltas;
  }

  const metrics=[
    {category:'STRUCTURE',name:'perceptual_ssim',score:Number(report.perceptual?.score),expected:1,actual:Number(report.perceptual?.score),unit:'ratio'},
    {category:'COLOR',name:'color_similarity',score:Number(report.color?.score),expected:1,actual:Number(report.color?.score),unit:'ratio'},
    {category:'STRUCTURE',name:'edge_similarity',score:Number(report.edge?.score),expected:1,actual:Number(report.edge?.score),unit:'ratio'},
    {category:'STRUCTURE',name:'pixel_similarity',score:pixelSimilarity(report),expected:1,actual:pixelSimilarity(report),unit:'ratio'}
  ];
  for(const metric of metrics){
    if(!Number.isFinite(metric.score)||metric.score>=Number(input.ignore_score_above??0.999999))continue;
    const sev=classifyScore(metric.score,input.severity_thresholds);
    deltas.push(createVisualDelta({...common,category:metric.category,severity:sev,expected:metric.expected,actual:metric.actual,difference:1-metric.score,unit:metric.unit,score:metric.score,blocking:severityRank(sev)>=severityRank('HIGH'),evidence:{measurement:metric.name},repair_hint:null}));
  }

  for(const region of report.regions||[]){
    const score=Math.min(Number(region.perceptual_score??1),1-Number(region.pixel_difference_ratio??0));
    if(!Number.isFinite(score)||score>=Number(input.ignore_score_above??0.999999))continue;
    let sev=classifyScore(score,input.severity_thresholds);
    if(region.critical===true&&severityRank(sev)<severityRank('HIGH'))sev='HIGH';
    deltas.push(createVisualDelta({...common,region:region.region_id,category:'STRUCTURE',severity:sev,expected:{perceptual_score:1,pixel_difference_ratio:0},actual:{perceptual_score:region.perceptual_score,pixel_difference_ratio:region.pixel_difference_ratio},difference:{perceptual:1-Number(region.perceptual_score??0),pixel:Number(region.pixel_difference_ratio??0)},unit:'ratio',score,blocking:region.critical===true||severityRank(sev)>=severityRank('HIGH'),evidence:{measurement:'region_comparison',bounds:region.bounds},repair_hint:region.critical===true?'Repair this critical region before global acceptance.':null}));
  }
  return deltas;
}

export function deltasFromGeometryComparison(input={}){
  const report=input.geometry_report;
  if(!report||report.schema!=='riosystems.geometry-comparison.v1')throw new Error('GEOMETRY_COMPARISON_REPORT_REQUIRED');
  const deltas=[];
  for(const component of report.components||[]){
    if(component.status==='MISSING'){
      deltas.push(createVisualDelta({reference_id:input.reference_id,implementation_commit:input.implementation_commit,viewport:input.viewport,component_id:component.component_id,category:'STRUCTURE',severity:'CRITICAL',expected:'PRESENT',actual:'MISSING',difference:'MISSING_COMPONENT',unit:'none',score:0,blocking:true,evidence:{measurement:'dom_geometry'},repair_hint:'Restore the missing visual component with its stable data-visual-id.'}));
      continue;
    }
    for(const [metric,detail] of Object.entries(component.deltas||{})){
      if(detail.pass)continue;
      const ratio=Math.min(1,Number(detail.difference||0)/Math.max(1,Math.abs(Number(detail.expected||0))));
      const sev=ratio>=0.25?'CRITICAL':ratio>=0.1?'HIGH':ratio>=0.04?'MEDIUM':'LOW';
      deltas.push(createVisualDelta({reference_id:input.reference_id,implementation_commit:input.implementation_commit,viewport:input.viewport,component_id:component.component_id,category:'GEOMETRY',severity:sev,expected:detail.expected,actual:detail.actual,difference:detail.difference,unit:'px',score:component.score,blocking:sev==='CRITICAL'||sev==='HIGH',evidence:{measurement:'dom_geometry',metric,tolerance:detail.tolerance},repair_hint:`Adjust ${component.component_id} ${metric} toward reference within tolerance.`}));
    }
  }
  return deltas;
}
