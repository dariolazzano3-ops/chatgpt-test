#!/usr/bin/env node
/* Read-only preflight: independent GitHub HEAD + known project folder.
 * No clone, checkout, daemon, API charges, commits, writes or deployments.
 * The catalog in this local staging tree is NOT a production authorization.
 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { validateTrustedProjectCatalogV1 } from '../src/jarvis/universal-project-adapter-v1.js';
const jsonPath = new URL('../config/jarvis-project-catalog.v1.json',import.meta.url);
const safeEnv={...process.env,GIT_TERMINAL_PROMPT:'0',GIT_CONFIG_NOSYSTEM:'1'};
const git=(args,cwd)=>execFileSync('git',args,{cwd,env:safeEnv,encoding:'utf8',timeout:20000}).trim();
const sourceRepo=process.env.JARVIS_ADAPTER_STAGE_REPO || '/home/jarvis/auto-project-routing-v1';
const referenceClone=process.env.JARVIS_ADAPTER_REFERENCE_CLONE || '/home/jarvis/.jarvis-lukas-paff-stage-v1';
const output={schema:'jarvis.universal-project-preflight.v1',mode:'READ_ONLY',installed:false,checks:[]};
try {
  const sourceCommit=git(['rev-parse','HEAD'],sourceRepo);
  const raw=JSON.parse(fs.readFileSync(jsonPath,'utf8'));
  // For a staged candidate only: source SHA does not prove manifest is committed.
  const catalog=validateTrustedProjectCatalogV1(raw,{approved_source:true,verified_source_commit:sourceCommit});
  for(const p of catalog.projects){
    const url='https://github.com/'+p.repository+'.git';
    const lines=git(['ls-remote','--exit-code','--heads',url,p.branch]);
    const hit=lines.split('\n').find(l=>l.endsWith('\trefs/heads/'+p.branch));
    const remoteHead=hit?.split('\t')[0] || null;
    const remoteMatches=remoteHead===p.expected_head;
    output.checks.push({target_id:p.target_id,check:'GITHUB_REMOTE_HEAD',pass:remoteMatches,
      approved_head:p.expected_head,remote_head:remoteHead});
    const localHead=git(['rev-parse','HEAD'],referenceClone);
    output.checks.push({target_id:p.target_id,check:'LOCAL_REFERENCE_COMMIT',pass:localHead===remoteHead,
      local_head:localHead,remote_head:remoteHead,note:localHead!==remoteHead?'LOCAL_CHANGES_NOT_TO_BE_OVERWRITTEN':null});
    const tree=git(['ls-tree','-d',remoteHead,p.subdirectory],referenceClone);
    output.checks.push({target_id:p.target_id,check:'GIT_PROJECT_DIRECTORY',pass:tree.includes('\t'+p.subdirectory),
      path:p.subdirectory});
  }
  output.all_remote_checks_pass=output.checks.filter(c=>c.check!=='LOCAL_REFERENCE_COMMIT').every(c=>c.pass);
} catch(e){
  output.error=String(e.message || e).slice(0,500);
  output.all_remote_checks_pass=false;
}
console.log(JSON.stringify(output,null,2));
if(!output.all_remote_checks_pass)process.exitCode=2;
