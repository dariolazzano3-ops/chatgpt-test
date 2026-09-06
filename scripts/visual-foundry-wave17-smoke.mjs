import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { buildVisualEvidencePack, buildVisualObservabilitySnapshot, validateVisualEvidencePack, visualEvidenceManifest } from '../src/visual-foundry/evidence-pack.js';

const base={
  evidence_id:'run-1',reference_id:'ref',reference_version:'1',reference_hash:'sha256:ref',fixture_version:'1',
  implementation_commit:'commit17',browser_version:'Chromium 140',viewport:{width:1440,height:1100},dpr:1,
  font_manifest:[{family:'Inter',weight:'400'}],runtime_screenshot:'runtime.png',reference_screenshot:'reference.png',diff_image:'diff.png',
  geometry_snapshot:{components:[]},visual_score:.98,geometry_score:.99,perceptual_score:.98,pixel_difference:1.2,typography_score:.99,color_score:.99,
  critical_deltas:[],blocking_deltas:[],iteration:3,provider:'model-a',model:'vision-a',input_tokens:1200,output_tokens:300,ai_cost:.18,runtime_cost:0,duration:4200,
  changed_files:['projects/demo/styles.css'],functional_result:'PASS',visual_result:'PASS',responsive_result:'PASS',accessibility_result:'PASS',human_result:'PASS',asset_result:'PASS',
  thresholds:{perceptual_score_min:.96}
};
const pack=buildVisualEvidencePack(base);
assert.equal(validateVisualEvidencePack(pack).ok,true);
assert.equal(pack.acceptance_recalculated,false);
assert.equal(pack.production_deploy,false);
assert.equal(visualEvidenceManifest().required_fields.includes('reference_hash'),true);

const local=buildVisualEvidencePack({...base,evidence_id:'run-2',provider:null,model:null,input_tokens:0,output_tokens:0,ai_cost:0,visual_score:.97,human_result:'NOT_EVALUATED'});
const obs=buildVisualObservabilitySnapshot([pack,local]);
assert.equal(obs.runs_total,2);
assert.equal(obs.visual_results.PASS,2);
assert.equal(obs.fake_success_inference,false);
assert.equal(obs.provider_usage['LOCAL_DETERMINISTIC'].runs,1);
assert.ok(obs.total_ai_cost>0);

assert.throws(()=>buildVisualEvidencePack({reference_id:'x'}),/VISUAL_EVIDENCE_REQUIRED_FIELDS_MISSING/);

const evidence={ok:true,suite:'visual-foundry-wave17-smoke',full_visual_evidence_pack:'PASS',required_fields_fail_closed:'PASS',observability_snapshot:'PASS',provider_cost_token_evidence:'PASS',acceptance_recalculated:false,fake_success_inference:false,production_deploy:false,external_writes:false};
await mkdir('artifacts/visual-foundry/wave17',{recursive:true});
await writeFile('artifacts/visual-foundry/wave17/evidence.json',JSON.stringify({evidence,pack,observability:obs,manifest:visualEvidenceManifest()},null,2));
console.log(JSON.stringify(evidence,null,2));
