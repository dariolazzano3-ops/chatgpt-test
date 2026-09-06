export const VISUAL_REPAIR_PHASES=Object.freeze([
  'STRUCTURE','MACRO_GEOMETRY','COMPONENT_GEOMETRY','TYPOGRAPHY','COLOR','EFFECT','MICRO_SPACING'
]);
export const VISUAL_REPAIR_HARD_MAX_ITERATIONS=8;

const clean=(v,max=1000)=>String(v??'').trim().slice(0,max);
const clone=v=>structuredClone(v);

export function resolveVisualRepairIterationLimit(value){
  const n=Number(value??VISUAL_REPAIR_HARD_MAX_ITERATIONS);
  if(!Number.isFinite(n)) return VISUAL_REPAIR_HARD_MAX_ITERATIONS;
  return Math.min(VISUAL_REPAIR_HARD_MAX_ITERATIONS,Math.max(1,Math.floor(n)));
}

function repairPhase(delta={}){
  if(delta.category==='STRUCTURE') return 'STRUCTURE';
  if(delta.category==='GEOMETRY'){
    const metric=String(delta?.evidence?.metric||'').toLowerCase();
    if(['x','y','width','height'].includes(metric)&&delta.component_id) return 'COMPONENT_GEOMETRY';
    return 'MACRO_GEOMETRY';
  }
  if(delta.category==='TYPOGRAPHY') return 'TYPOGRAPHY';
  if(delta.category==='COLOR') return 'COLOR';
  if(delta.category==='EFFECT') return 'EFFECT';
  if(delta.category==='RESPONSIVE') return 'MACRO_GEOMETRY';
  return 'MICRO_SPACING';
}

function phaseRank(delta){
  const phase=repairPhase(delta);
  return VISUAL_REPAIR_PHASES.indexOf(phase);
}

export function createVisualRepairPlan(deltas=[]){
  const open=(Array.isArray(deltas)?deltas:[])
    .filter(d=>d&&d.schema==='riosystems.visual-delta.v1')
    .filter(d=>d.blocking===true||['MEDIUM','HIGH','CRITICAL'].includes(d.severity))
    .sort((a,b)=>phaseRank(a)-phaseRank(b)||String(a.delta_id).localeCompare(String(b.delta_id)));
  if(!open.length) return {schema:'riosystems.visual-repair-plan.v1',status:'NO_REPAIR_REQUIRED',phase:null,deltas:[]};
  const phase=repairPhase(open[0]);
  const selected=open.filter(d=>repairPhase(d)===phase);
  return {
    schema:'riosystems.visual-repair-plan.v1',
    status:'REPAIR_REQUIRED',
    phase,
    deltas:selected.map(clone),
    repair_order:[...VISUAL_REPAIR_PHASES],
    blind_rewrite_allowed:false
  };
}

const FRONTEND_EXTENSIONS=new Set(['.html','.htm','.css','.js','.mjs','.jsx','.ts','.tsx','.svg','.png','.jpg','.jpeg','.webp','.avif','.gif']);
const FORBIDDEN_NAMES=new Set(['_worker.js','wrangler.toml','wrangler.json','package.json','package-lock.json']);
const FORBIDDEN_SEGMENTS=['migrations/','supabase/','database/','auth/','billing/','secrets/','.github/','factory-state/'];

export function assertVisualRepairAuthority(changedFiles=[],options={}){
  const projectPath=clean(options.project_path,500).replace(/\/+$/,'');
  if(!projectPath.startsWith('projects/')) throw new Error('VISUAL_REPAIR_PROJECT_PATH_INVALID');
  const files=[...new Set((changedFiles||[]).map(x=>clean(x,1000)).filter(Boolean))];
  if(!files.length) throw new Error('VISUAL_REPAIR_CHANGED_FILES_REQUIRED');
  if(files.length>Number(options.max_files??12)) throw new Error('VISUAL_REPAIR_FILE_LIMIT_EXCEEDED');
  for(const file of files){
    if(!file.startsWith(projectPath+'/')) throw new Error('VISUAL_REPAIR_OUT_OF_SCOPE:'+file);
    const relative=file.slice(projectPath.length+1);
    const name=relative.split('/').at(-1);
    if(FORBIDDEN_NAMES.has(name)) throw new Error('VISUAL_REPAIR_FORBIDDEN_FILE:'+file);
    if(FORBIDDEN_SEGMENTS.some(seg=>relative.toLowerCase().includes(seg))) throw new Error('VISUAL_REPAIR_FORBIDDEN_PATH:'+file);
    const dot=name.lastIndexOf('.');
    const ext=dot>=0?name.slice(dot).toLowerCase():'';
    if(!FRONTEND_EXTENSIONS.has(ext)) throw new Error('VISUAL_REPAIR_FILE_TYPE_FORBIDDEN:'+file);
  }
  return {ok:true,project_path:projectPath,changed_files:files,frontend_only:true};
}

function blockingSignature(deltas=[]){
  return (deltas||[]).filter(d=>d.blocking===true).map(d=>`${d.delta_id}:${d.category}:${d.severity}:${JSON.stringify(d.difference)}`).sort().join('|');
}

