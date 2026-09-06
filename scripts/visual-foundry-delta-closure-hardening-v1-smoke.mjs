import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import pngjs from 'pngjs';
import jpeg from 'jpeg-js';
import { createReferenceCropContract, extractReferenceAsset, validateReferenceCropContract } from '../src/visual-foundry/reference-asset-extractor.js';
import { createTypographyCalibrationRequest, resolveTypographyCalibration } from '../src/visual-foundry/typography-resolver.js';
import { createCssOptimizationProblem, optimizeCssParameters } from '../src/visual-foundry/css-optimizer.js';
import { evaluateRegionRegressionGuard, freezePassingRegions, runRegressionProtectedRegionClosure } from '../src/visual-foundry/region-closure.js';

const {PNG}=pngjs;
const sha256=b=>crypto.createHash('sha256').update(b).digest('hex');
await mkdir('artifacts/visual-foundry/hardening-v1',{recursive:true});

// A. Reference asset extractor: exact hash, bounded crop, PNG + JPEG support.
const source=new PNG({width:16,height:12});
for(let y=0;y<12;y++)for(let x=0;x<16;x++){
  const i=(y*16+x)*4;
  source.data[i]=x*10;source.data[i+1]=y*15;source.data[i+2]=80;source.data[i+3]=255;
}
const sourcePng=PNG.sync.write(source);
await writeFile('artifacts/visual-foundry/hardening-v1/reference.png',sourcePng);
const contract=createReferenceCropContract({
  reference_id:'ref-v1',reference_version:'1.0',reference_hash:sha256(sourcePng),asset_id:'hero-earth',
  role:'HERO_BACKGROUND',fidelity_importance:'CRITICAL',canvas:{width:16,height:12},crop:{x:4,y:3,width:6,height:5}
});
assert.equal(validateReferenceCropContract(contract).ok,true);
const extracted=await extractReferenceAsset({contract,reference_path:'artifacts/visual-foundry/hardening-v1/reference.png',output_path:'artifacts/visual-foundry/hardening-v1/crop.png'});
assert.deepEqual(extracted.dimensions,{width:6,height:5});
assert.equal(extracted.provenance,'REFERENCE_EXTRACTED');
assert.equal(extracted.usage_scope,'GOLD_STANDARD_POC_ONLY');
assert.equal(extracted.production_use_allowed,false);
assert.throws(()=>createReferenceCropContract({...contract,canvas:{width:16,height:12},crop:{x:15,y:10,width:5,height:5}}),/REFERENCE_CROP_OUT_OF_BOUNDS/);
const wrong={...contract,reference_hash:'0'.repeat(64)};
await assert.rejects(()=>extractReferenceAsset({contract:wrong,reference_path:'artifacts/visual-foundry/hardening-v1/reference.png',output_path:'artifacts/visual-foundry/hardening-v1/bad.png'}),/REFERENCE_HASH_MISMATCH/);

const jpegBytes=jpeg.encode({data:source.data,width:16,height:12},95).data;
await writeFile('artifacts/visual-foundry/hardening-v1/reference.jpg',jpegBytes);
const jpegContract=createReferenceCropContract({...contract,reference_hash:sha256(jpegBytes),asset_id:'jpeg-crop'});
const jpegExtract=await extractReferenceAsset({contract:jpegContract,reference_path:'artifacts/visual-foundry/hardening-v1/reference.jpg',output_path:'artifacts/visual-foundry/hardening-v1/jpeg-crop.png'});
assert.equal(jpegExtract.source_format,'JPEG');

// B. Typography resolver: deterministic metric equivalence, no fake font identity.
const typographyRequest=createTypographyCalibrationRequest({
  role:'hero_title',identity_status:'UNRESOLVED_RASTER',
  families:['Arial','Inter'],weights:[600,700],sizes:[40,42,44],line_heights:[46,48,50],letter_spacing:[-0.4,0,0.4],
  threshold:.97,max_evaluations:200
});
const typo=await resolveTypographyCalibration(typographyRequest,{evaluate:async c=>{
  const distance=(c.family==='Inter'?0:.08)+Math.abs(c.weight-700)/1000+Math.abs(c.size-42)/40+Math.abs(c.line_height-48)/60+Math.abs(c.letter_spacing+0.4)/4;
  const score=Math.max(0,1-distance);
  return {perceptual_score:score,geometry_score:score,pixel_difference_percent:(1-score)*20};
}});
assert.equal(typo.status,'PASS');
assert.equal(typo.best.candidate.family,'Inter');
assert.equal(typo.best.candidate.weight,700);
assert.equal(typo.best.candidate.size,42);
assert.equal(typo.best.candidate.line_height,48);
assert.equal(typo.best.candidate.letter_spacing,-0.4);
assert.equal(typo.font_identity_resolved,false);
assert.equal(typo.exact_font_identity_claimed,false);

