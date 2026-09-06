import { createVisualDelta } from './visual-delta.js';

const LICENSES=new Set(['owned','licensed','public_domain','generated','system','unknown']);
const clean=(v,max=1000)=>String(v??'').trim().slice(0,max);
const clone=v=>structuredClone(v);

function number(value,code,{min=0}={}){
  const n=Number(value);
  if(!Number.isFinite(n)||n<min) throw new Error(code);
  return n;
}

export function createFontRecord(input={}){
  const family=clean(input.family,240);
  const source=clean(input.source,1000);
  if(!family) throw new Error('FONT_FAMILY_REQUIRED');
  if(!source) throw new Error('FONT_SOURCE_REQUIRED');
  const license=clean(input.license||'unknown',80).toLowerCase();
  if(!LICENSES.has(license)) throw new Error('FONT_LICENSE_INVALID');
  return {
    schema:'riosystems.font-record.v1',
    font_id:clean(input.font_id||family.toLowerCase().replace(/[^a-z0-9]+/g,'-'),180),
    family,
    source,
    weight:clean(input.weight||'400',40),
    size:number(input.size??16,'FONT_SIZE_INVALID'),
    line_height:number(input.line_height??20,'FONT_LINE_HEIGHT_INVALID'),
    letter_spacing:Number.isFinite(Number(input.letter_spacing))?Number(input.letter_spacing):0,
    license,
    fallback:clean(input.fallback||'sans-serif',240),
    loaded:input.loaded===true,
    metrics:{
      ascent:Number.isFinite(Number(input.metrics?.ascent))?Number(input.metrics.ascent):null,
      descent:Number.isFinite(Number(input.metrics?.descent))?Number(input.metrics.descent):null,
      x_height:Number.isFinite(Number(input.metrics?.x_height))?Number(input.metrics.x_height):null,
      cap_height:Number.isFinite(Number(input.metrics?.cap_height))?Number(input.metrics.cap_height):null
    },
    role:clean(input.role||'body',80),
    fidelity_importance:clean(input.fidelity_importance||'MEDIUM',40).toUpperCase()
  };
}

export function validateFontRecord(record={}){
  const issues=[];
  if(record.schema!=='riosystems.font-record.v1') issues.push('FONT_SCHEMA_INVALID');
  if(!clean(record.font_id,180)) issues.push('FONT_ID_REQUIRED');
  if(!clean(record.family,240)) issues.push('FONT_FAMILY_REQUIRED');
  if(!clean(record.source,1000)) issues.push('FONT_SOURCE_REQUIRED');
  if(!LICENSES.has(String(record.license))) issues.push('FONT_LICENSE_INVALID');
  if(typeof record.loaded!=='boolean') issues.push('FONT_LOADED_INVALID');
  for(const key of ['size','line_height','letter_spacing']) if(!Number.isFinite(Number(record[key]))) issues.push('FONT_METRIC_INVALID:'+key);
  return {ok:issues.length===0,issues};
}

function metricScore(expected,actual,tolerance){
  const diff=Math.abs(Number(expected)-Number(actual));
  return {pass:diff<=tolerance,difference:diff,score:Math.max(0,1-diff/Math.max(1,Math.abs(Number(expected))))};
}

export function compareTypography(input={}){
  const reference=Array.isArray(input.reference_fonts)?input.reference_fonts:[];
  const runtime=Array.isArray(input.runtime_fonts)?input.runtime_fonts:[];
  const runtimeByRole=new Map(runtime.map(f=>[f.role,f]));
  const deltas=[];
  const checks=[];
  let passed=0,total=0;

  for(const expected of reference){
    const validation=validateFontRecord(expected);
    if(!validation.ok) throw new Error('REFERENCE_FONT_INVALID:'+validation.issues.join(','));
    const actual=runtimeByRole.get(expected.role)||null;
    total+=4;

    if(!actual||actual.loaded!==true||actual.family!==expected.family){
      const actualFamily=actual?.family||expected.fallback||'UNKNOWN';
      deltas.push(createVisualDelta({
        reference_id:input.reference_id,implementation_commit:input.implementation_commit,viewport:input.viewport,
        delta_id:`font-substitution-${expected.role}`,component_id:expected.role,category:'TYPOGRAPHY',
        severity:['HIGH','CRITICAL'].includes(expected.fidelity_importance)?'HIGH':'MEDIUM',
        expected:expected.family,actual:actualFamily,difference:'FONT_SUBSTITUTION_DELTA',unit:'font-family',
        score:0,blocking:['HIGH','CRITICAL'].includes(expected.fidelity_importance),
        evidence:{code:'FONT_SUBSTITUTION_DELTA',font_id:expected.font_id,source:expected.source,fallback:expected.fallback},
        repair_hint:'Load the approved reference font or record an explicit human-approved substitution.'
      }));
      checks.push({role:expected.role,metric:'family',pass:false,expected:expected.family,actual:actualFamily,code:'FONT_SUBSTITUTION_DELTA'});
    }else{
      passed+=1;
      checks.push({role:expected.role,metric:'family',pass:true,expected:expected.family,actual:actual.family});
    }

    if(['unknown'].includes(expected.license)){
      deltas.push(createVisualDelta({
        reference_id:input.reference_id,implementation_commit:input.implementation_commit,viewport:input.viewport,
        delta_id:`font-license-${expected.role}`,component_id:expected.role,category:'TYPOGRAPHY',severity:'HIGH',
        expected:'KNOWN_LICENSE',actual:'unknown',difference:'FONT_LICENSE_BLOCKER',unit:'license',score:0,blocking:true,
        evidence:{code:'FONT_LICENSE_BLOCKER',font_id:expected.font_id},repair_hint:'Resolve font licensing before final visual approval.'
      }));
    }

    for(const [metric,tolerance] of [['size',Number(input.size_tolerance_px??1)],['line_height',Number(input.line_height_tolerance_px??1)],['letter_spacing',Number(input.letter_spacing_tolerance_px??0.25)]]){
      const actualValue=actual?.[metric];
      const scored=actualValue==null?{pass:false,difference:Infinity,score:0}:metricScore(expected[metric],actualValue,tolerance);
      if(scored.pass) passed+=1;
      checks.push({role:expected.role,metric,pass:scored.pass,expected:expected[metric],actual:actualValue??null,tolerance,difference:scored.difference});
      if(!scored.pass){
        deltas.push(createVisualDelta({
          reference_id:input.reference_id,implementation_commit:input.implementation_commit,viewport:input.viewport,
          delta_id:`font-${metric}-${expected.role}`,component_id:expected.role,category:'TYPOGRAPHY',severity:scored.score<.9?'HIGH':'MEDIUM',
          expected:expected[metric],actual:actualValue??null,difference:scored.difference,unit:'px',score:scored.score,blocking:scored.score<.9,
          evidence:{code:'FONT_METRIC_DELTA',font_id:expected.font_id,metric,tolerance},
          repair_hint:`Align ${expected.role} ${metric} with the reference typography contract.`
        }));
      }
    }
  }

  const score=total?passed/total:1;
  return {
    schema:'riosystems.typography-comparison.v1',
    status:deltas.some(d=>d.blocking)?'FAIL':'PASS',
    typography_score:Math.round(score*1000000)/1000000,
    checks,
    deltas,
    font_substitution_count:deltas.filter(d=>d.difference==='FONT_SUBSTITUTION_DELTA').length,
    font_license_blocker_count:deltas.filter(d=>d.difference==='FONT_LICENSE_BLOCKER').length,
    font_difference_cannot_be_hidden_by_layout:true
  };
}
