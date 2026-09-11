export const J14_WAVES = Object.freeze([
  'J1','J2','J3','J4','J5','J6','J7','J8','J9','J10','J11','J12','J13','J14'
]);

export const J14_REQUIRED_SYNTHETIC_STAGES = Object.freeze([
  'PROJECT_KNOWLEDGE',
  'REFERENCE',
  'BUILD',
  'VISUAL_CLOSURE',
  'BROWSER_ACCESSIBILITY_PERFORMANCE',
  'VERSIONING_DIFF_ROLLBACK',
  'DASHBOARD_CONTROL_PLANE',
  'NEXT_BEST_ACTION',
  'DELIVERY_LIFECYCLE',
  'DELIVERY_PACKAGE_VERIFICATION'
]);

const clean=(v,max=1000)=>String(v??'').replace(/\s+/g,' ').trim().slice(0,max);
const clone=(v)=>v==null?v:structuredClone(v);
const arr=(v)=>Array.isArray(v)?v:[];

function safety(input={}){
  return {
    automatic_execution: input.automatic_execution===true,
    automatic_merge: input.automatic_merge===true,
    production_deploy: input.production_deploy===true,
    public_launch: input.public_launch===true,
    dns_change: input.dns_change===true,
    billing_activation: input.billing_activation===true,
    automatic_paid_activation: input.automatic_paid_activation===true,
    external_writes: input.external_writes===true
  };
}

function unsafeFlags(s={}){
  return Object.entries(s).filter(([,v])=>v===true).map(([k])=>k);
}

export function evaluateJ14PrerequisiteWaves(input={}){
  const waves=arr(input.waves);
  const required=J14_WAVES.slice(0,13);
  const byId=new Map(waves.map((w)=>[clean(w.wave,20).toUpperCase(),w]));
  const missing=[];
  const rejected=[];
  for(const id of required){
    const row=byId.get(id);
    if(!row){missing.push(id);continue;}
    if(clean(row.status,80).toUpperCase()!=='CANONICAL_ACCEPTED'||row.exact_head_verified!==true){
      rejected.push({wave:id,status:row.status||null,exact_head_verified:row.exact_head_verified===true});
    }
  }
  const safe=safety(input.safety||{});
  const unsafe=unsafeFlags(safe);
  return {
    schema:'riosystems.j14-prerequisite-waves.v1',
    status:missing.length||rejected.length||unsafe.length?'BLOCK':'PASS',
    required,
    accepted_count:required.length-missing.length-rejected.length,
    missing,
    rejected,
    unsafe_flags:unsafe,
    safety:safe
  };
}

export function evaluateJ14SyntheticFullDogfood(input={}){
  const stages=arr(input.stages);
  const byId=new Map(stages.map((s)=>[clean(s.stage,120).toUpperCase(),s]));
  const missing=[];
  const failed=[];
  for(const id of J14_REQUIRED_SYNTHETIC_STAGES){
    const row=byId.get(id);
    if(!row){missing.push(id);continue;}
    if(clean(row.status,80).toUpperCase()!=='PASS') failed.push({stage:id,status:row.status||null});
  }
  const safe=safety(input.safety||{});
  const unsafe=unsafeFlags(safe);
  const variableCost=Number(input.variable_cost_eur||0);
  const costOk=Number.isFinite(variableCost)&&variableCost===0;
  const packageVerified=input.delivery_package_verified===true;
  const exactOnePrimary=input.exactly_one_primary_action===true;
  return {
    schema:'riosystems.j14-synthetic-full-dogfood.v1',
    status:missing.length||failed.length||unsafe.length||!costOk||!packageVerified||!exactOnePrimary?'FAIL':'PASS',
    project_scope:clean(input.project_scope,320)||null,
    required_stages:[...J14_REQUIRED_SYNTHETIC_STAGES],
    passed_stage_count:J14_REQUIRED_SYNTHETIC_STAGES.length-missing.length-failed.length,
    missing,
    failed,
    delivery_package_verified:packageVerified,
    exactly_one_primary_action:exactOnePrimary,
    variable_cost_eur:costOk?0:variableCost,
    unsafe_flags:unsafe,
    safety:safe,
    evidence:clone(input.evidence||null)
  };
}

