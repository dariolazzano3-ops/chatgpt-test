import crypto from 'node:crypto';

export const VISUAL_FIXTURE_TRUTH_CLASS='VISUAL_FIXTURE';
const ALLOWED_ENVIRONMENTS=new Set(['local','test','ci','staging']);
const FORBIDDEN_WRITE_TARGETS=[
  /^project[_-]?knowledge$/i,
  /^runtime[_-]?truth$/i,
  /^runtime[_-]?facts?$/i,
  /^customer[_-]?truth$/i,
  /^production$/i,
  /^database$/i,
  /^supabase$/i
];

const clean=(v,max=1000)=>String(v??'').trim().slice(0,max);
const clone=v=>structuredClone(v);

function deepFreeze(value){
  if(!value||typeof value!=='object'||Object.isFrozen(value))return value;
  Object.freeze(value);
  for(const child of Object.values(value))deepFreeze(child);
  return value;
}

export function createVisualFixture(input={},options={}){
  const referenceId=clean(input.reference_id,180);
  const version=clean(input.version,80);
  if(!referenceId)throw new Error('VISUAL_FIXTURE_REFERENCE_ID_REQUIRED');
  if(!version)throw new Error('VISUAL_FIXTURE_VERSION_REQUIRED');
  const fixture={
    schema:'riosystems.visual-fixture.v1',
    fixture_id:clean(input.fixture_id||'vf-'+crypto.randomUUID(),180),
    reference_id:referenceId,
    version,
    truth_class:VISUAL_FIXTURE_TRUTH_CLASS,
    data:clone(input.data??{}),
    created_at:clean(options.now||new Date().toISOString(),80),
    project_knowledge_write_allowed:false,
    runtime_truth_write_allowed:false,
    production_allowed:false,
    customer_truth_claim_allowed:false
  };
  return deepFreeze(fixture);
}

export function assertVisualFixtureEnvironment(input={}){
  const environment=clean(input.environment||'',80).toLowerCase();
  if(!ALLOWED_ENVIRONMENTS.has(environment))throw new Error('VISUAL_FIXTURE_ENVIRONMENT_FORBIDDEN:'+environment);
  if(input.production===true||environment==='production')throw new Error('VISUAL_FIXTURE_PRODUCTION_FORBIDDEN');
  if(input.public===true)throw new Error('VISUAL_FIXTURE_PUBLIC_RUNTIME_FORBIDDEN');
  return {ok:true,environment,truth_class:VISUAL_FIXTURE_TRUTH_CLASS};
}

export function assertFixtureWriteAllowed(operation={}){
  const target=clean(operation.target,120);
  if(!target)throw new Error('FIXTURE_WRITE_TARGET_REQUIRED');
  if(FORBIDDEN_WRITE_TARGETS.some(pattern=>pattern.test(target)))throw new Error('VISUAL_FIXTURE_WRITE_FORBIDDEN:'+target);
  const scope=clean(operation.scope||'fixture-evidence',120).toLowerCase();
  if(!['fixture-evidence','visual-artifact','temporary-render'].includes(scope))throw new Error('VISUAL_FIXTURE_WRITE_SCOPE_FORBIDDEN:'+scope);
  return {ok:true,target,scope};
}

export function createFixtureSession(fixture,input={}){
  if(!fixture||fixture.schema!=='riosystems.visual-fixture.v1'||fixture.truth_class!==VISUAL_FIXTURE_TRUTH_CLASS)throw new Error('VISUAL_FIXTURE_REQUIRED');
  const environment=assertVisualFixtureEnvironment(input);
  return deepFreeze({
    schema:'riosystems.visual-fixture-session.v1',
    session_id:clean(input.session_id||'vfs-'+crypto.randomUUID(),180),
    fixture_id:fixture.fixture_id,
    reference_id:fixture.reference_id,
    truth_class:VISUAL_FIXTURE_TRUTH_CLASS,
    environment:environment.environment,
    data:clone(fixture.data),
    isolation:{
      project_knowledge:false,
      runtime_truth:false,
      customer_truth:false,
      production:false,
      public:false
    }
  });
}

export function applyFixtureToViewModel(runtimeViewModel={},session={}){
  if(session?.schema!=='riosystems.visual-fixture-session.v1'||session.truth_class!==VISUAL_FIXTURE_TRUTH_CLASS)throw new Error('VISUAL_FIXTURE_SESSION_REQUIRED');
  return deepFreeze({
    ...clone(runtimeViewModel),
    ...clone(session.data),
    __visual_foundry:{
      truth_class:VISUAL_FIXTURE_TRUTH_CLASS,
      fixture_session_id:session.session_id,
      runtime_truth_overridden_in_memory_only:true,
      persistent_write_allowed:false
    }
  });
}

export function detectFixtureLeak(payload={}){
  const leaks=[];
  const walk=(value,path='root')=>{
    if(Array.isArray(value)){value.forEach((v,i)=>walk(v,`${path}[${i}]`));return;}
    if(!value||typeof value!=='object')return;
    for(const [key,val] of Object.entries(value)){
      const combined=`${path}.${key}`;
      if(/truth_class/i.test(key)&&String(val)!==VISUAL_FIXTURE_TRUTH_CLASS)leaks.push({code:'FIXTURE_TRUTH_CLASS_CORRUPTED',path:combined});
      if(/runtime_truth_write_allowed|project_knowledge_write_allowed|production_allowed|persistent_write_allowed/i.test(key)&&val===true)leaks.push({code:'FIXTURE_FORBIDDEN_WRITE_CAPABILITY',path:combined});
      walk(val,combined);
    }
  };
  walk(payload);
  return {ok:leaks.length===0,status:leaks.length?'FAIL':'PASS',leaks};
}
