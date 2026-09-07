const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number(v)));
const SEMANTIC_WEIGHTS=Object.freeze({
  PRIMARY_CTA:2.2,NAVIGATION:2.0,HEADING:1.9,IMPORTANT_TEXT:1.8,STATUS:1.5,
  DATA_CARD:1.35,FORM_CONTROL:1.4,NORMAL_UI:1.0,DECORATION:0.5
});
const CRITICALITY_WEIGHTS=Object.freeze({CRITICAL:3,HIGH:2,MEDIUM:1.35,LOW:1,DECORATIVE:0.6});

export function scoreVisualDeltaPriority(input={}){
  const ssim=clamp(input.ssim??0,0,1);
  const pixel=clamp(Number(input.pixel_difference_percent??100)/100,0,1);
  const errorMagnitude=.6*(1-ssim)+.4*pixel;
  const canvasArea=Math.max(1,Number(input.canvas_area_px??1));
  const area=Math.max(1,Number(input.area_px??1));
  const areaRatio=clamp(area/canvasArea,0,1);
  const areaFactor=clamp(.5+Math.sqrt(areaRatio),.5,1.5);
  const contrastIndex=clamp(input.contrast_index??0.5,0,1);
  const contrastFactor=.5+contrastIndex;
  const semanticType=String(input.semantic_type||'NORMAL_UI').toUpperCase();
  const criticality=String(input.criticality||'MEDIUM').toUpperCase();
  const semanticWeight=SEMANTIC_WEIGHTS[semanticType]??SEMANTIC_WEIGHTS.NORMAL_UI;
  const criticalityWeight=CRITICALITY_WEIGHTS[criticality]??CRITICALITY_WEIGHTS.MEDIUM;
  const priority=errorMagnitude*areaFactor*contrastFactor*semanticWeight*criticalityWeight;
  return {
    schema:'riosystems.visual-delta-priority.v1',
    region_id:String(input.region_id||'unknown'),
    priority_score:Math.round(priority*1e6)/1e6,
    factors:{
      error_magnitude:Math.round(errorMagnitude*1e6)/1e6,
      area_factor:Math.round(areaFactor*1e6)/1e6,
      contrast_factor:Math.round(contrastFactor*1e6)/1e6,
      semantic_weight:semanticWeight,
      criticality_weight:criticalityWeight
    },
    formula:'(.6*(1-ssim)+.4*pixel_diff_ratio) * (.5+sqrt(area_ratio)) * (.5+contrast_index) * semantic_weight * criticality_weight',
    ai_weighting_used:false
  };
}

export function rankVisualDeltas(items=[]){
  return items.map(scoreVisualDeltaPriority).sort((a,b)=>b.priority_score-a.priority_score||a.region_id.localeCompare(b.region_id));
}

export function visualPriorityWeights(){
  return {semantic:{...SEMANTIC_WEIGHTS},criticality:{...CRITICALITY_WEIGHTS}};
}
