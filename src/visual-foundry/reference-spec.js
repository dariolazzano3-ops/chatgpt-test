const SOURCE_METHODS=Object.freeze(['DOM','PIXEL','VISION','MANUAL','DERIVED','UNKNOWN']);
const UNITS=Object.freeze(['px','rem','em','%','ratio','count','color','string','boolean','none','ms','deg']);

const clone=v=>structuredClone(v);
const clean=(v,max=500)=>String(v??'').trim().slice(0,max);

function viewport(input={}) {
  const width=Number(input.width), height=Number(input.height), dpr=Number(input.device_pixel_ratio??1);
  if(!Number.isInteger(width)||width<320||width>4096) throw new Error('REFERENCE_SPEC_VIEWPORT_WIDTH_INVALID');
  if(!Number.isInteger(height)||height<320||height>4096) throw new Error('REFERENCE_SPEC_VIEWPORT_HEIGHT_INVALID');
  if(!Number.isFinite(dpr)||dpr<1||dpr>4) throw new Error('REFERENCE_SPEC_DPR_INVALID');
  return {width,height,device_pixel_ratio:dpr};
}

function confidence(v,code='MEASUREMENT_CONFIDENCE_INVALID'){
  const n=Number(v);
  if(!Number.isFinite(n)||n<0||n>1) throw new Error(code);
  return n;
}

export function measurement(value,input={}) {
  const unit=clean(input.unit||'none',40);
  if(!UNITS.includes(unit)) throw new Error('MEASUREMENT_UNIT_INVALID');
  const tolerance=input.tolerance==null?0:Number(input.tolerance);
  if(!Number.isFinite(tolerance)||tolerance<0) throw new Error('MEASUREMENT_TOLERANCE_INVALID');
  const sourceMethod=clean(input.source_method||'UNKNOWN',40).toUpperCase();
  if(!SOURCE_METHODS.includes(sourceMethod)) throw new Error('MEASUREMENT_SOURCE_METHOD_INVALID');
  return {
    value:clone(value),
    unit,
    tolerance,
    source_method:sourceMethod,
    confidence:confidence(input.confidence??0),
    human_override:input.human_override===true
  };
}

function scanForbiddenProviderKeys(value,path='root',issues=[]){
  if(Array.isArray(value)){value.forEach((v,i)=>scanForbiddenProviderKeys(v,`${path}[${i}]`,issues));return issues;}
  if(!value||typeof value!=='object')return issues;
  for(const [key,val] of Object.entries(value)){
    if(['provider','provider_name','model','model_name'].includes(key)) issues.push({code:'REFERENCE_SPEC_PROVIDER_COUPLING_FORBIDDEN',path:`${path}.${key}`});
    scanForbiddenProviderKeys(val,`${path}.${key}`,issues);
  }
  return issues;
}

function scanMeasurements(value,path='root',issues=[]){
  if(Array.isArray(value)){value.forEach((v,i)=>scanMeasurements(v,`${path}[${i}]`,issues));return issues;}
  if(!value||typeof value!=='object')return issues;
  if(Object.prototype.hasOwnProperty.call(value,'value')){
    if(!UNITS.includes(String(value.unit))) issues.push({code:'MEASUREMENT_UNIT_INVALID',path});
    if(!SOURCE_METHODS.includes(String(value.source_method))) issues.push({code:'MEASUREMENT_SOURCE_METHOD_INVALID',path});
    const t=Number(value.tolerance); if(!Number.isFinite(t)||t<0) issues.push({code:'MEASUREMENT_TOLERANCE_INVALID',path});
    const c=Number(value.confidence); if(!Number.isFinite(c)||c<0||c>1) issues.push({code:'MEASUREMENT_CONFIDENCE_INVALID',path});
    if(typeof value.human_override!=='boolean') issues.push({code:'MEASUREMENT_HUMAN_OVERRIDE_INVALID',path});
  }
  for(const [key,val] of Object.entries(value)) scanMeasurements(val,`${path}.${key}`,issues);
  return issues;
}

export function createReferenceSpec(input={}) {
  const referenceId=clean(input.reference_id,160);
  const version=clean(input.version,80);
  if(!referenceId) throw new Error('REFERENCE_SPEC_REFERENCE_ID_REQUIRED');
  if(!version) throw new Error('REFERENCE_SPEC_VERSION_REQUIRED');

  const spec={
    schema:'riosystems.reference-spec.v1',
    reference_id:referenceId,
    version,
    viewport:viewport(input.viewport),
    regions:Array.isArray(input.regions)?clone(input.regions):[],
    components:Array.isArray(input.components)?clone(input.components):[],
    tokens:input.tokens&&typeof input.tokens==='object'?clone(input.tokens):{},
    typography:input.typography&&typeof input.typography==='object'?clone(input.typography):{},
    spacing:input.spacing&&typeof input.spacing==='object'?clone(input.spacing):{},
    colors:input.colors&&typeof input.colors==='object'?clone(input.colors):{},
    effects:input.effects&&typeof input.effects==='object'?clone(input.effects):{},
    assets:Array.isArray(input.assets)?clone(input.assets):[],
    responsive_rules:Array.isArray(input.responsive_rules)?clone(input.responsive_rules):[],
    fixture_contract:input.fixture_contract&&typeof input.fixture_contract==='object'?clone(input.fixture_contract):{},
    measurement_confidence:confidence(input.measurement_confidence??0,'REFERENCE_SPEC_CONFIDENCE_INVALID')
  };
  const validation=validateReferenceSpec(spec);
  if(!validation.ok) throw new Error('REFERENCE_SPEC_INVALID:'+validation.issues.map(x=>x.code+'@'+x.path).join(','));
  return spec;
}

export function validateReferenceSpec(spec={}) {
  const issues=[];
  if(spec.schema!=='riosystems.reference-spec.v1')issues.push({code:'REFERENCE_SPEC_SCHEMA_INVALID',path:'schema'});
  if(!clean(spec.reference_id,160))issues.push({code:'REFERENCE_SPEC_REFERENCE_ID_REQUIRED',path:'reference_id'});
  if(!clean(spec.version,80))issues.push({code:'REFERENCE_SPEC_VERSION_REQUIRED',path:'version'});
  try{viewport(spec.viewport)}catch(e){issues.push({code:String(e.message||e),path:'viewport'});}
  for(const key of ['regions','components','assets','responsive_rules'])if(!Array.isArray(spec[key]))issues.push({code:'REFERENCE_SPEC_ARRAY_REQUIRED',path:key});
  for(const key of ['tokens','typography','spacing','colors','effects','fixture_contract'])if(!spec[key]||typeof spec[key]!=='object'||Array.isArray(spec[key]))issues.push({code:'REFERENCE_SPEC_OBJECT_REQUIRED',path:key});
  try{confidence(spec.measurement_confidence,'REFERENCE_SPEC_CONFIDENCE_INVALID')}catch(e){issues.push({code:String(e.message||e),path:'measurement_confidence'});}
  scanForbiddenProviderKeys(spec,'root',issues);
  scanMeasurements(spec,'root',issues);
  return {ok:issues.length===0,issues};
}

export function referenceSpecManifest(){
  return {
    schema:'riosystems.reference-spec-manifest.v1',
    contract:'riosystems.reference-spec.v1',
    required_fields:['reference_id','version','viewport','regions','components','tokens','typography','spacing','colors','effects','assets','responsive_rules','fixture_contract','measurement_confidence'],
    measurement_fields:['value','unit','tolerance','source_method','confidence','human_override'],
    provider_neutral:true,
    unstructured_llm_prose_source_of_truth:false
  };
}
