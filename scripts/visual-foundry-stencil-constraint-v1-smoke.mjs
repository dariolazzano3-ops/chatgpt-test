import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createStencilContract, installReferenceStencil, setStencilMode, toggleStencilBlinkFrame, removeReferenceStencil, validateStencilContract } from '../src/visual-foundry/stencil-mode.js';
import { deriveResponsiveConstraintSet, projectConstraintAtParent, evaluateCalibrationAnchor } from '../src/visual-foundry/constraint-solver.js';
import { createSoftRegionLockSet, evaluateSoftLockCandidate, finalizeSoftRegionLocks, advanceSoftLockBaselines } from '../src/visual-foundry/soft-region-locks.js';
import { rankVisualDeltas, scoreVisualDeltaPriority, visualPriorityWeights } from '../src/visual-foundry/visual-priority.js';
import { evaluateSemanticImplementation } from '../src/visual-foundry/semantic-gate.js';

await mkdir('artifacts/visual-foundry/stencil-constraint-v1',{recursive:true});

const referenceSpec=JSON.parse(await readFile('factory-state/visual-foundry/aurentara-hq-control-center-reference-spec-v1.json','utf8'));

// 1. Constraint extraction preserves exact desktop calibration anchor while deriving responsive relations.
const regionById=new Map(referenceSpec.regions.map(r=>[r.region_id,r]));
const b=id=>Object.fromEntries(Object.entries(regionById.get(id).bounds).map(([k,v])=>[k,Number(v.value)]));
const constraintSet=deriveResponsiveConstraintSet({
  canvas:{width:1536,height:1024},
  elements:[
    {id:'sidebar',role:'SIDEBAR',bounds:b('sidebar'),tolerance_px:3},
    {id:'attention_panel',role:'DATA_CARD',group_id:'mid',bounds:b('attention_panel'),parent_bounds:{x:232,y:285,width:1286,height:276}},
    {id:'operator_ai_panel',role:'DATA_CARD',group_id:'mid',bounds:b('operator_ai_panel'),parent_bounds:{x:232,y:285,width:1286,height:276}},
    {id:'portfolio',role:'DATA_CARD',group_id:'ops',bounds:b('portfolio'),parent_bounds:{x:232,y:572,width:1286,height:346}},
    {id:'right_rail',role:'RIGHT_RAIL_FIXED',group_id:'ops',bounds:{x:948,y:572,width:570,height:346},parent_bounds:{x:232,y:572,width:1286,height:346}}
  ]
});
assert.equal(constraintSet.absolute_pixel_layout_as_final_strategy,false);
assert.equal(constraintSet.elements.find(x=>x.id==='sidebar').strategy,'FIXED_RAIL');
assert.equal(constraintSet.elements.find(x=>x.id==='sidebar').tolerance_px,3);
const mid=constraintSet.grid_groups.find(x=>x.group_id==='mid');
assert.ok(mid);
assert.ok(Math.abs(mid.columns[0].fraction-(711/(711+563)))<1e-6);
assert.ok(Math.abs(mid.columns[1].fraction-(563/(711+563)))<1e-6);

const anchor=evaluateCalibrationAnchor(constraintSet,constraintSet.elements.map(x=>({id:x.id,bounds:x.calibration_anchor.bounds})));
assert.equal(anchor.status,'PASS');

const projectedSidebar=projectConstraintAtParent(constraintSet.elements.find(x=>x.id==='sidebar'),{x:0,y:0,width:1280,height:900});
assert.equal(projectedSidebar.width,216,'fixed rail remains structurally fixed instead of scaling blindly');
const projectedAttention=projectConstraintAtParent(constraintSet.elements.find(x=>x.id==='attention_panel'),{x:200,y:250,width:1000,height:240});
assert.ok(projectedAttention.width<711&&projectedAttention.width>500,'content region responds proportionally');

