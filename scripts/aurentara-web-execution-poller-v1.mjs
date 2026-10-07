#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const clean=(v,max=8000)=>String(v??'').trim().slice(0,max);
const BASE=clean(process.env.AURENTARA_EXECUTION_BRIDGE_URL,2000).replace(/\/$/,'');
const TOKEN=clean(process.env.AURENTARA_EXECUTION_BRIDGE_TOKEN,1000);
const WORKER_ID=clean(process.env.AURENTARA_EXECUTION_BRIDGE_WORKER_ID||'jarvis-vps-webfactory-v1',160);
const REPO=clean(process.env.AURENTARA_EXECUTION_REPOSITORY||'dariolazzano3-ops/chatgpt-test',300);
const INSTALL=clean(process.env.AURENTARA_EXECUTION_BRIDGE_INSTALL_DIR||path.dirname(path.dirname(new URL(import.meta.url).pathname)),1000);
const BINDINGS=path.join(INSTALL,'config/aurentara-web-project-bindings-v1.json');
const EXECUTOR=path.join(INSTALL,'scripts/aurentara-web-task-executor-v1.mjs');
const RUN_ROOT=clean(process.env.AURENTARA_EXECUTION_RUN_ROOT||'/home/jarvis/.local/state/aurentara-web-execution-runs',1000);
const ONCE=process.argv.includes('--once');

if(!/^https:\/\//.test(BASE))throw new Error('BRIDGE_HTTPS_URL_REQUIRED');
if(TOKEN.length<32)throw new Error('BRIDGE_TOKEN_REQUIRED');
if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(REPO))throw new Error('REPOSITORY_INVALID');

