const clone=v=>structuredClone(v);
const scoreMap=result=>new Map((result?.regions||[]).map(r=>[r.region_id,Number(r.score??0)]));

export function evaluateRegionRegressionGuard(input={}){
  const before=scoreMap(input.before),after=scoreMap(input.after);
  const threshold=Number(input.pass_threshold??0.96);
  const tolerance=Number(input.regression_tolerance??0.002);
  const protectedRegions=[...new Set((input.protected_regions||[]).map(String))];
  const regressions=[];
  for(const id of protectedRegions){
    const b=before.get(id),a=after.get(id);
    if(!Number.isFinite(b)||!Number.isFinite(a)){regressions.push({region_id:id,reason:'REGION_SCORE_MISSING',before:b??null,after:a??null});continue;}
    if(b>=threshold&&a<threshold)regressions.push({region_id:id,reason:'PASS_TO_FAIL',before:b,after:a});
    else if(a+tolerance<b)regressions.push({region_id:id,reason:'REGRESSION_BEYOND_TOLERANCE',before:b,after:a});
  }
  return {schema:'riosystems.region-regression-guard.v1',status:regressions.length?'REJECT':'ACCEPT',regressions,protected_regions:protectedRegions,pass_threshold:threshold,regression_tolerance:tolerance};
}

export function freezePassingRegions(result={},input={}){
  const threshold=Number(input.pass_threshold??0.96);
  return (result.regions||[]).filter(r=>Number(r.score??0)>=threshold).map(r=>r.region_id).sort();
}

export async function runRegressionProtectedRegionClosure(input={},adapters={}){
  for(const name of ['baseline','propose','apply','render_measure','accept','revert'])if(typeof adapters[name]!=='function')throw new Error('REGION_CLOSURE_ADAPTER_REQUIRED:'+name);
  const maxIterations=Math.min(8,Math.max(1,Number(input.max_iterations??8)));
  const targetRegions=[...new Set((input.target_regions||[]).map(String))];
  let current=await adapters.baseline();
  let protectedRegions=freezePassingRegions(current,input);
  const history=[];

  for(let iteration=1;iteration<=maxIterations;iteration++){
    const proposal=await adapters.propose({iteration,current:clone(current),target_regions:targetRegions,protected_regions:protectedRegions});
    if(!proposal)return {schema:'riosystems.region-closure-result.v1',status:'HUMAN_DECISION_REQUIRED',reason:'NO_SAFE_PROPOSAL',iterations:iteration-1,current,protected_regions:protectedRegions,history};
    const token=await adapters.apply(proposal);
    const measured=await adapters.render_measure({iteration,proposal,token});
    const guard=evaluateRegionRegressionGuard({before:current,after:measured,protected_regions:protectedRegions,pass_threshold:input.pass_threshold,regression_tolerance:input.regression_tolerance});
    const beforeTarget=targetRegions.reduce((s,id)=>s+(scoreMap(current).get(id)||0),0);
    const afterTarget=targetRegions.reduce((s,id)=>s+(scoreMap(measured).get(id)||0),0);
    const improved=afterTarget>beforeTarget+Number(input.min_target_improvement??0.0005);
    if(guard.status==='REJECT'||!improved){
      await adapters.revert({token,proposal,guard,improved});
      history.push({iteration,status:'REJECTED',guard,improved});
      continue;
    }
    await adapters.accept({token,proposal,measurement:measured});
    current=measured;
    protectedRegions=[...new Set([...protectedRegions,...freezePassingRegions(current,input)])].sort();
    history.push({iteration,status:'ACCEPTED',guard,improved,protected_regions:protectedRegions});
    const targetMap=scoreMap(current);
    if(targetRegions.every(id=>(targetMap.get(id)||0)>=Number(input.pass_threshold??0.96))){
      return {schema:'riosystems.region-closure-result.v1',status:'PASS',iterations:iteration,current,protected_regions:protectedRegions,history};
    }
  }
  return {schema:'riosystems.region-closure-result.v1',status:'HUMAN_DECISION_REQUIRED',reason:'ITERATION_LIMIT_EXHAUSTED',iterations:maxIterations,current,protected_regions:protectedRegions,history};
}
