import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const controlRef = 'factory-control';
const TERMINAL = new Set(['READY_FOR_REVIEW', 'WORKSHOP_REQUIRED', 'FAILED']);

function headers() {
  if (!token) throw new Error('GITHUB_TOKEN_REQUIRED');
  if (!repository || !repository.includes('/')) throw new Error('GITHUB_REPOSITORY_REQUIRED');
  return {
    authorization: `Bearer ${token}`,
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
    'content-type': 'application/json'
  };
}
function safeId(value) { const id=String(value||'').trim().toLowerCase(); if(!/^[a-z0-9][a-z0-9._-]{7,127}$/.test(id)) throw new Error('JOB_ID_INVALID'); return id; }
async function readJson(path, required=false){const response=await fetch(`https://api.github.com/repos/${repository}/contents/${path}?ref=${encodeURIComponent(controlRef)}`,{headers:headers()});if(response.status===404&&!required)return{sha:null,value:null};if(!response.ok)throw new Error(`JOB_STATE_READ_FAILED_${response.status}:${(await response.text()).slice(0,240)}`);const body=await response.json();return{sha:body.sha,value:JSON.parse(Buffer.from(body.content,'base64').toString('utf8'))};}
async function writeJson(path,value,sha,message){const payload={message,content:Buffer.from(`${JSON.stringify(value,null,2)}\n`).toString('base64'),branch:controlRef};if(sha)payload.sha=sha;const response=await fetch(`https://api.github.com/repos/${repository}/contents/${path}`,{method:'PUT',headers:headers(),body:JSON.stringify(payload)});if(!response.ok)throw new Error(`JOB_STATE_WRITE_FAILED_${response.status}:${(await response.text()).slice(0,360)}`);}
function currentGitSha(){try{const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();return/^[0-9a-f]{40}$/i.test(sha)?sha:null;}catch{return null;}}
export function deriveJobId(requestKey,requestFile=''){if(requestKey)return safeId(requestKey);return crypto.createHash('sha256').update(String(requestFile)).digest('hex');}
export async function updateFactoryJob(jobId,patch={}){const id=safeId(jobId);const path=`factory-state/jobs/${id}.json`;for(let attempt=1;attempt<=4;attempt++){const current=await readJson(path,false);const now=new Date().toISOString();const existing=current.value&&typeof current.value==='object'?current.value:{};const retryReset=patch.status==='REQUESTED'?{qa_attempt:0,qa_status:'pending',last_error:null,failure_stage:null,retry_exhausted:false,qa_result:null,preview_url:null,commit_sha:null,branch:null,project_slug:null,revision:null}:{};const terminalCleanup=patch.status==='READY_FOR_REVIEW'?{last_error:null,failure_stage:null,retry_exhausted:false}:{};const inferredSha=patch.status==='READY_FOR_REVIEW'&&!patch.commit_sha?currentGitSha():null;const next={version:1,job_id:id,created_at:existing.created_at||now,max_qa_attempts:3,qa_attempt:0,production_deploy:false,...existing,...retryReset,...patch,...terminalCleanup,...(inferredSha?{commit_sha:inferredSha}:{}),job_id:id,production_deploy:false,updated_at:now};try{await writeJson(path,next,current.sha,`Factory job ${id.slice(0,12)}: ${next.status||'update'}`);return next;}catch(error){if(!String(error?.message||error).includes('409')||attempt===4)throw error;}}}
export async function failFactoryJobUnlessTerminal(jobId,patch={}){const id=safeId(jobId);const current=await readJson(`factory-state/jobs/${id}.json`,false);if(TERMINAL.has(String(current.value?.status||'')))return current.value;return updateFactoryJob(id,{...patch,status:'FAILED',qa_status:patch.qa_status||current.value?.qa_status||'not_run',production_deploy:false});}
export async function resolveCandidateRevision(projectSlug,qaOnly=false){const current=await readJson('factory-state/projects.json',false);const base=Number(current.value?.projects?.[projectSlug]?.edit_revision||0);return qaOnly?base:base+1;}
if(process.argv[1]?.endsWith('factory-job-state.mjs')&&process.argv[2]){const[jobId,status,patchRaw='{}']=process.argv.slice(2);const patch=JSON.parse(patchRaw);const result=status==='FAIL_SAFE'?await failFactoryJobUnlessTerminal(jobId,patch):await updateFactoryJob(jobId,{...patch,status});console.log(JSON.stringify(result,null,2));}