// 2. Soft locks warn during search but block unresolved regressions at finalization.
const lockSet=createSoftRegionLockSet({
  measurement:{regions:[{region_id:'sidebar',score:.982},{region_id:'toolbar',score:.981}]},
  regions:['sidebar','toolbar'],tolerance:.002
});
assert.equal(lockSet.hard_locking,false);
const warned=evaluateSoftLockCandidate(lockSet,{regions:[{region_id:'sidebar',score:.975},{region_id:'toolbar',score:.982}]});
assert.equal(warned.status,'ACCEPT_WITH_REGRESSION_WARNING');
assert.equal(warned.candidate_blocked,false);
assert.equal(finalizeSoftRegionLocks(lockSet,{regions:[{region_id:'sidebar',score:.975},{region_id:'toolbar',score:.982}]}).status,'FAIL');
const recovered={regions:[{region_id:'sidebar',score:.984},{region_id:'toolbar',score:.983}]};
assert.equal(finalizeSoftRegionLocks(lockSet,recovered).status,'PASS');
const advanced=advanceSoftLockBaselines(lockSet,recovered);
assert.equal(advanced.regions.find(x=>x.region_id==='sidebar').baseline_score,.984);

// 3. Deterministic heatmap priority, no AI weighting.
const priorities=rankVisualDeltas([
  {region_id:'hero',ssim:.42,pixel_difference_percent:28,area_px:1320*119,canvas_area_px:1536*1024,contrast_index:.9,semantic_type:'HEADING',criticality:'CRITICAL'},
  {region_id:'decoration',ssim:.25,pixel_difference_percent:45,area_px:120*80,canvas_area_px:1536*1024,contrast_index:.4,semantic_type:'DECORATION',criticality:'DECORATIVE'},
  {region_id:'primary_navigation',ssim:.72,pixel_difference_percent:12,area_px:192*688,canvas_area_px:1536*1024,contrast_index:.8,semantic_type:'NAVIGATION',criticality:'CRITICAL'}
]);
assert.equal(priorities[0].region_id,'hero');
assert.equal(priorities.every(x=>x.ai_weighting_used===false),true);
const priorityWeights=visualPriorityWeights();
assert.equal(priorityWeights.criticality.CRITICAL,3);
assert.equal(scoreVisualDeltaPriority({region_id:'x',ssim:1,pixel_difference_percent:0,area_px:1,canvas_area_px:100,contrast_index:0,semantic_type:'NORMAL_UI',criticality:'LOW'}).priority_score,0);

// 4. Browser Stencil modes + Semantic Gate.
const svg=encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1024"><rect width="1536" height="1024" fill="#071827"/><rect x="0" y="0" width="216" height="1024" fill="#020b17"/><rect x="216" y="58" width="1320" height="119" fill="#10304e"/></svg>');
const stencil=createStencilContract({
  reference_id:'aurentara-hq-control-center-reference-v1-0',
  reference_hash:'6352c9e756d13e41382817bc9da265013c5721ac674b820f9962b113fe3a0d8b',
  reference_version:'1.0',
  source:'data:image/svg+xml;charset=utf-8,'+svg,
  source_type:'SYNTHETIC_SMOKE_REFERENCE',
  canvas:{width:1536,height:1024,device_pixel_ratio:1},
  opacity:.5
});
assert.equal(validateStencilContract(stencil).ok,true);
assert.equal(stencil.production_allowed,false);
assert.equal(stencil.persistent_runtime_write_allowed,false);

