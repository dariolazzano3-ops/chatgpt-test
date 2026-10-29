#!/usr/bin/env node
/*
 * JARVIS Project Factory V1 -- rootless, fail-closed project enrollment.
 * Installed service runs as jarvis-operator; no root, secrets, hooks, paid APIs,
 * remote pushes, public deployments or arbitrary shell evaluation.
 * ChatGPT / trusted owner drops a JSON request into the protected inbox.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';

const ROOT = process.env.JARVIS_FACTORY_ROOT || '/opt/jarvis/project-factory';
const REGISTRY = process.env.JARVIS_FACTORY_REGISTRY || '/opt/jarvis/owner-deploy-queue/project-targets.v1.json';
const WORK = process.env.JARVIS_FACTORY_WORKSPACES || '/opt/jarvis/project-workspaces';
const INBOX = path.join(ROOT, 'inbox');
const DONE = path.join(ROOT, 'processed');
const BLOCKED = path.join(ROOT, 'blocked');
const LOCK = path.join(INBOX, '.reconcile.lock'); // writable within the systemd sandbox
const SCHEMA = 'jarvis.owner-project-onboard.v1';
const OWNER = 'dariolazzano3-ops';
const MAX_REQUESTS = 8;
const RE = /^[A-Z][A-Z0-9_]{2,63}$/;
const SAFE_SEG = /^[a-z0-9][a-z0-9._-]{0,90}$/i;
const BAD = (message) => { throw new Error(message); };

export function validateRequest(input, registry) {
  const r = input;
  if (!r || Array.isArray(r) || typeof r !== 'object' ||
      Object.keys(r).some(k=>!['schema','target_id','label','aliases','repository','branch','subdirectory','expected_head'].includes(k)))
    BAD('INVALID_REQUEST_FIELDS');
  if (r.schema !== SCHEMA || !RE.test(r.target_id || '')) BAD('INVALID_REQUEST_SCHEMA_OR_ID');
  if (!/^[a-f0-9]{40}$/.test(r.expected_head || '')) BAD('EXACT_GIT_HEAD_REQUIRED');
  if (typeof r.label !== 'string' || !r.label.trim() || r.label.length > 90) BAD('INVALID_LABEL');
  if (!Array.isArray(r.aliases) || !r.aliases.length || r.aliases.length > 6 ||
      r.aliases.some(a => typeof a!=='string'||!/^[a-zA-Z0-9 _.-]{3,80}$/.test(a)))
    BAD('INVALID_ALIASES');
  if (typeof r.repository !== 'string' || !new RegExp('^'+OWNER+'/[a-zA-Z0-9._-]{1,80}$').test(r.repository))
    BAD('REPOSITORY_OWNER_NOT_ALLOWED');
  if (r.branch !== 'main' && !/^factory\/[a-zA-Z0-9][a-zA-Z0-9._/-]{2,100}$/.test(r.branch)) BAD('INVALID_BRANCH');
  if (/\/\//.test(r.branch) || /\.\./.test(r.branch) || /\/$/.test(r.branch)) BAD('INVALID_BRANCH_PATH');
  if (typeof r.subdirectory !== 'string') BAD('INVALID_SUBDIRECTORY');
  const segments = r.subdirectory.split('/');
  if (segments.length!==2 || segments[0]!=='projects' || !SAFE_SEG.test(segments[1]) || segments[1]==='.' || segments[1]==='..')
    BAD('PROJECT_PATH_MUST_BE_PROJECTS_SLUG');
  if (!registry || registry.schema!=='aurentara.jarvis.project-target-registry.v1' ||
      !registry.targets || typeof registry.targets!=='object') BAD('UNSUPPORTED_REGISTRY');
  const nameSet = new Set(r.aliases.map(a=>a.trim().toLowerCase()));
  if (nameSet.size!==r.aliases.length) BAD('DUPLICATE_ALIASES');
  if (Object.hasOwn(registry.targets,r.target_id)) BAD('TARGET_ID_ALREADY_REGISTERED');
  const tokens = new Set(Object.values(registry.targets).flatMap(v=>[
    v.target_id, v.label, ...(v.route_aliases || [])
  ].filter(Boolean).map(x=>String(x).trim().toLowerCase())));
  if (tokens.has(r.target_id.toLowerCase()) || tokens.has(r.label.trim().toLowerCase()) ||
      [...nameSet].some(x=>tokens.has(x))) BAD('TARGET_ROUTE_COLLISION');
  return { ...r, aliases:r.aliases.map(x=>x.trim()), label:r.label.trim() };
}

export function buildQuarantinedTargetV1(q,repoDir) {
  const guidance='Project only: edit files under '+q.subdirectory+
    '. No other projects, credentials, .git, CI config, pushes, public deployment, DNS, billing, subscriptions, or destructive commands without separate explicit approval. No paid models by default. Claude is sole code-edit actor; require independent tests and commit evidence.';
  return {
    target_id:q.target_id,label:q.label,route_aliases:[...q.aliases],
    program:'PROJECT_MISSION_V1',repo_dir:repoDir,
    bridge_project:q.subdirectory.split('/')[1],
    target_branch:q.branch,enabled:false,execution_guidance:guidance
  };
}

function git(args,cwd=null){
  return execFileSync('git',args,{
    cwd:cwd||undefined,encoding:'utf8',timeout:120000,
    env:{...process.env,GIT_TERMINAL_PROMPT:'0',GIT_CONFIG_NOSYSTEM:'1'}
  }).trim();
}
function atomicWrite(file,bytes,mode=0o640) {
  const tmp=file+'.tmp-'+crypto.randomUUID();
  try {
    fs.writeFileSync(tmp,bytes,{flag:'wx',mode});
    fs.renameSync(tmp,file);
  } finally {if(fs.existsSync(tmp))fs.unlinkSync(tmp);}
}
export function archiveRequest(sourceName,toDir) {
  const src=path.join(INBOX,sourceName);
  const dst=path.join(toDir,sourceName);
  if(fs.existsSync(dst))BAD('ARCHIVE_ALREADY_EXISTS');
  // systemd ReadWritePaths exposes queue directories as separate mounts.
  // rename(2) may return EXDEV even when they share underlying storage.
  try {fs.renameSync(src,dst);}
  catch(err) {
    if(err.code!=='EXDEV')throw err;
    fs.copyFileSync(src,dst,fs.constants.COPYFILE_EXCL);
    fs.unlinkSync(src);
  }
}
function isSafeSubtree(root){
  for (const entry of fs.readdirSync(root,{withFileTypes:true})){
    const name=entry.name, full=path.join(root,name);
    if(entry.isSymbolicLink())BAD('SYMLINK_DISALLOWED');
    if(entry.isDirectory())isSafeSubtree(full);
    else if(!entry.isFile())BAD('SPECIAL_FILE_DISALLOWED');
  }
}
function validateRegistry(){return JSON.parse(fs.readFileSync(REGISTRY,'utf8'));}
function installOne(request,sourceName) {
  const current=validateRegistry();
  const q=validateRequest(request,current);
  if(!Number.isInteger(current.revision)||current.revision<1) BAD('INVALID_REVISION');
  if(!fs.existsSync(INBOX)||!fs.existsSync(DONE)||!fs.existsSync(BLOCKED)||!fs.existsSync(WORK)) BAD('BOOTSTRAP_MISSING');
  const target=path.join(WORK,q.target_id);
  if(fs.existsSync(target))BAD('WORKSPACE_ALREADY_EXISTS');
  const url='https://github.com/'+q.repository+'.git';
  const temp=path.join(WORK,'.incoming-'+crypto.randomUUID());
  let complete=false;
  try {
    // Create the clone root private BEFORE contacting GitHub; even a
    // partially completed checkout must not be exposed to shared workers.
    fs.mkdirSync(temp,{mode:0o700});
    fs.chmodSync(temp,0o700);
    git(['clone','--depth','1','--single-branch','--filter=blob:none','--sparse','--branch',q.branch,'--',''+url,temp]);
    git(['sparse-checkout','set','--',q.subdirectory],temp);
    const projectPath=path.join(temp,q.subdirectory);
    if(!fs.existsSync(path.join(projectPath,'preview.html')) && !fs.existsSync(path.join(projectPath,'README.md')))
      BAD('PROJECT_CONTENT_NOT_FOUND');
    isSafeSubtree(projectPath);
    const head=git(['rev-parse','HEAD'],temp);
    if(!/^[0-9a-f]{40}$/.test(head))BAD('HEAD_UNVERIFIED');
    if(head!==q.expected_head)BAD('REMOTE_HEAD_CHANGED_NOT_APPROVED');
    // Atomic rename publishes only after checkout verification.
    fs.renameSync(temp,target);
    // Quarantine first: no shared worker-group access during enrollment.
    // A separately verified per-project sandbox must grant any later Claude
    // file access. Never give all workers group-write access to every project.
    function permissions(base,inGit=false) {
      const isGit=inGit||path.basename(base)==='.git';
      fs.chownSync(base,process.getuid(),process.getgid());
      fs.chmodSync(base,0o700);
      for(const entry of fs.readdirSync(base,{withFileTypes:true})){
        const next=path.join(base,entry.name);
        if(entry.isDirectory())permissions(next,isGit);
        else {
          if(!entry.isFile())BAD('NONREGULAR_FILE');
          const st=fs.statSync(next);
          fs.chownSync(next,process.getuid(),process.getgid());
          fs.chmodSync(next,st.mode&0o111?0o700:0o600);
        }
      }
    }
    permissions(target);
    // Registration is discovery only, NOT execution authorization.
    const before=fs.readFileSync(REGISTRY);
    const fresh=JSON.parse(before);
    validateRequest(q,fresh);  // concurrency/collision recheck, while lock held
    const now=new Date().toISOString();
    fresh.targets[q.target_id]=buildQuarantinedTargetV1(q,target);
    fresh.revision+=1;fresh.updated_at=now;
    const backup=REGISTRY+'.backup-'+Date.now();
    fs.writeFileSync(backup,before,{flag:'wx',mode:0o640});
    const st=fs.statSync(REGISTRY);
    atomicWrite(REGISTRY,JSON.stringify(fresh,null,2)+'\n',st.mode & 0o777);
    // Same owner as registry; preserve group in case umask / dir defaults differ.
    fs.chownSync(REGISTRY,st.uid,st.gid);
    const result={schema:'jarvis.project-onboard-result.v1',target_id:q.target_id,
      repo_dir:target,branch:q.branch,head,registered_at:now,
      registry_revision:fresh.revision,execution_ready:false,
      note:'Registration does not prove Claude worker binding or execution authorization'};
    atomicWrite(path.join(DONE,sourceName+'.result.json'),JSON.stringify(result,null,2)+'\n');
    archiveRequest(sourceName,DONE);
    complete=true;
    console.log('REGISTERED',JSON.stringify(result));
  } finally {
    if(fs.existsSync(temp))fs.rmSync(temp,{recursive:true,force:true});
    if(!complete)console.error('INCOMPLETE_OR_BLOCKED',q.target_id,'Review registry/workspace before retry; not auto-retried');
  }
}
function main(){
  const args=process.argv.slice(2);
  if(args[0]==='--validate'&&args[1]&&args.length===2) {
    const r=JSON.parse(fs.readFileSync(args[1],'utf8'));
    const registry=validateRegistry();
    console.log(JSON.stringify({ok:true,request:validateRequest(r,registry)},null,2));return;
  }
  if(args[0]==='--enqueue'&&args[1]&&args.length===2) {
    const input=JSON.parse(fs.readFileSync(args[1],'utf8'));
    const request=validateRequest(input,validateRegistry());
    if(!fs.existsSync(INBOX)||!fs.statSync(INBOX).isDirectory())BAD('BOOTSTRAP_INBOX_MISSING');
    const file='request-'+crypto.randomUUID()+'.json';
    const dest=path.join(INBOX,file);
    fs.writeFileSync(dest,JSON.stringify(request,null,2)+'\n',{flag:'wx',mode:0o640});
    console.log(JSON.stringify({queued:true,file,target_id:request.target_id,
      expected_head:request.expected_head,paid_fallback_approved:false,
      public_deployment_approved:false}));return;
  }
  if(args[0]!=='--reconcile'||args.length!==1)BAD('USAGE: --validate FILE | --enqueue FILE | --reconcile');
  // One service invocation per timer tick. Single writer lock, no arbitrary command execution.
  fs.mkdirSync(ROOT,{recursive:true});
  let fd;
  try{fd=fs.openSync(LOCK,'wx',0o600);}catch(e){BAD('ANOTHER_RECONCILE_IN_PROGRESS');}
  try{
    const names=fs.readdirSync(INBOX).filter(n=>/^[a-z0-9_-]{4,80}\.json$/.test(n)).sort().slice(0,MAX_REQUESTS);
    for(const name of names){
      try{
        const file=path.join(INBOX,name);
        const st=fs.lstatSync(file);
        if(!st.isFile()||st.isSymbolicLink()||st.size>4096)BAD('INVALID_QUEUE_FILE');
        installOne(JSON.parse(fs.readFileSync(file,'utf8')),name);
      }catch(err){
        console.error('REQUEST_BLOCKED',name,String(err.message));
        const failedPath=path.join(BLOCKED,name);
        if(!fs.existsSync(failedPath)) {
          archiveRequest(name,BLOCKED);
          atomicWrite(failedPath+'.error.json',JSON.stringify({
            blocked_at:new Date().toISOString(),reason:String(err.message),
            manual_review_required:true,no_automatic_retry:true
          },null,2)+'\n',0o640);
        }
      }
    }
  }finally{fs.closeSync(fd);fs.unlinkSync(LOCK);}
}
if(process.argv[1] && path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname)){
  try{main()}catch(err){console.error('FACTORY_ERROR',err.message);process.exitCode=2;}
}
