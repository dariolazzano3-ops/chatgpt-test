export const ACCEPTANCE_STATUS=Object.freeze({
  PASS:'PASS',
  FAIL:'FAIL',
  NOT_EVALUATED:'NOT_EVALUATED'
});

export const DEFAULT_VISUAL_THRESHOLDS=Object.freeze({
  structural_score_min:1,
  geometry_score_min:0.97,
  perceptual_score_min:0.96,
  pixel_difference_percent_max:3,
  typography_score_min:0.97,
  color_score_min:0.97,
  critical_delta_count_max:0,
  blocking_delta_count_max:0,
  responsive_critical_delta_count_max:0
});

const round=(v,d=6)=>{const f=10**d;return Math.round(Number(v||0)*f)/f;};
const finite=v=>Number.isFinite(Number(v))?Number(v):null;
const normStatus=v=>{
  const s=String(v||'NOT_EVALUATED').toUpperCase();
  return ['PASS','FAIL','NOT_EVALUATED'].includes(s)?s:'NOT_EVALUATED';
};

export function resolveVisualThresholds(input={}){
  const out={...DEFAULT_VISUAL_THRESHOLDS};
  for(const [key,value] of Object.entries(input||{})){
    if(!Object.prototype.hasOwnProperty.call(out,key))continue;
    const n=Number(value);
    if(!Number.isFinite(n)||n<0)throw new Error('VISUAL_THRESHOLD_INVALID:'+key);
    out[key]=n;
  }
  return out;
}

function countDeltas(deltas=[]){
  return {
    critical:deltas.filter(x=>x?.severity==='CRITICAL').length,
    blocking:deltas.filter(x=>x?.blocking===true).length,
    responsive_critical:deltas.filter(x=>x?.category==='RESPONSIVE'&&x?.severity==='CRITICAL').length
  };
}