const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1536,height:1024},deviceScaleFactor:1});
  await page.setContent(`<!doctype html><html><head><style>
    html,body{margin:0;width:100%;min-height:100%;font-family:Arial,sans-serif;background:#071827;color:white}
    .layout{display:grid;grid-template-columns:216px 1fr;min-height:1024px}
    nav{background:#020b17;padding:16px}
    main{padding:16px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .card{min-height:120px;border:1px solid #27506b}
  </style></head><body>
    <div class="layout">
      <nav data-visual-id="sidebar" aria-label="Primary"><a href="#main">Start</a></nav>
      <main id="main" data-visual-id="main"><h1>AURENTARA CONTROL CENTER</h1>
        <div class="grid"><section class="card" data-visual-id="a"><h2>Status</h2><button type="button">Öffnen</button></section><section class="card" data-visual-id="b"><h2>Portfolio</h2></section></div>
      </main>
    </div>
  </body></html>`);

  const installed=await installReferenceStencil(page,stencil);
  assert.deepEqual({width:installed.width,height:installed.height},{width:1536,height:1024});
  let root=await page.locator('[data-vf-stencil-root]').count();
  assert.equal(root,1);
  assert.equal(await page.locator('[data-vf-stencil-root]').evaluate(el=>getComputedStyle(el).pointerEvents),'none');

  const overlay=await setStencilMode(page,'OVERLAY',{opacity:.5});
  assert.equal(overlay.opacity,'0.5');
  await page.screenshot({path:'artifacts/visual-foundry/stencil-constraint-v1/overlay.png'});

  const difference=await setStencilMode(page,'DIFFERENCE');
  assert.equal(difference.mix_blend_mode,'difference');
  await page.screenshot({path:'artifacts/visual-foundry/stencil-constraint-v1/difference.png'});

  await setStencilMode(page,'BLINK');
  assert.equal((await toggleStencilBlinkFrame(page,'REFERENCE')).frame,'REFERENCE');
  assert.equal((await toggleStencilBlinkFrame(page,'RUNTIME')).frame,'RUNTIME');

  await setStencilMode(page,'REFERENCE_ONLY');
  assert.equal(await page.locator('#vf-stencil-runtime-visibility').count(),1);
  await setStencilMode(page,'RUNTIME_ONLY');
  assert.equal(await page.locator('[data-vf-stencil-root]').evaluate(el=>getComputedStyle(el).display),'none');

  await setStencilMode(page,'OVERLAY');
  const withStencil=await evaluateSemanticImplementation(page,{allow_stencil:true});
  assert.equal(withStencil.status,'PASS',JSON.stringify(withStencil.issues));

  await removeReferenceStencil(page);
  assert.equal(await page.locator('[data-vf-stencil-root]').count(),0);
  const semanticGood=await evaluateSemanticImplementation(page,{allow_stencil:false});
  assert.equal(semanticGood.status,'PASS',JSON.stringify(semanticGood.issues));

  await page.setContent(`<!doctype html><html><body style="margin:0">
    <div onclick="void 0" tabindex="3">click</div>
    <img src="data:image/svg+xml,${encodeURIComponent('<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'1536\' height=\'1024\'><rect width=\'100%\' height=\'100%\' fill=\'black\'/></svg>')}" style="position:fixed;inset:0;width:1536px;height:1024px;pointer-events:none">
  </body></html>`);
  const semanticBad=await evaluateSemanticImplementation(page,{allow_stencil:false});
  assert.equal(semanticBad.status,'FAIL');
  const codes=semanticBad.issues.map(x=>x.code);
  assert.ok(codes.includes('SEMANTIC_H1_COUNT'));
  assert.ok(codes.includes('SEMANTIC_MAIN_LANDMARK_MISSING'));
  assert.ok(codes.includes('ACCESSIBILITY_POSITIVE_TABINDEX'));
  assert.ok(codes.includes('SEMANTIC_FAKE_INTERACTIVE_ELEMENT'));
  assert.ok(codes.includes('SCREENSHOT_AS_IMPLEMENTATION_HACK'));

  const evidence={
    ok:true,
    suite:'visual-foundry-reference-stencil-constraint-closure-v1',
    stencil_overlay:'PASS',
    stencil_difference:'PASS',
    stencil_blink:'PASS',
    exact_canvas_anchor:'PASS',
    responsive_constraints:'PASS',
    hard_pixel_layout_as_final_strategy:false,
    soft_region_locks:'PASS',
    soft_locks_block_during_search:false,
    soft_locks_block_unresolved_final_regression:true,
    deterministic_priority:'PASS',
    ai_priority_weighting:false,
    semantic_implementation_gate:'PASS',
    screenshot_hack_detection:'PASS',
    production_deploy:false,public_deploy:false,wave20_locked:true
  };
  await writeFile('artifacts/visual-foundry/stencil-constraint-v1/evidence.json',JSON.stringify({
    evidence,constraintSet,anchor,projectedSidebar,projectedAttention,lockSet,warned,priorities,semanticGood,semanticBad
  },null,2));
  console.log(JSON.stringify(evidence,null,2));
}finally{
  await browser.close();
}
