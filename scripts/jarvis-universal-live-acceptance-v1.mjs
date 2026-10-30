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
  const lukas=targets.targets?.LUKAS_PAFF;
  check('LUKAS_REGISTERED_DORMANT',
    lukas?.enabled===false &&
    lukas?.repo_dir==='/opt/jarvis/project-workspaces/LUKAS_PAFF' &&
    lukas?.target_branch==='factory/lukas-paff-premium-v1',
    'registry_present='+Boolean(lukas)+' enabled='+lukas?.enabled);
  check('EXISTING_TARGETS_RETAINED',
    targets.targets?.AURENTARA?.enabled===true &&
    targets.targets?.JARVIS_AUTONOMY_TEST?.enabled===true,
    'existing enabled targets retained');
  const coreRevision=stat.automatic_project_target_status?.registry_revision;
  check('RUNTIME_CACHE_RECONCILED',coreRevision===targets.revision,
    'runtime_revision='+coreRevision+' disk_revision='+targets.revision);
  check('CLAUDE_BRIDGE_GENERAL',
    truth?.command_chain?.claude_execution_bridge_bound===true,
    'bridge runtime truth (general, not project-specific)');
  const st=fs.statSync(root);
  let readable=false;
  try {fs.accessSync(root,fs.constants.R_OK|fs.constants.X_OK);readable=true;}
  catch {}
  check('RUNTIME_SOURCE_DIRECT_ACCESS',readable,
    'direct operator source access may remain restricted; snapshot is separate');
  const snapshots=fs.readdirSync('/var/tmp').filter(name=>
    /^jarvis-maintenance-review-[a-zA-Z0-9_-]+$/.test(name));
  check('RUNTIME_READONLY_EXPORT_AVAILABLE',
    snapshots.some(name=>fs.existsSync('/var/tmp/'+name+'/runtime-source.tar')),
    'root-vetted source export available for review (not live edit permission)');
  const workspace='/opt/jarvis/project-workspaces/LUKAS_PAFF';
  let jarvisCanReach=false;
  try { fs.accessSync(workspace,fs.constants.R_OK|fs.constants.X_OK);jarvisCanReach=true; }
  catch {}
  check('DESKTOP_USER_CANNOT_READ_LUKAS',
    process.getuid?.()===1000 && !jarvisCanReach,
    'negative access test for jarvis only; does not prove isolation from other workers');
  const state=execFileSync('systemctl',['show','jarvis-project-factory.service',
    '-p','Result','-p','ExecMainStatus'],{encoding:'utf8',timeout:4000});
  check('PROJECT_FACTORY_HEALTHY',state.includes('Result=success') &&
    state.includes('ExecMainStatus=0'),'latest factory service result');
  check('CLAUDE_PROJECT_SANDBOX_E2E',false,
    'independent Claude worker identity, cross-project negative tests and project binding outstanding');
  check('PROJECT_CLAUDE_E2E',false,
    'requires project-specific approved fixture execution and independent audit; no model job sent');
}catch(e){
  out.probe_error=String(e?.code||e?.message||e).slice(0,180);
}
out.accepted=out.checks.length>=5&&out.checks.every(c=>c.status==='PASS');
console.log(JSON.stringify(out,null,2));
if(!out.accepted)process.exitCode=2;
