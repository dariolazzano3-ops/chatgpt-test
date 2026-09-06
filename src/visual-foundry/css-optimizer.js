const clean=(v,max=240)=>String(v??'').trim().slice(0,max);
const clone=v=>structuredClone(v);
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

export function createCssOptimizationProblem(input={}){
  const parameters=(input.parameters||[]).map(p=>{
    const name=clean(p.name,120);
    const current=Number(p.current),min=Number(p.min),max=Number(p.max),step=Math.abs(Number(p.step));
    if(!name||![current,min,max,step].every(Number.isFinite)||step<=0||min>max)throw new Error('CSS_OPTIMIZER_PARAMETER_INVALID:'+name);
    return {name,current:clamp(current,min,max),min,max,step,unit:clean(p.unit||'px',20)};
  });
  if(!parameters.length)throw new Error('CSS_OPTIMIZER_PARAMETERS_REQUIRED');
  return {
    schema:'riosystems.css-optimization-problem.v1',
    parameters,
    target_regions:[...new Set((input.target_regions||[]).map(String).filter(Boolean))],
    protected_regions:[...new Set((input.protected_regions||[]).map(String).filter(Boolean))],
    max_evaluations:Math.min(300,Math.max(2,Number(input.max_evaluations??120))),
    min_improvement:Number(input.min_improvement??0.0005),
    protected_regression_tolerance:Number(input.protected_regression_tolerance??0.002),
    deterministic:true
  };
}

function regionScore(result={},ids=[]){
  if(!ids.length)return Number(result.global_score??0);
  const map=new Map((result.regions||[]).map(r=>[r.region_id,Number(r.score??0)]));
  const values=ids.map(id=>map.get(id)).filter(Number.isFinite);
  return values.length?values.reduce((a,b)=>a+b,0)/values.length:Number(result.global_score??0);
}

function protectedOk(before,after,ids,tolerance){
  const b=new Map((before.regions||[]).map(r=>[r.region_id,Number(r.score??0)]));
  const a=new Map((after.regions||[]).map(r=>[r.region_id,Number(r.score??0)]));
  for(const id of ids){
    const bv=b.get(id),av=a.get(id);
    if(Number.isFinite(bv)&&Number.isFinite(av)&&av+tolerance<bv)return false;
  }
  return true;
}

export async function optimizeCssParameters(problem={},adapters={}){
  if(problem.schema!=='riosystems.css-optimization-problem.v1')throw new Error('CSS_OPTIMIZATION_PROBLEM_REQUIRED');
  if(typeof adapters.evaluate!=='function')throw new Error('CSS_OPTIMIZER_EVALUATOR_REQUIRED');
  let evaluations=0;
  let values=Object.fromEntries(problem.parameters.map(p=>[p.name,p.current]));
  let bestResult=await adapters.evaluate(clone(values));evaluations++;
  let bestScore=regionScore(bestResult,problem.target_regions);
  const history=[{evaluation:evaluations,values:clone(values),score:bestScore,accepted:true,reason:'BASELINE'}];
  let changed=true;

  while(changed&&evaluations<problem.max_evaluations){
    changed=false;
    for(const p of problem.parameters){
      for(const direction of [-1,1]){
        if(evaluations>=problem.max_evaluations)break;
        const candidate={...values,[p.name]:clamp(values[p.name]+direction*p.step,p.min,p.max)};
        if(candidate[p.name]===values[p.name])continue;
        const result=await adapters.evaluate(clone(candidate));evaluations++;
        const score=regionScore(result,problem.target_regions);
        const protectedPass=protectedOk(bestResult,result,problem.protected_regions,problem.protected_regression_tolerance);
        const improvement=score-bestScore;
        const accepted=protectedPass&&improvement>=problem.min_improvement;
        history.push({evaluation:evaluations,values:clone(candidate),score,improvement,protected_pass:protectedPass,accepted});
        if(accepted){values=candidate;bestResult=result;bestScore=score;changed=true;break;}
      }
    }
  }
  return {
    schema:'riosystems.css-optimization-result.v1',
    status:'COMPLETED',
    values,best_score:bestScore,best_measurement:clone(bestResult),
    evaluations,history,
    protected_regions:problem.protected_regions,
    regression_protection:true,
    deterministic:true
  };
}
