import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  applyJarvisProjectTargetRegistryV1,
  loadJarvisProjectTargetRegistryV1,
  validateJarvisProjectTargetV1,
  writeJarvisControlPlaneRestartRequestV1,
  jarvisProjectTargetRegistryManifestV1
} from '../src/jarvis/project-target-registry-v1.js';

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'jarvis-project-registry-'));
const registry=path.join(tmp,'registry.json');
const restart=path.join(tmp,'restart.json');
const target={
  target_id:'AURENTARA', label:'AURENTARA', route_aliases:['AURENTARA SYSTEMS'],
  program:'AURENTARA_PROJECT_MISSION_V1', repo_dir:'/opt/jarvis/aurentara-project',
  bridge_project:'aurentara-real-lifecycle-v1',
  target_branch:'factory/aurentara-real-lifecycle-v1', enabled:true
};
assert.equal(validateJarvisProjectTargetV1({...target,repo_dir:'/etc'}).ok,false);
assert.equal(validateJarvisProjectTargetV1({...target,target_branch:'main'}).ok,false);
assert.equal(validateJarvisProjectTargetV1({...target,token:'secret'}).ok,false);
let r=applyJarvisProjectTargetRegistryV1({operation:'upsert',target},{file_path:registry});
assert.equal(r.ok,true); assert.equal(r.revision,1); assert.equal(r.targets.AURENTARA.enabled,true);
r=applyJarvisProjectTargetRegistryV1({operation:'set_enabled',target_id:'AURENTARA',enabled:false},{file_path:registry});
assert.equal(r.ok,true); assert.equal(r.revision,2); assert.equal(r.targets.AURENTARA.enabled,false);
const loaded=loadJarvisProjectTargetRegistryV1(registry);
assert.equal(loaded.ok,true); assert.equal(loaded.targets.AURENTARA.enabled,false);
const rr=writeJarvisControlPlaneRestartRequestV1('REGISTRY_CHANGED',{file_path:restart});
assert.equal(rr.ok,true); assert.match(rr.request_id,/^[0-9a-f-]{36}$/i);
assert.equal(JSON.parse(fs.readFileSync(restart,'utf8')).reason,'REGISTRY_CHANGED');
const man=jarvisProjectTargetRegistryManifestV1();
assert.equal(man.secrets_allowed,false); assert.equal(man.arbitrary_shell_allowed,false);
fs.rmSync(tmp,{recursive:true,force:true});
console.log('JARVIS Project Target Registry V1 smoke: PASS');
