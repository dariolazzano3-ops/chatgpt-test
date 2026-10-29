import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTrustedProjectCatalogV1 as validate,
  resolveCatalogProjectV1 as resolve, listAuthorizedProjectsV1 as list,
  buildExecutableTargetsV1 as bind } from '../src/jarvis/universal-project-adapter-v1.js';

const sha = 'd3275cfe7e43c4435325e4a8202fed609eb9c416';
const catalog = () => ({ schema: 'jarvis.universal-project-catalog.v1', projects: [{
  target_id: 'LUKAS_PAFF', label: 'Lukas Paff',
  route_aliases: ['Lukas-Paff-Projekt', 'Lukas Paff Premium'],
  repository: 'dariolazzano3-ops/chatgpt-test',
  branch: 'factory/lukas-paff-premium-v1',
  subdirectory: 'projects/lukas-paff-premium-v1', expected_head: sha, approved: true
}]});
const trust = {approved_source:true,verified_source_commit:'f'.repeat(40)};
const v = c => validate(c,trust);
test('requires independently verified trusted Git source',()=>assert.throws(()=>validate(catalog()),/VERIFIED_GIT_SOURCE/));
test('valid catalog matches exact approved project',()=>assert.equal(resolve('JARVIS, bearbeite Lukas Paff',v(catalog())).target_id,'LUKAS_PAFF'));
test('unknown project does not resolve',()=>assert.equal(resolve('JARVIS bearbeite unbekannt',v(catalog())).matched,false));
test('catalog discovery never asserts Claude readiness',()=>assert.equal(list(v(catalog()))[0].execution_ready,false));
test('does not accept chat-supplied repository',()=>{const c=catalog(); c.projects[0].repository='other/test';assert.throws(()=>v(c),/REPOSITORY_NOT_ALLOWED/)});
test('branch traversal rejected',()=>{const c=catalog(); c.projects[0].branch='factory/x/../y';assert.throws(()=>v(c),/UNSAFE_BRANCH/)});
test('subdirectory traversal rejected',()=>{const c=catalog(); c.projects[0].subdirectory='projects/../secrets';assert.throws(()=>v(c),/UNSAFE_SUBDIRECTORY/)});
test('missing exact Git HEAD rejected',()=>{const c=catalog();c.projects[0].expected_head='main';assert.throws(()=>v(c),/EXPECTED_HEAD/)});
test('unapproved project not routed',()=>{const c=catalog();c.projects[0].approved=false;assert.equal(resolve('Lukas Paff',v(c)).matched,false)});
test('duplicate IDs rejected',()=>{const c=catalog();c.projects.push({...c.projects[0]});assert.throws(()=>v(c),/DUPLICATE_OR_INVALID_ID|DUPLICATE_ROUTE_ALIAS/)});
test('duplicate aliases across projects rejected',()=>{const c=catalog();c.projects.push({...c.projects[0],target_id:'GELATO',label:'Gelato',route_aliases:['Lukas-Paff-Projekt']});assert.throws(()=>v(c),/DUPLICATE_ROUTE_ALIAS/)});
test('ambiguous project names fail closed',()=>{const c=catalog();c.projects.push({...c.projects[0],target_id:'GELATO',label:'Gelato',route_aliases:[]});assert.equal(resolve('Lukas Paff und Gelato',v(c)).status,'AMBIGUOUS')});
test('catalog does not grant worker access by itself',()=>assert.deepEqual(bind(v(catalog())),{}));
test('rejects collision with existing registry',()=>assert.throws(()=>bind(v(catalog()),{}, {EXISTING:{target_id:'OTHER',label:'Lukas Paff',route_aliases:[]}}, {approved_workspace_root:'/opt/jarvis/project-workspaces'}),/EXISTING_TARGET_COLLISION/));
test('forged incomplete worker receipt does not become executable',()=>{
  const p=v(catalog()).projects[0];assert.deepEqual(bind(v(catalog()),{LUKAS_PAFF:{...p,server_attested:true,isolation_verified:true,bridge_verified:false}}),{});
});
test('verified project binding is deterministic and exact SHA scoped',()=>{
  const p=v(catalog()).projects[0]; const receipt={...p,commit:p.expected_head,
    server_attested:true,isolation_verified:true,bridge_verified:true,
    bridge:{schema:'aurentara.jarvis.claude-code-bridge.v1',bound:true,submit:()=>{}},
    workspace_preflight:()=>true,repo_dir:'/opt/jarvis/project-workspaces/LUKAS_PAFF',
    bridge_project:'lukas-paff-premium-v1'};
  const opts={approved_workspace_root:'/opt/jarvis/project-workspaces'};
  assert.equal(bind(v(catalog()),{LUKAS_PAFF:receipt},{},opts).LUKAS_PAFF.target_branch,p.branch);
  assert.equal(bind(v(catalog()),{LUKAS_PAFF:{...receipt,commit:'0'.repeat(40)}},{},opts).LUKAS_PAFF,undefined);
  assert.equal(bind(v(catalog()),{LUKAS_PAFF:{...receipt,repo_dir:'/opt/jarvis/project-workspaces/GELATO'}},{},opts).LUKAS_PAFF,undefined);
  assert.equal(bind(v(catalog()),{LUKAS_PAFF:{...receipt,bridge_project:'gelato'}},{},opts).LUKAS_PAFF,undefined);
  assert.equal(bind(v(catalog()),{LUKAS_PAFF:receipt}).LUKAS_PAFF,undefined);
});
test('rejects client-injected unusual catalog fields',()=>{const c=catalog();c.projects[0].command='rm -rf';assert.throws(()=>v(c),/UNKNOWN_FIELD/)});


test('validated routing aliases cannot be changed after source verification', () => {
  const input = catalog();
  const verified = v(input);
  input.projects[0].route_aliases.push('Injected through source');
  assert.equal(resolve('Injected through source', verified).matched, false);
  assert.throws(() => verified.projects[0].route_aliases.push('Injected after validation'), TypeError);
  assert.throws(() => { verified.projects[0].route_aliases[0] = 'Replaced alias'; }, TypeError);
  assert.equal(resolve('Injected after validation', verified).matched, false);
  assert.equal(resolve('Replaced alias', verified).matched, false);
  assert.equal(resolve('Lukas-Paff-Projekt', verified).target_id, 'LUKAS_PAFF');
});
