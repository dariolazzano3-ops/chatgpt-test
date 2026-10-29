import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRequest, buildQuarantinedTargetV1 } from './jarvis-project-factory-onboard-v1.mjs';
const base={
 schema:'jarvis.owner-project-onboard.v1',
 target_id:'LUKAS_PAFF',
 label:'Lukas Paff Premium Website',
 aliases:['LUKAS PAFF','LUKAS PAFF WEBSITE'],
 repository:'dariolazzano3-ops/chatgpt-test',
 branch:'factory/lukas-paff-premium-v1',
 subdirectory:'projects/lukas-paff-premium-v1',
 expected_head:'7c96ba65a2366a66dbc26cc63a9ba0bf912ba9a7'
};
const registry={schema:'aurentara.jarvis.project-target-registry.v1',revision:4,targets:{
 AURENTARA:{target_id:'AURENTARA',label:'AURENTARA',route_aliases:['AURENTARA SYSTEMS']},
 JARVIS_AUTONOMY_TEST:{target_id:'JARVIS_AUTONOMY_TEST',label:'JARVIS Test',route_aliases:[]}
}};
test('valid Lukas onboarding request',()=>assert.equal(validateRequest(base,registry).target_id,'LUKAS_PAFF'));
test('new project registered disabled until independently isolated',()=>{
  const q=validateRequest(base,registry);
  const target=buildQuarantinedTargetV1(q,'/opt/jarvis/project-workspaces/LUKAS_PAFF');
  assert.equal(target.enabled,false);
  assert.equal(target.repo_dir,'/opt/jarvis/project-workspaces/LUKAS_PAFF');
  assert.equal(target.target_branch,q.branch);
  assert.equal(target.bridge_project,'lukas-paff-premium-v1');
  assert.match(target.execution_guidance,/No other projects/);
});
const invalid=[
 ['outside owner',{repository:'example/evil'}],
 ['traversal',{subdirectory:'projects/../.git'}],
 ['arbitrary directory',{subdirectory:'/etc/jarvis'}],
 ['malicious branch',{branch:'factory/x; rm -rf /'}],
 ['unsafe identifier',{target_id:'../../ROOT'}],
 ['unapproved commit',{expected_head:''}],
 ['unexpected field',{root:true}],
 ['duplicate aliases',{aliases:['LUKAS PAFF','LUKAS PAFF']}],
 ['collision',{aliases:['AURENTARA SYSTEMS']}],
 ['missing label',{label:''}],
 ['missing subdir',{subdirectory:'projects'}],
 ['source external',{repository:'dariolazzano3-ops/chatgpt-test.git/evil'}]
];
for(const [label,change] of invalid){
 test('fail closed: '+label,()=>assert.throws(()=>validateRequest({...base,...change},registry)));
}
test('existing target cannot be overwritten',()=>assert.throws(
 ()=>validateRequest(base,{...registry,targets:{...registry.targets,LUKAS_PAFF:{target_id:'LUKAS_PAFF'}}})
));
test('existing targets untouched by pure validator',()=>{
 const before=JSON.stringify(registry);validateRequest(base,registry);assert.equal(JSON.stringify(registry),before);
});