export function evaluateVisualAcceptance(input={}){
  const measurement=input.measurement_report;
  const geometry=input.geometry_report;
  const deltas=Array.isArray(input.deltas)?input.deltas:[];
  const thresholds=resolveVisualThresholds(input.thresholds);
  const counts=countDeltas(deltas);

  if(!measurement||measurement.schema!=='riosystems.visual-measurement-report.v1'){
    return {
      schema:'riosystems.visual-acceptance.v1',
      status:'NOT_EVALUATED',
      reason:'DETERMINISTIC_VISUAL_MEASUREMENT_REQUIRED',
      thresholds,
      structural_score:null,geometry_score:null,perceptual_score:null,pixel_difference:null,
      typography_score:null,color_score:null,critical_delta_count:counts.critical,blocking_delta_count:counts.blocking,
      responsive_critical_delta_count:counts.responsive_critical,
      checks:[],fail_closed:true
    };
  }
  if(measurement.geometry?.dimensions_equal!==true){
    return {
      schema:'riosystems.visual-acceptance.v1',status:'FAIL',reason:'REFERENCE_RUNTIME_DIMENSION_MISMATCH',thresholds,
      structural_score:0,geometry_score:0,perceptual_score:0,pixel_difference:100,
      typography_score:finite(input.typography_score),color_score:finite(measurement.color?.score),
      critical_delta_count:counts.critical,blocking_delta_count:Math.max(1,counts.blocking),
      responsive_critical_delta_count:counts.responsive_critical,checks:[{id:'dimensions_equal',pass:false}],fail_closed:true
    };
  }

  const structural=finite(input.structural_score??measurement.edge?.score);
  const geometryScore=finite(input.geometry_score??geometry?.score);
  const perceptual=finite(measurement.perceptual?.score);
  const pixelPercent=finite(measurement.pixel_difference?.percent);
  const typography=finite(input.typography_score);
  const color=finite(measurement.color?.score);

  const metrics={structural_score:structural,geometry_score:geometryScore,perceptual_score:perceptual,pixel_difference:pixelPercent,typography_score:typography,color_score:color};
  const missing=Object.entries(metrics).filter(([,v])=>v===null).map(([k])=>k);
  if(missing.length){
    return {
      schema:'riosystems.visual-acceptance.v1',status:'NOT_EVALUATED',reason:'REQUIRED_VISUAL_METRICS_MISSING',missing_metrics:missing,thresholds,
      ...metrics,critical_delta_count:counts.critical,blocking_delta_count:counts.blocking,responsive_critical_delta_count:counts.responsive_critical,checks:[],fail_closed:true
    };
  }

  const checks=[
    {id:'structural_score',pass:structural>=thresholds.structural_score_min,actual:structural,required:thresholds.structural_score_min,operator:'>='},
    {id:'geometry_score',pass:geometryScore>=thresholds.geometry_score_min,actual:geometryScore,required:thresholds.geometry_score_min,operator:'>='},
    {id:'perceptual_score',pass:perceptual>=thresholds.perceptual_score_min,actual:perceptual,required:thresholds.perceptual_score_min,operator:'>='},
    {id:'pixel_difference',pass:pixelPercent<=thresholds.pixel_difference_percent_max,actual:pixelPercent,required:thresholds.pixel_difference_percent_max,operator:'<='},
    {id:'typography_score',pass:typography>=thresholds.typography_score_min,actual:typography,required:thresholds.typography_score_min,operator:'>='},
    {id:'color_score',pass:color>=thresholds.color_score_min,actual:color,required:thresholds.color_score_min,operator:'>='},
    {id:'critical_delta_count',pass:counts.critical<=thresholds.critical_delta_count_max,actual:counts.critical,required:thresholds.critical_delta_count_max,operator:'<='},
    {id:'blocking_delta_count',pass:counts.blocking<=thresholds.blocking_delta_count_max,actual:counts.blocking,required:thresholds.blocking_delta_count_max,operator:'<='},
    {id:'responsive_critical_delta_count',pass:counts.responsive_critical<=thresholds.responsive_critical_delta_count_max,actual:counts.responsive_critical,required:thresholds.responsive_critical_delta_count_max,operator:'<='}
  ];
  const failed=checks.filter(x=>!x.pass);
  return {
    schema:'riosystems.visual-acceptance.v1',
    status:failed.length?'FAIL':'PASS',
    reason:failed.length?'VISUAL_THRESHOLDS_NOT_MET':'VISUAL_THRESHOLDS_MET',
    thresholds,
    structural_score:round(structural),
    geometry_score:round(geometryScore),
    perceptual_score:round(perceptual),
    pixel_difference:round(pixelPercent,4),
    typography_score:round(typography),
    color_score:round(color),
    critical_delta_count:counts.critical,
    blocking_delta_count:counts.blocking,
    responsive_critical_delta_count:counts.responsive_critical,
    checks,
    failed_checks:failed.map(x=>x.id),
    critical_region_gate_enforced:true,
    fail_closed:true
  };
}

export function buildAcceptanceEnvelope(input={}){
  const visual=input.visual_acceptance?.schema==='riosystems.visual-acceptance.v1'
    ? input.visual_acceptance
    : evaluateVisualAcceptance(input);
  const functional=normStatus(input.functional_acceptance);
  const responsive=normStatus(input.responsive_acceptance);
  const accessibility=normStatus(input.accessibility_acceptance);
  const human=normStatus(input.human_visual_approval);
  const machine=[functional,visual.status,responsive,accessibility];
  const machineReady=machine.every(x=>x==='PASS');
  const overall=machineReady&&human==='PASS'?'PASS':machine.includes('FAIL')||human==='FAIL'?'FAIL':'NOT_EVALUATED';
  return {
    schema:'riosystems.acceptance-envelope.v1',
    functional_acceptance:functional,
    visual_acceptance:visual.status,
    responsive_acceptance:responsive,
    accessibility_acceptance:accessibility,
    human_visual_approval:human,
    visual_report:visual,
    machine_ready_for_human:machineReady,
    overall_status:overall,
    acceptance_independence:true,
    functional_pass_implies_visual_pass:false
  };
}