export function visualDeltaClosureHostDescriptor(input={}){
  return {
    schema:'riosystems.visual-delta-closure-host.v1',
    host:'scripts/qa-repair-loop.mjs',
    same_factory_qa_loop:true,
    max_iterations:resolveVisualRepairIterationLimit(input.max_iterations),
    hard_max_iterations:VISUAL_REPAIR_HARD_MAX_ITERATIONS,
    production_deploy:false,
    backend_contract_changes_allowed:false
  };
}

export async function runBoundedVisualDeltaClosure(input={},adapters={}){
  const required=['repair','commit','render','measure','compare','functional_regression'];
  for(const name of required) if(typeof adapters[name]!=='function') throw new Error('VISUAL_REPAIR_ADAPTER_REQUIRED:'+name);
  const maxIterations=resolveVisualRepairIterationLimit(input.max_iterations);
  const projectPath=clean(input.project_path,500);
  let deltas=Array.isArray(input.initial_deltas)?input.initial_deltas.map(clone):[];
  const history=[];
  let previousSignature=blockingSignature(deltas);

  if(!deltas.some(d=>d.blocking===true)) return {schema:'riosystems.visual-delta-closure-result.v1',status:'PASS',iterations:0,max_iterations:maxIterations,deltas,history,human_decision_required:false};

  for(let iteration=1;iteration<=maxIterations;iteration++){
    if(typeof adapters.cost_guard==='function'){
      const costGuard=await adapters.cost_guard({iteration,deltas:deltas.map(clone)});
      if(costGuard?.execution_allowed===false||costGuard?.status==='COST_REVIEW_REQUIRED'){
        return {schema:'riosystems.visual-delta-closure-result.v1',status:'COST_REVIEW_REQUIRED',reason:'VISUAL_COST_GUARD',iterations:iteration-1,max_iterations:maxIterations,deltas,history,human_decision_required:true,cost_guard:clone(costGuard)};
      }
    }
    const plan=createVisualRepairPlan(deltas);
    if(plan.status!=='REPAIR_REQUIRED') return {schema:'riosystems.visual-delta-closure-result.v1',status:'PASS',iterations:history.length,max_iterations:maxIterations,deltas,history,human_decision_required:false};

    const repaired=await adapters.repair({iteration,plan,deltas:plan.deltas.map(clone)});
    const authority=assertVisualRepairAuthority(repaired?.changed_files||[],{project_path:projectPath,max_files:input.max_files_per_iteration??12});
    const commit=await adapters.commit({iteration,changed_files:authority.changed_files,repair:repaired});
    if(!clean(commit?.commit_sha,180)) throw new Error('VISUAL_REPAIR_COMMIT_REQUIRED');

    const render=await adapters.render({iteration,commit_sha:commit.commit_sha});
    const measurement=await adapters.measure({iteration,commit_sha:commit.commit_sha,render});
    const comparison=await adapters.compare({iteration,commit_sha:commit.commit_sha,render,measurement});
    if(!Array.isArray(comparison?.deltas)) throw new Error('VISUAL_REPAIR_COMPARISON_DELTAS_REQUIRED');

    const functional=await adapters.functional_regression({iteration,commit_sha:commit.commit_sha});
    if(functional?.status!=='PASS'){
      return {
        schema:'riosystems.visual-delta-closure-result.v1',
        status:'FUNCTIONAL_REGRESSION_FAILED',
        iterations:iteration,max_iterations:maxIterations,deltas:comparison.deltas.map(clone),
        history:[...history,{iteration,phase:plan.phase,commit_sha:commit.commit_sha,changed_files:authority.changed_files,functional_status:functional?.status||'FAIL'}],
        human_decision_required:true
      };
    }

    deltas=comparison.deltas.map(clone);
    const currentSignature=blockingSignature(deltas);
    history.push({
      iteration,phase:plan.phase,commit_sha:commit.commit_sha,changed_files:authority.changed_files,
      blocking_before:previousSignature?previousSignature.split('|').filter(Boolean).length:0,
      blocking_after:deltas.filter(d=>d.blocking===true).length,
      functional_status:'PASS',
      order:['repair','commit','render','measure','compare','functional_regression']
    });

    if(!deltas.some(d=>d.blocking===true)){
      return {schema:'riosystems.visual-delta-closure-result.v1',status:'PASS',iterations:iteration,max_iterations:maxIterations,deltas,history,human_decision_required:false};
    }
    if(currentSignature===previousSignature){
      return {schema:'riosystems.visual-delta-closure-result.v1',status:'HUMAN_DECISION_REQUIRED',reason:'NO_DETERMINISTIC_DELTA_PROGRESS',iterations:iteration,max_iterations:maxIterations,deltas,history,human_decision_required:true};
    }
    previousSignature=currentSignature;
  }
  return {schema:'riosystems.visual-delta-closure-result.v1',status:'HUMAN_DECISION_REQUIRED',reason:'ITERATION_LIMIT_EXHAUSTED',iterations:maxIterations,max_iterations:maxIterations,deltas,history,human_decision_required:true};
}
