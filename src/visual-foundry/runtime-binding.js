export const RUNTIME_BINDING_STATES=Object.freeze(['EMPTY','LOADING','REFERENCE','NORMAL','LONG_CONTENT','STRESS']);
const OVERFLOW_STRATEGIES=new Set(['CLIP','SCROLL','WRAP','TRUNCATE','EXPAND_WITH_MAX']);

const clean=(v,max=1000)=>String(v??'').trim().slice(0,max);
const clone=v=>structuredClone(v);

function positive(value,code){
  const n=Number(value);
  if(!Number.isFinite(n)||n<0)throw new Error(code);
  return n;
}

export function createRuntimeBindingContract(input={}){
  const componentId=clean(input.component_id,180);
  const endpoint=clean(input.endpoint,500);
  if(!componentId)throw new Error('RUNTIME_BINDING_COMPONENT_ID_REQUIRED');
  if(!endpoint.startsWith('/'))throw new Error('RUNTIME_BINDING_ENDPOINT_INVALID');
  const method=clean(input.method||'GET',20).toUpperCase();
  if(method!=='GET')throw new Error('RUNTIME_BINDING_V1_GET_ONLY');
  const strategy=clean(input.overflow_strategy||'WRAP',80).toUpperCase();
  if(!OVERFLOW_STRATEGIES.has(strategy))throw new Error('RUNTIME_BINDING_OVERFLOW_STRATEGY_INVALID');
  const states=Array.isArray(input.states)&&input.states.length?[...new Set(input.states.map(x=>clean(x,40).toUpperCase()))]:[...RUNTIME_BINDING_STATES];
  const missing=RUNTIME_BINDING_STATES.filter(s=>!states.includes(s));
  if(missing.length)throw new Error('RUNTIME_BINDING_STATE_COVERAGE_REQUIRED:'+missing.join(','));
  const minWidth=positive(input.min_width??0,'RUNTIME_BINDING_MIN_WIDTH_INVALID');
  const maxWidth=input.max_width==null?null:positive(input.max_width,'RUNTIME_BINDING_MAX_WIDTH_INVALID');
  const minHeight=positive(input.min_height??0,'RUNTIME_BINDING_MIN_HEIGHT_INVALID');
  const maxHeight=input.max_height==null?null:positive(input.max_height,'RUNTIME_BINDING_MAX_HEIGHT_INVALID');
  if(maxWidth!==null&&maxWidth<minWidth)throw new Error('RUNTIME_BINDING_WIDTH_RANGE_INVALID');
  if(maxHeight!==null&&maxHeight<minHeight)throw new Error('RUNTIME_BINDING_HEIGHT_RANGE_INVALID');
  return {
    schema:'riosystems.runtime-binding-contract.v1',
    component_id:componentId,
    endpoint,
    method,
    response_path:clean(input.response_path||'items',180),
    states,
    layout:{
      min_width:minWidth,
      max_width:maxWidth,
      min_height:minHeight,
      max_height:maxHeight,
      overflow_strategy:strategy,
      text_truncation:input.text_truncation===true,
      text_wrapping:input.text_wrapping!==false,
      max_text_chars:positive(input.max_text_chars??160,'RUNTIME_BINDING_MAX_TEXT_INVALID'),
      max_items:positive(input.max_items??250,'RUNTIME_BINDING_MAX_ITEMS_INVALID')
    },
    loading:{skeleton_count:positive(input.skeleton_count??3,'RUNTIME_BINDING_SKELETON_COUNT_INVALID')},
    fixture_reference_allowed_for_visual_test_only:true,
    fixture_reference_allowed_as_runtime_truth:false
  };
}