export function evaluateJ14RealProjectIntegrity(input={}){
  const projectKind=clean(input.project_kind,80).toUpperCase();
  const blockers=arr(input.blockers).map((x)=>clean(typeof x==='string'?x:x?.code,180)).filter(Boolean);
  const claimedReady=input.claimed_ready===true;
  const expectedBlocked=input.expected_blocked===true;
  const mutated=input.mutated===true;
  const fakePass=blockers.length>0&&claimedReady;
  const safe=safety(input.safety||{});
  const unsafe=unsafeFlags(safe);
  const status=(projectKind==='REAL'&&expectedBlocked&&blockers.length>0&&!claimedReady&&!mutated&&!fakePass&&!unsafe.length)
    ?'PASS'
    :(projectKind==='REAL'&&!expectedBlocked&&blockers.length===0&&claimedReady&&!mutated&&!unsafe.length?'PASS':'FAIL');
  return {
    schema:'riosystems.j14-real-project-integrity.v1',
    status,
    project_scope:clean(input.project_scope,320)||null,
    project_kind:projectKind||'NOT_VERIFIED',
    blockers,
    expected_blocked:expectedBlocked,
    claimed_ready:claimedReady,
    mutated,
    fake_pass_detected:fakePass,
    unsafe_flags:unsafe,
    safety:safe,
    evidence:clone(input.evidence||null)
  };
}

export function evaluateJ14FullDogfoodClosure(input={}){
  const prerequisites=evaluateJ14PrerequisiteWaves(input.prerequisites||{});
  const synthetic=evaluateJ14SyntheticFullDogfood(input.synthetic_full_dogfood||{});
  const real=evaluateJ14RealProjectIntegrity(input.real_project_integrity||{});
  const pass=prerequisites.status==='PASS'&&synthetic.status==='PASS'&&real.status==='PASS';
  const blockers=[];
  if(prerequisites.status!=='PASS') blockers.push('J14_PREREQUISITE_WAVES_REQUIRED');
  if(synthetic.status!=='PASS') blockers.push('J14_SYNTHETIC_FULL_DOGFOOD_REQUIRED');
  if(real.status!=='PASS') blockers.push('J14_REAL_PROJECT_INTEGRITY_REQUIRED');
  return {
    schema:'riosystems.j14-full-dogfood-closure.v1',
    status:pass?'ACCEPTED_FOR_CANONICAL_MERGE':'BLOCK',
    ready_for_canonical_merge:pass,
    canonical_wave_count_before_merge:13,
    canonical_wave_count_after_verified_merge:pass?14:13,
    canonical_percent_before_merge:92.9,
    canonical_percent_after_verified_merge:pass?100:92.9,
    prerequisites,
    synthetic_full_dogfood:synthetic,
    real_project_integrity:real,
    blockers,
    no_fake_pass:true,
    real_project_delivery_not_required_when_truthfully_blocked:true,
    synthetic_full_lifecycle_required:true,
    post_merge_exact_head_verification_required:true,
    automatic_execution:false,
    automatic_merge:false,
    production_deploy:false,
    public_launch:false,
    dns_change:false,
    billing_activation:false,
    automatic_paid_activation:false,
    external_writes:false,
    variable_cost_eur:0
  };
}

export function j14FullDogfoodClosureManifest(){
  return {
    schema:'riosystems.j14-full-dogfood-closure-manifest.v1',
    waves:[...J14_WAVES],
    prerequisite_waves:J14_WAVES.slice(0,13),
    required_synthetic_stages:[...J14_REQUIRED_SYNTHETIC_STAGES],
    synthetic_full_lifecycle_required:true,
    real_project_integrity_sentinel_required:true,
    real_project_may_remain_blocked_when_evidence_is_incomplete:true,
    fake_real_project_pass_forbidden:true,
    post_merge_exact_head_verification_required:true,
    final_canonical_percent:100,
    automatic_execution:false,
    automatic_merge:false,
    production_deploy:false,
    public_launch:false,
    dns_change:false,
    billing_activation:false,
    automatic_paid_activation:false,
    external_writes:false
  };
}
