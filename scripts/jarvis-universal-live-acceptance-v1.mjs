#!/usr/bin/env node
/* Read-only on-host JARVIS adapter acceptance probe.
 * No write-capable HTTP verbs, no credentials logged, no shell, no paid APIs.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const socket='/opt/jarvis/owner-deploy-queue/owner-control.sock';
const root='/opt/jarvis/chatgpt-test';
const readEndpoint = endpoint => {
  const output=execFileSync('curl',[
    '--silent','--show-error','--fail','--max-time','4',
    '--unix-socket',socket,'http://localhost'+endpoint
  ],{encoding:'utf8',timeout:6000});
  return JSON.parse(output);
};
const out={schema:'jarvis.universal-adapter.live-acceptance.v1',
  observed_at:new Date().toISOString(),read_only:true,checks:[]};
const check=(id,pass,detail)=>out.checks.push({id,status:pass?'PASS':'BLOCKED',detail});
try{
  const stat=readEndpoint('/v1/status');
  const targets=readEndpoint('/v1/project-targets');
  const truth=readEndpoint('/v1/runtime-truth');
  check('CORE_ONLINE',stat.ok===true&&stat.core_online===true,
    'private owner-control socket');
  const ids=Object.keys(targets.targets||{}).sort();
  check('LUKAS_LIVE_REGISTRATION',ids.includes('LUKAS_PAFF'),
    'registry_revision='+targets.revision+' ids='+ids.join(','));
  check('CLAUDE_BRIDGE_GENERAL',
    truth?.command_chain?.claude_execution_bridge_bound===true,
    'bridge runtime truth (general, not project-specific)');
  const st=fs.statSync(root);
  let readable=false;
  try {fs.accessSync(root,fs.constants.R_OK|fs.constants.X_OK);readable=true;}
  catch {}
  check('RUNTIME_SOURCE_ACCESS',readable,
    'source inaccessible to current connected user; no permission override attempted');
  check('PROJECT_CLAUDE_E2E',false,'requires approved runtime integration and independent execution');
}catch(e){
  out.probe_error=String(e?.code||e?.message||e).slice(0,180);
}
out.accepted=out.checks.length>=5&&out.checks.every(c=>c.status==='PASS');
console.log(JSON.stringify(out,null,2));
if(!out.accepted)process.exitCode=2;