// C. CSS optimizer: coordinate descent + protected-region regression guard.
const problem=createCssOptimizationProblem({
  parameters:[
    {name:'sidebar_width',current:224,min:208,max:232,step:2,unit:'px'},
    {name:'hero_height',current:127,min:111,max:135,step:2,unit:'px'}
  ],
  target_regions:['sidebar','hero'],protected_regions:['toolbar'],max_evaluations:80,min_improvement:.0001
});
const css=await optimizeCssParameters(problem,{evaluate:async v=>{
  const sidebar=Math.max(0,1-Math.abs(v.sidebar_width-216)/40);
  const hero=Math.max(0,1-Math.abs(v.hero_height-119)/40);
  const toolbar=v.sidebar_width<212?.90:.995;
  return {global_score:(sidebar+hero+toolbar)/3,regions:[{region_id:'sidebar',score:sidebar},{region_id:'hero',score:hero},{region_id:'toolbar',score:toolbar}]};
}});
assert.equal(css.values.sidebar_width,216);
assert.equal(css.values.hero_height,119);
assert.ok(css.history.some(h=>h.protected_pass===false||h.accepted===true));
assert.equal(css.regression_protection,true);

// D. Region closure: reject regression, then freeze passing regions.
const guard=evaluateRegionRegressionGuard({
  before:{regions:[{region_id:'sidebar',score:.99},{region_id:'hero',score:.5}]},
  after:{regions:[{region_id:'sidebar',score:.90},{region_id:'hero',score:.8}]},
  protected_regions:['sidebar'],pass_threshold:.96
});
assert.equal(guard.status,'REJECT');
assert.deepEqual(freezePassingRegions({regions:[{region_id:'sidebar',score:.99},{region_id:'hero',score:.5}]},{pass_threshold:.96}),['sidebar']);

let proposalNo=0,accepted=0,reverted=0;
const sequence=[
  {regions:[{region_id:'sidebar',score:.90},{region_id:'hero',score:.72}]},
  {regions:[{region_id:'sidebar',score:.99},{region_id:'hero',score:.82}]},
  {regions:[{region_id:'sidebar',score:.99},{region_id:'hero',score:.975}]}
];
const closure=await runRegressionProtectedRegionClosure({
  target_regions:['hero'],pass_threshold:.96,max_iterations:5,min_target_improvement:.001
},{
  baseline:async()=>({regions:[{region_id:'sidebar',score:.99},{region_id:'hero',score:.5}]}),
  propose:async()=>({id:++proposalNo}),
  apply:async p=>({proposal:p}),
  render_measure:async()=>sequence.shift(),
  accept:async()=>{accepted++},
  revert:async()=>{reverted++}
});
assert.equal(closure.status,'PASS');
assert.equal(reverted,1);
assert.equal(accepted,2);
assert.ok(closure.protected_regions.includes('sidebar'));
assert.ok(closure.protected_regions.includes('hero'));

const evidence={
  ok:true,suite:'visual-foundry-delta-closure-hardening-v1',
  reference_asset_extractor:'PASS',
  reference_hash_fail_closed:'PASS',
  jpeg_png_support:'PASS',
  poc_only_asset_scope:'PASS',
  typography_metric_resolver:'PASS',
  exact_font_identity_not_faked:'PASS',
  deterministic_css_optimizer:'PASS',
  protected_region_regression_guard:'PASS',
  region_freeze_and_monotonic_closure:'PASS',
  max_visual_iterations:8,
  wave20_locked:true,
  production_deploy:false,public_deploy:false,external_writes:false
};
await writeFile('artifacts/visual-foundry/hardening-v1/evidence.json',JSON.stringify({evidence,extracted,jpegExtract,typography:typo,css,closure},null,2));
console.log(JSON.stringify(evidence,null,2));
