import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { resolveProjectWorkerBindingV1, createProjectLocalPublisherV1 } from '../src/jarvis/project-worker-binding-v1.js';
import { resolveJarvisRemoteOperatorRegistryProjectTargetsV1 } from '../src/jarvis/remote-operator-server-v1.js';
import { resolveJarvisAutomaticProjectRouteV1 } from '../src/jarvis/project-route-v1.js';

const scoped = { JARVIS_PROJECT_LUKAS_PAFF_BRIDGE_URL: 'http://127.0.0.1:18789',
  JARVIS_PROJECT_LUKAS_PAFF_BRIDGE_TOKEN: 'fixture-token' };
test('existing targets keep their original bridge configuration', () => {
  const env = { ...scoped, JARVIS_BRIDGE_URL:'http://127.0.0.1:8788', JARVIS_BRIDGE_TOKEN:'old' };
  for (const id of ['AURENTARA','JARVIS_AUTONOMY_TEST']) {
    const r=resolveProjectWorkerBindingV1(env,id);
    assert.equal(r.env,env); assert.equal(r.isolated,false);
  }
  const r=resolveProjectWorkerBindingV1(env,'LUKAS_PAFF');
  assert.equal(r.env.JARVIS_BRIDGE_URL,'http://127.0.0.1:18789');
  assert.equal(r.env.JARVIS_BRIDGE_TOKEN,'fixture-token');
  assert.equal(env.JARVIS_BRIDGE_TOKEN,'old');
});
test('partial isolated configuration never falls back to the global worker', () => {
  for (const key of Object.keys(scoped)) {
    assert.equal(resolveProjectWorkerBindingV1({[key]:scoped[key],JARVIS_BRIDGE_TOKEN:'global'},'LUKAS_PAFF').ok,false);
  }
});
test('public endpoints and URL credentials are refused', () => {
  for (const url of ['https://example.com','http://user:secret@127.0.0.1:18789','http://127.0.0.1:18789/run','http://127.0.0.1:18789/?x=1']) {
    assert.equal(resolveProjectWorkerBindingV1({...scoped,JARVIS_PROJECT_LUKAS_PAFF_BRIDGE_URL:url},'LUKAS_PAFF').ok,false);
  }
});
function fixture() {
  const repo=fs.mkdtempSync(path.join(os.tmpdir(),'jarvis-binding-test-'));
  const git=(args)=>execFileSync('git',['-C',repo,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  git(['init','-b','factory/lukas-paff-premium-v1']);
  git(['config','user.name','Fixture']);git(['config','user.email','fixture@localhost']);
  fs.mkdirSync(path.join(repo,'projects/lukas-paff-premium-v1'),{recursive:true});
  fs.writeFileSync(path.join(repo,'projects/lukas-paff-premium-v1/probe.txt'),'before\n');
  git(['add','.']);git(['commit','-m','baseline']);
  return {repo,git,target:{target_id:'LUKAS_PAFF',enabled:true,label:'Lukas Paff',
    route_aliases:['Lukas-Paff','Lukas-Paff-Website'],program:'PROJECT_MISSION_V1',
    repo_dir:repo,bridge_project:'lukas-paff-premium-v1',target_branch:'factory/lukas-paff-premium-v1'}};
}
test('registry resolver probes the configured isolated bridge and honors disabled targets', async () => {
  const f=fixture(); let hits=0;
  const server=http.createServer((req,res)=>{hits++;assert.equal(req.url,'/health');res.setHeader('Content-Type','application/json');res.end('{"ok":true}');});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try {
    const env={...scoped,JARVIS_BRIDGE_HTTP_EXECUTION:'on',JARVIS_BRIDGE_URL:'http://127.0.0.1:1',JARVIS_BRIDGE_TOKEN:'wrong',
      JARVIS_PROJECT_LUKAS_PAFF_BRIDGE_URL:'http://127.0.0.1:'+server.address().port};
    const result=await resolveJarvisRemoteOperatorRegistryProjectTargetsV1(env,{
      registry_result:{ok:true,revision:5,targets:{LUKAS_PAFF:f.target}}});
    assert.deepEqual(result.errors,{});
    assert.equal(result.targets.LUKAS_PAFF.bridge_bound,true);
    assert.equal(result.targets.LUKAS_PAFF.local_commit_only,true);assert.equal(hits,1);
    for(const message of ['JARVIS, öffne das Lukas-Paff-Projekt','Verbessere die Lukas-Paff-Website','Bearbeite Lukas Paff']) {
      assert.equal(resolveJarvisAutomaticProjectRouteV1(message,result.targets).target_id,'LUKAS_PAFF');
    }
    const off=await resolveJarvisRemoteOperatorRegistryProjectTargetsV1(env,{
      registry_result:{ok:true,revision:5,targets:{LUKAS_PAFF:{...f.target,enabled:false}}}});
    assert.deepEqual(off.disabled_target_ids,['LUKAS_PAFF']);assert.equal(hits,1);
  } finally {await new Promise(r=>server.close(r));fs.rmSync(f.repo,{recursive:true,force:true});}
});
test('scope violations cannot reach the publisher or create commits', async () => {
  const f=fixture();const head=f.git(['rev-parse','HEAD']);
  const pub=createProjectLocalPublisherV1(f.target,{memory_store:{appendAudit:async()=>{}}});
  try {
    for(const file of ['README.md','projects/lukas-paff-premium-v1/../other','projects/lukas-paff-premium-v1/.git/config']) {
      const result=await pub.publishVerifiedOwnerChatJob({repo_dir:f.repo,target_branch:f.target.target_branch,verification:{files_changed:[file]}});
      assert.equal(result.error,'PROJECT_LOCAL_PUBLISHER_SCOPE_MISMATCH');
    }
    assert.equal(f.git(['rev-parse','HEAD']),head);
  } finally {fs.rmSync(f.repo,{recursive:true,force:true});}
});
test('real trusted publisher creates a local commit with push and deploy disabled', async () => {
  const f=fixture();const base=f.git(['rev-parse','HEAD']);const file='projects/lukas-paff-premium-v1/probe.txt';
  const audits=[];
  const pub=createProjectLocalPublisherV1(f.target,{memory_store:{appendAudit:async(...args)=>audits.push(args)}});
  try {
    fs.writeFileSync(path.join(f.repo,file),'after\n');
    const r=await pub.publishVerifiedOwnerChatJob({owner_id:'fixture',owner_ref:'fixture@localhost',
      request_id:'30000000-0000-4000-8000-000000000001',repo_dir:f.repo,target_branch:f.target.target_branch,
      verification:{schema:'aurentara.jarvis.repo-bound-verification.v1',repo_dir:f.repo,branch:f.target.target_branch,
        branch_drift:false,syntax_check:{passed:true},pre_existing_dirty_files:[],files_changed:[file]}});
    assert.equal(r.ok,true,JSON.stringify(r));assert.equal(r.push,false);assert.equal(r.deploy,false);
    assert.notEqual(f.git(['rev-parse','HEAD']),base);assert.equal(f.git(['status','--porcelain']),'');assert.ok(audits.length);
  } finally {fs.rmSync(f.repo,{recursive:true,force:true});}
});
