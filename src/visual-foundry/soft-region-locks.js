const clone=v=>structuredClone(v);
const mapScores=result=>new Map((result?.regions||[]).map(r=>[r.region_id,Number(r.score??0)]));

export function createSoftRegionLockSet(input={}){
  const source=mapScores(input.measurement||{});
  const tolerance=Number(input.tolerance??0.002);
  const regions=[...new Set((input.regions||[...source.keys()]).map(String))].map(region_id=>({
    region_id,
    baseline_score:source.get(region_id)??null,
    tolerance,
    state:'SOFT_LOCKED'
  }));
  return {
    schema:'riosystems.soft-region-lock-set.v1',
    regions,
    mode:'WARN_DURING_SEARCH_BLOCK_AT_FINALIZATION',
    hard_locking:false
  };
}

export function evaluateSoftLockCandidate(lockSet={},measurement={}){
  const scores=mapScores(measurement);
  const warnings=[];
  for(const lock of lockSet.regions||[]){
    const after=scores.get(lock.region_id);
    if(!Number.isFinite(lock.baseline_score)||!Number.isFinite(after)){
      warnings.push({region_id:lock.region_id,code:'SOFT_LOCK_SCORE_MISSING',baseline:lock.baseline_score,actual:after??null});
      continue;
    }
    const regression=lock.baseline_score-after;
    if(regression>lock.tolerance)warnings.push({
      region_id:lock.region_id,code:'SOFT_LOCK_REGRESSION_WARNING',
      baseline:lock.baseline_score,actual:after,regression,tolerance:lock.tolerance
    });
  }
  return {
    schema:'riosystems.soft-region-lock-candidate.v1',
    status:warnings.length?'ACCEPT_WITH_REGRESSION_WARNING':'ACCEPT',
    warnings,
    candidate_blocked:false,
    finalization_required:true
  };
}

export function finalizeSoftRegionLocks(lockSet={},measurement={}){
  const candidate=evaluateSoftLockCandidate(lockSet,measurement);
  const unresolved=candidate.warnings;
  return {
    schema:'riosystems.soft-region-lock-finalization.v1',
    status:unresolved.length?'FAIL':'PASS',
    unresolved_regressions:clone(unresolved),
    global_acceptance_blocked:unresolved.length>0
  };
}

export function advanceSoftLockBaselines(lockSet={},measurement={},input={}){
  const scores=mapScores(measurement);
  const minimumImprovement=Number(input.minimum_improvement??0);
  const next=clone(lockSet);
  for(const lock of next.regions||[]){
    const after=scores.get(lock.region_id);
    if(Number.isFinite(after)&&Number.isFinite(lock.baseline_score)&&after>=lock.baseline_score+minimumImprovement){
      lock.baseline_score=after;
      lock.advanced=true;
    }
  }
  return next;
}
