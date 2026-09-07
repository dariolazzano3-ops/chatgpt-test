import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createMotionDesignContract,
  createMotionRuntimePlan,
  createMotionQualityGate,
  runWebOperatingSystemV2,
  executeWebFactoryTask
} from '../src/web-factory/index.js';

const fullIntent=[
  {motion_id:'page',type:'page_entry',purpose:'Introduce page hierarchy'},
  {motion_id:'hero',type:'hero_reveal',purpose:'Reveal primary brand message'},
  {motion_id:'text',type:'text_reveal',purpose:'Reveal supporting copy'},
  {motion_id:'image',type:'image_reveal',purpose:'Reveal approved imagery'},
  {motion_id:'scroll',type:'scroll_reveal',purpose:'Progressively reveal sections'},
  {motion_id:'parallax',type:'parallax',purpose:'Add controlled depth',intensity:'medium'},
  {motion_id:'hover',type:'hover',purpose:'Confirm interactive affordance'},
  {motion_id:'nav',type:'navigation',purpose:'Clarify navigation state'},
  {motion_id:'transition',type:'section_transition',purpose:'Connect adjacent sections'},
  {motion_id:'marquee',type:'marquee',purpose:'Move approved repeated brand content'},
  {motion_id:'background',type:'background_motion',purpose:'Provide restrained ambient depth'},
  {motion_id:'video',type:'video_hero',purpose:'Coordinate approved hero video state'}
];

const contract=createMotionDesignContract(fullIntent,{quality_level:'PREMIUM'});
assert.equal(contract.schema,'riosystems.motion-design-contract.v1');
assert.equal(contract.items.length,12);
for(const type of ['page_entry','hero_reveal','text_reveal','image_reveal','scroll_reveal','parallax','hover','navigation','section_transition','marquee','background_motion','video_hero']){
  assert.ok(contract.allowed_types.includes(type));
  assert.ok(contract.items.some(item=>item.type===type));
}
for(const item of contract.items){
  assert.ok(item.purpose);
  assert.ok(item.trigger);
  assert.equal(typeof item.duration,'number');
  assert.ok(item.easing);
  assert.ok(['low','medium','high'].includes(item.intensity));
  assert.ok(item.breakpoints.mobile);
  assert.ok(item.breakpoints.tablet);
  assert.ok(item.breakpoints.desktop);
  assert.equal(item.reduced_motion.required,true);
  assert.equal(item.reduced_motion.media_query,'(prefers-reduced-motion: reduce)');
  assert.equal(item.reduced_motion_required,true);
  assert.equal(item.performance_budget.layout_affecting,false);
  assert.equal(item.performance_budget.compositor_preferred,true);
}
assert.equal(contract.gsap_required,true);
assert.equal(contract.gsap_load_policy,'load-on-demand-for-declared-motion-only');
assert.equal(contract.global_gsap_load_allowed,false);
assert.equal(createMotionQualityGate(contract).status,'PASS');

const runtime=createMotionRuntimePlan(contract);
assert.equal(runtime.gsap.import_required,true);
assert.equal(runtime.gsap.global_load,false);
assert.deepEqual(runtime.gsap.motion_ids.sort(),['background','marquee','parallax']);
assert.ok(runtime.css.native_motion_ids.includes('hero'));
assert.equal(runtime.reduced_motion.all_items_covered,true);

const simple=createMotionDesignContract([
  {motion_id:'simple-hover',type:'hover',purpose:'Button feedback'},
  {motion_id:'simple-fade',type:'fade',purpose:'Simple content appearance'}
]);
assert.equal(simple.gsap_required,false);
assert.equal(simple.gsap_load_policy,'do-not-load');
const simpleRuntime=createMotionRuntimePlan(simple);
assert.equal(simpleRuntime.gsap.import_required,false);
assert.equal(simpleRuntime.gsap.load_policy,'not-loaded');
assert.deepEqual(simpleRuntime.gsap.motion_ids,[]);
assert.equal(createMotionQualityGate(simple).status,'PASS');

const globalGsap=structuredClone(simple);
globalGsap.global_gsap_load_allowed=true;
assert.equal(createMotionQualityGate(globalGsap).status,'BLOCK');
assert.ok(createMotionQualityGate(globalGsap).issues.some(i=>i.code==='GLOBAL_GSAP_LOAD_FORBIDDEN'));

const missingFallback=structuredClone(simple);
missingFallback.items[0].reduced_motion.required=false;
assert.equal(createMotionQualityGate(missingFallback).status,'BLOCK');
assert.ok(createMotionQualityGate(missingFallback).issues.some(i=>i.code==='MOTION_FALLBACK_MISSING'));

const layoutMotion=structuredClone(simple);
layoutMotion.items[0].performance_budget.layout_affecting=true;
assert.equal(createMotionQualityGate(layoutMotion).status,'BLOCK');
assert.ok(createMotionQualityGate(layoutMotion).issues.some(i=>i.code==='LAYOUT_AFFECTING_MOTION_FORBIDDEN'));

const inconsistentGsap=structuredClone(contract);
inconsistentGsap.gsap_required=false;
assert.equal(createMotionQualityGate(inconsistentGsap).status,'BLOCK');
assert.ok(createMotionQualityGate(inconsistentGsap).issues.some(i=>i.code==='GSAP_REQUIREMENT_INCONSISTENT'));

const legacy=createMotionDesignContract([
  {type:'slide',purpose:'Legacy slide behavior'},
  {type:'microinteraction',purpose:'Legacy microinteraction'}
]);
assert.equal(legacy.items[0].type,'slide');
assert.equal(legacy.items[1].type,'microinteraction');

const adapter=executeWebFactoryTask({
  capability:'web.motion.contract.v1',
  motion_intent:fullIntent,
  quality_level:'PREMIUM'
});
assert.equal(adapter.ok,true);
assert.equal(adapter.status,'MOTION_CONTRACT_READY');
assert.equal(adapter.runtime.gsap.import_required,true);
assert.equal(adapter.quality.status,'PASS');

const fixture=JSON.parse(await readFile(new URL('../fixtures/web-factory/autonomous-local-service-bakery.json',import.meta.url),'utf8'));
const webOs=runWebOperatingSystemV2({
  ...fixture,
  mission:{...fixture.mission,motion_intent:fullIntent}
},{now:'2026-09-07T01:30:00.000Z',build_duration_ms:1});
assert.equal(webOs.ok,true);
assert.equal(webOs.delivery_manifest.motion.contract.gsap_required,true);
assert.equal(webOs.delivery_manifest.motion.runtime.gsap.import_required,true);
assert.equal(webOs.delivery_manifest.motion.quality.status,'PASS');
assert.ok(webOs.artifact.files[webOs.artifact.project_root+'/web-os-v2-motion-contract.json']);

console.log(JSON.stringify({
  ok:true,
  suite:'webfactory-100-j5-motion-contract',
  supported_motion_types:fullIntent.map(x=>x.type),
  full_contract_quality:'PASS',
  simple_css_only_gsap_loaded:false,
  complex_gsap_load_policy:contract.gsap_load_policy,
  reduced_motion_coverage:'PASS',
  performance_budget_gate:'PASS',
  web_os_v2_integration:'PASS',
  production_deploy:false
},null,2));