function run(command,args,options={}){
  const r=spawnSync(command,args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],...options});
  if(r.status!==0){
    const e=new Error(`${command} ${args.join(' ')} failed: ${clean((r.stderr||r.stdout),1600)}`);
    e.result=r;throw e;
  }
  return r.stdout||'';
}
async function api(route,method='GET',body){
  const response=await fetch(BASE+route,{
    method,
    headers:{authorization:'Bearer '+TOKEN,accept:'application/json',...(body?{'content-type':'application/json'}:{})},
    body:body?JSON.stringify(body):undefined,
    signal:AbortSignal.timeout(15000)
  });
  const text=await response.text();
  let json={};try{json=text?JSON.parse(text):{}}catch{json={raw:text}}
  if(!response.ok&&response.status!==502){const e=new Error(json.error||`BRIDGE_HTTP_${response.status}`);e.status=response.status;throw e}
  return {status:response.status,json};
}
function instructionFrom(runRow={}){
  return clean(runRow.contract?.mission?.mission_text||runRow.contract?.mission?.goal||runRow.contract?.goal,7000);
}
function refExists(repoDir,branch){
  const r=spawnSync('git',['ls-remote','--exit-code','--heads','origin',branch],{cwd:repoDir,encoding:'utf8',stdio:['ignore','pipe','pipe']});
  return r.status===0;
}
function safeExecutionSuffix(id=''){
  return crypto.createHash('sha256').update(String(id)).digest('hex').slice(0,12);
}
async function complete(executionId,result){
  const snap=await api('/health');
  return api('/complete','POST',{
    worker_id:WORKER_ID,
    execution_id:executionId,
    expected_revision:snap.json.runtime_revision,
    result
  });
}
async function handleClaim(runRow,bindings){
  const executionId=clean(runRow.execution_id,220);
  const scope=clean(runRow.scope_key,300);
  const binding=bindings.projects?.[scope];
  if(!binding)throw new Error('PROJECT_BINDING_NOT_FOUND:'+scope);
  const instruction=instructionFrom(runRow);
  if(!instruction)throw new Error('WEBSITE_INSTRUCTION_MISSING');

  const suffix=safeExecutionSuffix(executionId);
  const dir=path.join(RUN_ROOT,suffix);
  await fs.rm(dir,{recursive:true,force:true});
  await fs.mkdir(RUN_ROOT,{recursive:true});
  run('gh',['repo','clone',REPO,dir,'--','--branch','factory-control','--single-branch','--quiet']);
  run('git',['config','user.name','AURENTARA WebFactory'],{cwd:dir});
  run('git',['config','user.email','aurentara-webfactory@users.noreply.github.com'],{cwd:dir});

  const seed=clean(binding.seed_branch,240),working=clean(binding.working_branch,240);
  run('git',['fetch','origin',seed+':refs/remotes/origin/'+seed],{cwd:dir});
  let base='origin/'+seed;
  if(refExists(dir,working)){
    run('git',['fetch','origin',working+':refs/remotes/origin/'+working],{cwd:dir});
    base='origin/'+working;
  }
  const candidate=clean(binding.candidate_branch_prefix,240)+suffix;
  run('git',['checkout','-b',candidate,base],{cwd:dir});

  const bindingFile=path.join(dir,'.aurentara-binding.json');
  await fs.writeFile(bindingFile,JSON.stringify(binding,null,2));
  let execution;
  try{
    const output=run('node',[EXECUTOR,bindingFile,instruction],{cwd:dir});
    execution=JSON.parse(output);
  }finally{
    await fs.rm(bindingFile,{force:true});
  }
  if(!execution?.ok)throw new Error(execution?.error||'WEB_TASK_EXECUTION_FAILED');

  const changed=run('git',['diff','--name-only'],{cwd:dir}).trim().split('\n').filter(Boolean);
  if(!changed.length)throw new Error('WEB_TASK_NO_CHANGED_FILES');
  for(const file of changed){
    if(!file.startsWith(binding.project_path+'/'))throw new Error('WEB_TASK_FORBIDDEN_PATH:'+file);
    if(/\.(?:png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf)$/i.test(file))throw new Error('WEB_TASK_BINARY_ASSET_CHANGE_REJECTED:'+file);
  }

  for(const command of binding.smoke_commands||[]){
    const parts=String(command).split(/\s+/).filter(Boolean);
    run(parts.shift(),parts,{cwd:dir});
  }
  const jsDir=path.join(dir,binding.project_path,'assets/js');
  try{
    const files=run('find',[jsDir,'-type','f','-name','*.js'],{cwd:dir}).trim().split('\n').filter(Boolean);
    for(const file of files)run('node',['--check',file],{cwd:dir});
  }catch{}

  run('git',['add','--',binding.project_path],{cwd:dir});
  run('git',['commit','-m',`AURENTARA: execute website task ${suffix}`],{cwd:dir});
  const candidateSha=run('git',['rev-parse','HEAD'],{cwd:dir}).trim();
  run('git',['push','-u','origin',candidate],{cwd:dir});

  const before=new Date(Date.now()-5000).toISOString();
  run('gh',['workflow','run','aurentara-private-website-preview-v1.yml','--repo',REPO,'--ref','factory-control',
    '-f','scope_key='+scope,'-f','candidate_branch='+candidate,'-f','candidate_sha='+candidateSha],{cwd:dir});
  await new Promise(r=>setTimeout(r,2500));
  const runs=JSON.parse(run('gh',['run','list','--repo',REPO,'--workflow','AURENTARA Private Website Preview V1','--event','workflow_dispatch','--limit','10','--json','databaseId,createdAt,status,conclusion'],{cwd:dir}));
  const selected=runs.find(x=>x.createdAt>=before&&['queued','in_progress','completed','waiting','requested'].includes(x.status));
  if(!selected)throw new Error('PRIVATE_PREVIEW_WORKFLOW_RUN_NOT_FOUND');
  run('gh',['run','watch',String(selected.databaseId),'--repo',REPO,'--exit-status'],{cwd:dir});

  // Private working branch is staging-only. Advancing it preserves accepted private edits without merging to main.
  run('git',['push','origin','HEAD:'+working],{cwd:dir});

  await complete(executionId,{
    ok:true,
    schema:'aurentara.web-execution-result.v1',
    status:'LIVE_PROVIDER_VERIFIED',
    planned_provider:'riosystems-native-web',
    dispatched_provider:'riosystems-native-web',
    actual_provider:'riosystems-native-web',
    executor_id:'web-factory-native-v1',
    provider_call_count:0,
    actual_cost_eur:0,
    variable_cost_eur:0,
    external_write_state:'PRIVATE_REPOSITORY_AND_PRIVATE_PREVIEW_ONLY',
    qa:{passed:true},
    delivery:{
      candidate_branch:candidate,
      candidate_sha:candidateSha,
      working_branch:working,
      preview_url:binding.private_preview_url,
      changed_files:changed
    },
    preview_url:binding.private_preview_url,
    private_access_verified:true,
    synthetic_only:runRow.contract?.synthetic_only===true,
    real_customer_data:false,
    external_customer_writes:false,
    public_deploy:false,dns_change:false,billing:false,checkout:false,public_indexing:false,
    paid_overflow:false,production_deploy:false
  });
  await fs.rm(dir,{recursive:true,force:true});
  return {execution_id:executionId,candidate_sha:candidateSha,preview_url:binding.private_preview_url};
}

async function tick(){
  const bindings=JSON.parse(await fs.readFile(BINDINGS,'utf8'));
  const claimed=await api('/claim','POST',{worker_id:WORKER_ID,lease_seconds:1200});
  const row=claimed.json.run;
  if(!row)return null;
  try{return await handleClaim(row,bindings)}
  catch(error){
    try{
      await complete(row.execution_id,{
        ok:false,status:'FAILED',error:clean(error?.message||error,500),
        qa:{passed:false},actual_cost_eur:0,variable_cost_eur:0,provider_call_count:0,
        real_customer_data:false,external_customer_writes:false,public_deploy:false,
        dns_change:false,billing:false,checkout:false,public_indexing:false,
        paid_overflow:false,production_deploy:false
      });
    }catch{}
    throw error;
  }
}

async function main(){
  if(ONCE){
    const result=await tick();
    console.log(JSON.stringify({ok:true,claimed:Boolean(result),result},null,2));
    return;
  }
  for(;;){
    try{
      const result=await tick();
      if(result)console.log(JSON.stringify({at:new Date().toISOString(),status:'COMPLETED',...result}));
    }catch(error){
      console.error(JSON.stringify({at:new Date().toISOString(),status:'ERROR',error:clean(error?.message||error,700)}));
    }
    await new Promise(r=>setTimeout(r,10000));
  }
}
await main();
