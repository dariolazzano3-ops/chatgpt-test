import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createVisualDelta } from '../src/visual-foundry/visual-delta.js';
import { applySemanticVisualReview, createSemanticVisualReviewRequest, semanticReviewWithoutProvider } from '../src/visual-foundry/semantic-review.js';

const base={reference_id:'ref-v1',implementation_commit:'commit-v10',viewport:{width:1440,height:1100,device_pixel_ratio:1}};
const deterministic=[createVisualDelta({...base,delta_id:'det-geometry',category:'GEOMETRY',severity:'HIGH',expected:300,actual:340,difference:40,unit:'px',score:0.9,blocking:true})];

const request=createSemanticVisualReviewRequest({...base,reference_image:'reference.png',runtime_image:'runtime.png',deterministic_deltas:deterministic,regions:[{region_id:'hero'}]});
assert.equal(request.deterministic_fail_override_allowed,false);
assert.equal(request.deterministic_delta_deletion_allowed,false);

const reviewed=applySemanticVisualReview({...base,deterministic_deltas:deterministic,semantic_result:{findings:[
  {type:'VISUAL_HIERARCHY',severity:'MEDIUM',region:'hero',summary:'Primary heading lacks expected dominance.',confidence:0.82,repair_hint:'Increase hierarchy without changing measured geometry contracts.'},
  {type:'STYLISTIC_DRIFT',severity:'LOW',component_id:'sidebar',summary:'Surface treatment drifts from reference.',confidence:0.72}
]}});
assert.equal(reviewed.deterministic_delta_count,1);
assert.equal(reviewed.semantic_delta_count,2);
assert.equal(reviewed.combined_deltas.length,3);
assert.equal(reviewed.combined_deltas[0].delta_id,'det-geometry');
assert.equal(reviewed.deterministic_deltas_preserved,true);
assert.equal(reviewed.acceptance_authority,'DETERMINISTIC_MEASUREMENT_ONLY');

assert.throws(()=>applySemanticVisualReview({...base,deterministic_deltas:deterministic,semantic_result:{override_deterministic_fail:true,findings:[]}}),/SEMANTIC_OVERRIDE_FORBIDDEN/);
assert.throws(()=>applySemanticVisualReview({...base,deterministic_deltas:deterministic,semantic_result:{delete_delta_ids:['det-geometry'],findings:[]}}),/SEMANTIC_DELTA_DELETION_FORBIDDEN/);

const unavailable=semanticReviewWithoutProvider({deterministic_deltas:deterministic});
assert.equal(unavailable.status,'NOT_EXECUTED_PROVIDER_UNAVAILABLE');
assert.equal(unavailable.combined_deltas.length,1);

const evidence={ok:true,suite:'visual-foundry-wave10-smoke',semantic_review_additive_only:'PASS',deterministic_delta_preservation:'PASS',override_forbidden:'PASS',deletion_forbidden:'PASS',provider_unavailable_fail_safe:'PASS',acceptance_authority:'DETERMINISTIC_MEASUREMENT_ONLY',production_deploy:false,external_writes:false};
await mkdir('artifacts/visual-foundry/wave10',{recursive:true});
await writeFile('artifacts/visual-foundry/wave10/evidence.json',JSON.stringify({evidence,request,reviewed,unavailable},null,2));
console.log(JSON.stringify(evidence,null,2));
