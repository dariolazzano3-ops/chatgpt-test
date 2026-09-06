const clean=(v,max=500)=>String(v??'').trim().slice(0,max);
const clone=v=>structuredClone(v);
const clamp=v=>Math.max(0,Math.min(1,Number(v)||0));

export function createTypographyCalibrationRequest(input={}){
  const role=clean(input.role,120);
  if(!role)throw new Error('TYPOGRAPHY_ROLE_REQUIRED');
  const families=[...new Set((input.families||[]).map(x=>clean(x,240)).filter(Boolean))];
  if(!families.length)throw new Error('TYPOGRAPHY_FAMILIES_REQUIRED');
  const sizes=[...new Set((input.sizes||[]).map(Number).filter(Number.isFinite))];
  const lineHeights=[...new Set((input.line_heights||[]).map(Number).filter(Number.isFinite))];
  const letterSpacing=[...new Set((input.letter_spacing||[]).map(Number).filter(Number.isFinite))];
  const weights=[...new Set((input.weights||[]).map(Number).filter(Number.isFinite))];
  if(!sizes.length||!lineHeights.length||!letterSpacing.length||!weights.length)throw new Error('TYPOGRAPHY_PARAMETER_GRID_REQUIRED');
  return {
    schema:'riosystems.typography-calibration-request.v1',
    role,
    reference_region:clone(input.reference_region||{}),
    identity_status:clean(input.identity_status||'UNRESOLVED_RASTER',80),
    families,sizes,line_heights:lineHeights,letter_spacing:letterSpacing,weights,
    threshold:clamp(input.threshold??0.97),
    max_evaluations:Math.min(512,Math.max(1,Number(input.max_evaluations??256))),
    acceptance_mode:'METRIC_EQUIVALENCE',
    exact_font_identity_claim_allowed:input.identity_status==='KNOWN_REFERENCE_FONT'
  };
}

function candidateGrid(request){
  const out=[];
  for(const family of request.families)
    for(const weight of request.weights)
      for(const size of request.sizes)
        for(const line_height of request.line_heights)
          for(const letter_spacing of request.letter_spacing){
            out.push({family,weight,size,line_height,letter_spacing});
            if(out.length>=request.max_evaluations)return out;
          }
  return out;
}

function composite(result={}){
  const perceptual=clamp(result.perceptual_score);
  const geometry=clamp(result.geometry_score);
  const pixel=clamp(1-Number(result.pixel_difference_percent??100)/100);
  return .5*perceptual+.3*geometry+.2*pixel;
}

export async function resolveTypographyCalibration(request={},adapters={}){
  if(request.schema!=='riosystems.typography-calibration-request.v1')throw new Error('TYPOGRAPHY_CALIBRATION_REQUEST_REQUIRED');
  if(typeof adapters.evaluate!=='function')throw new Error('TYPOGRAPHY_EVALUATOR_REQUIRED');
  const results=[];
  for(const candidate of candidateGrid(request)){
    const measured=await adapters.evaluate(clone(candidate));
    const score=composite(measured);
    results.push({candidate:clone(candidate),measurement:clone(measured),score});
  }
  results.sort((a,b)=>b.score-a.score||
    a.candidate.family.localeCompare(b.candidate.family)||
    a.candidate.weight-b.candidate.weight||
    a.candidate.size-b.candidate.size||
    a.candidate.line_height-b.candidate.line_height||
    a.candidate.letter_spacing-b.candidate.letter_spacing);
  const best=results[0]||null;
  const pass=!!best&&best.score>=request.threshold;
  return {
    schema:'riosystems.typography-calibration-result.v1',
    status:pass?'PASS':'FAIL',
    role:request.role,
    best,
    evaluated_count:results.length,
    threshold:request.threshold,
    acceptance_mode:'METRIC_EQUIVALENCE',
    font_identity_resolved:request.identity_status==='KNOWN_REFERENCE_FONT',
    exact_font_identity_claimed:request.identity_status==='KNOWN_REFERENCE_FONT',
    substitution_used:request.identity_status!=='KNOWN_REFERENCE_FONT',
    substitution_status:pass?'METRIC_EQUIVALENCE_ACCEPTABLE':'METRIC_EQUIVALENCE_NOT_REACHED',
    deterministic:true,
    human_override:false
  };
}