export function validateRuntimeBindingContract(contract={}){
  const issues=[];
  if(contract.schema!=='riosystems.runtime-binding-contract.v1')issues.push('RUNTIME_BINDING_SCHEMA_INVALID');
  if(!clean(contract.component_id,180))issues.push('RUNTIME_BINDING_COMPONENT_ID_REQUIRED');
  if(!clean(contract.endpoint,500).startsWith('/'))issues.push('RUNTIME_BINDING_ENDPOINT_INVALID');
  const states=Array.isArray(contract.states)?contract.states:[];
  for(const state of RUNTIME_BINDING_STATES)if(!states.includes(state))issues.push('RUNTIME_BINDING_STATE_MISSING:'+state);
  if(contract.fixture_reference_allowed_as_runtime_truth!==false)issues.push('REFERENCE_FIXTURE_RUNTIME_TRUTH_FORBIDDEN');
  if(!OVERFLOW_STRATEGIES.has(String(contract.layout?.overflow_strategy)))issues.push('RUNTIME_BINDING_OVERFLOW_STRATEGY_INVALID');
  return {ok:issues.length===0,issues};
}

function truncate(value,max){
  const s=String(value??'');
  return s.length<=max?s:s.slice(0,Math.max(0,max-1))+'…';
}

export function materializeBindingScenario(contract={},input={}){
  const validation=validateRuntimeBindingContract(contract);
  if(!validation.ok)throw new Error('RUNTIME_BINDING_INVALID:'+validation.issues.join(','));
  const state=clean(input.state,40).toUpperCase();
  if(!RUNTIME_BINDING_STATES.includes(state))throw new Error('RUNTIME_BINDING_STATE_INVALID');
  if(state==='REFERENCE'&&input.truth_class!=='VISUAL_FIXTURE')throw new Error('REFERENCE_STATE_REQUIRES_VISUAL_FIXTURE');
  if(state!=='REFERENCE'&&input.truth_class==='VISUAL_FIXTURE')throw new Error('VISUAL_FIXTURE_LEAK_IN_RUNTIME_STATE');

  let items=Array.isArray(input.items)?clone(input.items):[];
  if(state==='EMPTY')items=[];
  if(state==='LOADING')items=[];
  const maxItems=contract.layout.max_items;
  const clipped=items.length>maxItems;
  if(clipped)items=items.slice(0,maxItems);

  const maxChars=contract.layout.max_text_chars;
  const normalized=items.map(item=>{
    if(!item||typeof item!=='object')return item;
    const out={...item};
    for(const [key,val] of Object.entries(out)){
      if(typeof val==='string'&&contract.layout.text_truncation&&val.length>maxChars)out[key]=truncate(val,maxChars);
    }
    return out;
  });

  return {
    schema:'riosystems.runtime-binding-scenario.v1',
    component_id:contract.component_id,
    endpoint:contract.endpoint,
    state,
    truth_class:state==='REFERENCE'?'VISUAL_FIXTURE':'RUNTIME_TRUTH',
    loading:state==='LOADING',
    empty:state==='EMPTY',
    items:normalized,
    item_count:normalized.length,
    input_item_count:Array.isArray(input.items)?input.items.length:0,
    items_clipped_to_contract:clipped,
    layout_policy:clone(contract.layout),
    persistent_fixture_write_allowed:false
  };
}

export function evaluateBindingStateCoverage(contract={},scenarios=[]){
  const validation=validateRuntimeBindingContract(contract);
  if(!validation.ok)return {status:'FAIL',missing_states:RUNTIME_BINDING_STATES,issues:validation.issues};
  const states=new Set(scenarios.map(x=>x?.state));
  const missing=RUNTIME_BINDING_STATES.filter(s=>!states.has(s));
  const leaks=scenarios.filter(x=>x?.state!=='REFERENCE'&&x?.truth_class==='VISUAL_FIXTURE');
  return {
    schema:'riosystems.runtime-binding-coverage.v1',
    status:missing.length||leaks.length?'FAIL':'PASS',
    covered_states:RUNTIME_BINDING_STATES.filter(s=>states.has(s)),
    missing_states:missing,
    fixture_leak_count:leaks.length,
    layout_guarded:true
  };
}
