import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { applyFixtureToViewModel, assertFixtureWriteAllowed, assertVisualFixtureEnvironment, createFixtureSession, createVisualFixture, detectFixtureLeak } from '../src/visual-foundry/fixture-mode.js';

const runtime={projects:[{id:'runtime-project',name:'Real Runtime'}],revision:42};
const runtimeBefore=JSON.stringify(runtime);
const fixture=createVisualFixture({
  fixture_id:'aurentara-hq-fixture-v1',
  reference_id:'aurentara-hq-reference-v1',
  version:'1',
  data:{projects:[{id:'fixture-project',name:'Fixture Project'}],attention_count:3}
},{now:'2026-09-06T16:00:00.000Z'});

assert.equal(fixture.truth_class,'VISUAL_FIXTURE');
assert.equal(fixture.runtime_truth_write_allowed,false);
assert.equal(fixture.project_knowledge_write_allowed,false);
assert.equal(fixture.production_allowed,false);
assert.equal(Object.isFrozen(fixture),true);

const session=createFixtureSession(fixture,{environment:'ci',production:false,public:false,session_id:'session-1'});
const view=applyFixtureToViewModel(runtime,session);
assert.equal(view.projects[0].id,'fixture-project');
assert.equal(view.__visual_foundry.truth_class,'VISUAL_FIXTURE');
assert.equal(view.__visual_foundry.persistent_write_allowed,false);
assert.equal(JSON.stringify(runtime),runtimeBefore,'fixture view must not mutate runtime truth');

assert.equal(assertVisualFixtureEnvironment({environment:'staging'}).ok,true);
assert.throws(()=>assertVisualFixtureEnvironment({environment:'production'}),/VISUAL_FIXTURE_ENVIRONMENT_FORBIDDEN|VISUAL_FIXTURE_PRODUCTION_FORBIDDEN/);
assert.throws(()=>assertVisualFixtureEnvironment({environment:'staging',public:true}),/VISUAL_FIXTURE_PUBLIC_RUNTIME_FORBIDDEN/);
assert.throws(()=>assertFixtureWriteAllowed({target:'project_knowledge',scope:'fixture-evidence'}),/VISUAL_FIXTURE_WRITE_FORBIDDEN/);
assert.throws(()=>assertFixtureWriteAllowed({target:'runtime_truth',scope:'fixture-evidence'}),/VISUAL_FIXTURE_WRITE_FORBIDDEN/);
assert.equal(assertFixtureWriteAllowed({target:'wave8-evidence.json',scope:'fixture-evidence'}).ok,true);

assert.equal(detectFixtureLeak(view).status,'PASS');
assert.equal(detectFixtureLeak({truth_class:'VISUAL_FIXTURE',runtime_truth_write_allowed:true}).status,'FAIL');

const evidence={ok:true,suite:'visual-foundry-wave8-smoke',fixture_truth_class:'PASS',runtime_truth_unchanged:'PASS',project_knowledge_write_blocked:'PASS',production_hard_disabled:'PASS',public_runtime_blocked:'PASS',fixture_leak_detection:'PASS',production_deploy:false,external_writes:false};
await mkdir('artifacts/visual-foundry/wave8',{recursive:true});
await writeFile('artifacts/visual-foundry/wave8/evidence.json',JSON.stringify({evidence,fixture,session,view},null,2));
console.log(JSON.stringify(evidence,null,2));
