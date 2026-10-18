/**
 * JARVIS Marketing Factory V3 — independent, bounded execution capability.
 *
 * This is a Node-only task adapter, NOT an HTTP endpoint or a second agent.
 * Existing JARVIS/Bridge may invoke this CLI for an approved local workspace.
 * V3 is private and PREPARE_ONLY; it cannot publish, schedule, spend, deploy
 * or access marketing providers.
 */
import { mkdir, readFile, writeFile, rename, realpath, stat } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { basename, dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { planMarketingDayV1 } from './marketing-factory-v1.mjs';
import { createMarketingBacklogV2 } from './daily-backlog-v2.mjs';

const SHA=/^[a-f0-9]{64}$/i;
const BRAND=/^[a-z0-9][a-z0-9_-]{1,47}$/;
function assertIn(root, file) {
  const target=resolve(file), base=resolve(root);
  if (target===base || !target.startsWith(base+sep)) throw new Error('PATH_OUTSIDE_PRIVATE_WORKSPACE');
  return target;
}
async function atomicJSON(path, data) {
  await mkdir(dirname(path),{recursive:true,mode:0o700});
  const temporary=path+'.tmp-'+randomUUID();
  try {
    await writeFile(temporary,JSON.stringify(data,null,2)+'\n',{flag:'wx',mode:0o600});
    await rename(temporary,path);
  } catch(error){
    try { await import('node:fs/promises').then(x=>x.unlink(temporary)); } catch {}
    throw error;
  }
}
async function loadProfile(root,brandId){
  if(!BRAND.test(brandId))throw new Error('INVALID_BRAND');
  const path=assertIn(root,join(root,'projects','marketing-factory','brands',brandId+'.json'));
  const p=JSON.parse(await readFile(path,'utf8'));
  if(p.brand_id!==brandId)throw new Error('BRAND_PROFILE_MISMATCH');
  return p;
}
function exec(program,args,{timeout=180000,env=process.env}={}){
  const r=spawnSync(program,args,{encoding:'utf8',timeout,maxBuffer:1024*1024,env});
  if(r.error || r.status!==0)throw new Error('PRIVATE_EXECUTION_FAILED:'+String(r.error?.code||r.status)+':'+String(r.stderr||'').slice(-350));
  return String(r.stdout||'');
}
function sha(buf){return createHash('sha256').update(buf).digest('hex');}
export async function runJarvisMarketingTaskV3(req,options={}){
  const task=String(req?.task||'');
  if(!['plan_day','plan_week','render_private','status'].includes(task))
    return {ok:false,state:'BLOCKED',reason:'EXTERNAL_ACTION_NOT_SUPPORTED'};
  const repoRoot=options.repoRoot;
  const workspace=options.privateWorkspace;
  if(!isAbsolute(repoRoot||'')||!isAbsolute(workspace||'')||workspace==='/'||workspace==='/tmp')
    throw new Error('EXPLICIT_REPO_AND_WORKSPACE_REQUIRED');
  const ws=resolve(workspace);
  await mkdir(ws,{recursive:true,mode:0o700});
  // In production the private workspace must not be inside the git repository.
  if(ws===resolve(repoRoot)||ws.startsWith(resolve(repoRoot)+sep))throw new Error('WORKSPACE_MUST_BE_ISOLATED');
  const brandId=String(req?.brandId||'');
  const profile=await loadProfile(resolve(repoRoot),brandId);
  const day=String(req?.day||'');
  const plan=planMarketingDayV1(profile,{day});
  const brandDir=assertIn(ws,join(ws,'brands',brandId));
  const jobDir=assertIn(brandDir,join(brandDir,'jobs',day));
  const planFile=assertIn(jobDir,join(jobDir,'plan.json'));
  const receiptFile=assertIn(jobDir,join(jobDir,'receipt.json'));
  if(task==='status'){
    let receipt=null;
    try {receipt=JSON.parse(await readFile(receiptFile,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
    return {ok:true,state:receipt?.state||'NOT_STARTED',receipt:receipt||null,
      publishing:'BLOCKED',automated_daily_runner:'OFF'};
  }
  await mkdir(jobDir,{recursive:true,mode:0o700});
  if(task==='plan_day'){
    // Do not overwrite a completed verified render receipt on a repeat planner run.
    try {
      const prior=JSON.parse(await readFile(receiptFile,'utf8'));
      if(prior.state==='PRIVATE_MEDIA_RENDERED' && prior.plan_id===plan.plan_id &&
         SHA.test(prior.media_sha256||'')) {
        const cached=await readFile(assertIn(jobDir,prior.media_path));
        if(sha(cached)===prior.media_sha256) return {...prior,idempotent_reuse:true};
      }
    } catch(error) {
      if(error.code!=='ENOENT' && error.message==='PATH_OUTSIDE_PRIVATE_WORKSPACE') throw error;
    }
    await atomicJSON(planFile,plan);
    const result={ok:true,state:'PLAN_PREPARED',brand_id:brandId,day,plan_id:plan.plan_id,
      plan_file:planFile,media_rendered:false,published:false};
    await atomicJSON(receiptFile,result);
    return result;
  }
  if(task==='plan_week'){
    const days=req.days===undefined?7:req.days;
    const backlog=createMarketingBacklogV2(profile,{startDate:day,days});
    const backlogFile=assertIn(brandDir,join(brandDir,'backlogs',day+'-'+days+'.json'));
    await atomicJSON(backlogFile,backlog);
    return {ok:true,state:'WEEK_PREPARED',brand_id:brandId,day,
      items:backlog.content_items.length,backlog_file:backlogFile,
      scheduler_active:false,published:false};
  }
  // render_private: an operator-supplied, licensed source image is required.
  if(req.ownerConfirmedArtwork!==true)return {ok:false,state:'BLOCKED',reason:'ARTWORK_RIGHTS_CONFIRMATION_REQUIRED'};
  const artRoot=resolve(options.artworkRoot||join(ws,'approved-artwork'));
  const requestedArt=String(req.artworkPath||'');
  if(!isAbsolute(requestedArt))return {ok:false,state:'BLOCKED',reason:'ARTWORK_PATH_REQUIRED'};
  const expectedArt=assertIn(artRoot,requestedArt);
  const artReal=await realpath(expectedArt);
  assertIn(artRoot,artReal);
  const artStat=await stat(artReal);
  if(!artStat.isFile() || artStat.size>30*1024*1024 || artStat.size<1024)
    throw new Error('INVALID_ARTWORK_FILE');
  if(!/\.(png|jpg|jpeg|webp)$/i.test(artReal))throw new Error('INVALID_ARTWORK_FORMAT');
  const artworkSha=sha(await readFile(artReal));
  const fingerprint=sha(Buffer.from([plan.plan_id,artworkSha,'renderer-v2'].join('|'))).slice(0,20);
  const dest=assertIn(jobDir,join(jobDir,fingerprint+'.mp4'));
  const existing=await (async()=>{
    try {const rec=JSON.parse(await readFile(receiptFile,'utf8'));
      if(rec.artwork_sha256===artworkSha && rec.media_path===dest && SHA.test(rec.media_sha256||'')){
        const file=await readFile(dest);
        if(sha(file)===rec.media_sha256)return rec;
      }
    }catch{}
    return null;
  })();
  if(existing)return {...existing,idempotent_reuse:true};
  await atomicJSON(planFile,plan);
  const python=options.pythonBin;
  const renderer=options.rendererScript;
  const ffmpeg=options.ffmpegBin;
  if(!isAbsolute(python||'')||!isAbsolute(renderer||'')||!isAbsolute(ffmpeg||''))
    throw new Error('EXPLICIT_RENDERER_BINARIES_REQUIRED');
  const environment={...process.env,PATH:dirname(ffmpeg)+':'+process.env.PATH};
  exec(python,[renderer,'--plan',planFile,'--art',artReal,'--out',dest],{timeout:240000,env:environment});
  const media=await readFile(dest);
  if(media.length<100000 || media.length>100*1024*1024)throw new Error('INVALID_RENDERED_MEDIA_SIZE');
  exec(ffmpeg,['-hide_banner','-loglevel','error','-i',dest,'-f','null','-'],{timeout:70000,env:environment});
  const receipt={ok:true,state:'PRIVATE_MEDIA_RENDERED',brand_id:brandId,day,
    plan_id:plan.plan_id,artwork_sha256:artworkSha,media_sha256:sha(media),
    media_path:dest,media_bytes:media.length,media_type:'video/mp4',
    aspect_ratio:'9:16',duration_seconds:22,media_is_public:false,
    publisher_connected:false,published:false,autopublish:false,marketing_spend:false,
    verification:'SHA256_AND_FFMPEG_DECODE_PASS',receipt_id:fingerprint};
  await atomicJSON(receiptFile,receipt);
  return receipt;
}
export function jarvisMarketingCapabilityV3(){
  return {task_id:'UNIVERSAL_MARKETING_FACTORY_V3',allowed_tasks:['plan_day','plan_week','render_private','status'],
    stage:'LOCAL_PREPARE',execution_host:'NODE_PRIVATE_WORKSPACE',
    integration_to_existing_jarvis:'CLI_TASK_ADAPTER_NOT_YET_LIVE_WIRED',
    public_posting:false,automatic_scheduler:false,marketing_spend:false,provider_token_access:false};
}
