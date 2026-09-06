import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { approveReference, createReferenceRecord } from '../src/visual-foundry/reference-registry.js';
import { aggregateResponsiveAcceptance, createResponsiveReferenceSet, evaluateResponsiveViewport, resolveResponsiveMode } from '../src/visual-foundry/responsive-engine.js';

const desktop=approveReference(createReferenceRecord({
  reference_id:'desktop-v1',project_id:'p',name:'Desktop',version:'1',source_type:'UPLOAD',source_path:'desktop.png',
  viewport:{width:1440,height:1100,device_pixel_ratio:1},hash:'sha256:desktop'
}),{approved_by:'operator'});
const set=createResponsiveReferenceSet([desktop]);

assert.equal(resolveResponsiveMode(set,{width:1440,height:1100,device_pixel_ratio:1}).mode,'EXPLICIT_REFERENCE');
assert.equal(resolveResponsiveMode(set,{width:390,height:844,device_pixel_ratio:1}).mode,'INFERRED_RESPONSIVE');

const desktopResult=evaluateResponsiveViewport({
  reference_set:set,viewport:{width:1440,height:1100,device_pixel_ratio:1},
  visual_acceptance:{schema:'riosystems.visual-acceptance.v1',status:'PASS',critical_delta_count:0,responsive_critical_delta_count:0}
});
assert.equal(desktopResult.status,'REFERENCE_MATCH_PASS');
assert.equal(desktopResult.claim,'REFERENCE_MATCH');

const mobile=evaluateResponsiveViewport({
  reference_set:set,viewport:{width:390,height:844,device_pixel_ratio:1},
  inferred_metrics:{horizontal_overflow_px:0,critical_responsive_deltas:0,essential_content_visible:true,primary_navigation_usable:true,primary_actions_usable:true}
});
assert.equal(mobile.status,'INFERRED_RESPONSIVE_PASS');
assert.equal(mobile.claim,'NO_REFERENCE_MATCH_CLAIM');

const tabletFail=evaluateResponsiveViewport({
  reference_set:set,viewport:{width:768,height:1024,device_pixel_ratio:1},
  inferred_metrics:{horizontal_overflow_px:14,critical_responsive_deltas:0,essential_content_visible:true,primary_navigation_usable:true,primary_actions_usable:true}
});
assert.equal(tabletFail.status,'INFERRED_RESPONSIVE_FAIL');

const aggregate=aggregateResponsiveAcceptance([desktopResult,mobile]);
assert.equal(aggregate.status,'PASS');
assert.equal(aggregate.explicit_reference_count,1);
assert.equal(aggregate.inferred_count,1);
assert.equal(aggregate.mobile_without_reference_never_claims_match,true);

assert.equal(aggregateResponsiveAcceptance([desktopResult,mobile,tabletFail]).status,'FAIL');

const evidence={ok:true,suite:'visual-foundry-wave13-smoke',explicit_reference_mode:'PASS',inferred_responsive_mode:'PASS',mobile_no_false_reference_match:'PASS',overflow_fail_closed:'PASS',responsive_aggregation:'PASS',production_deploy:false,external_writes:false};
await mkdir('artifacts/visual-foundry/wave13',{recursive:true});
await writeFile('artifacts/visual-foundry/wave13/evidence.json',JSON.stringify({evidence,reference_set:set,desktop:desktopResult,mobile,tablet_fail:tabletFail,aggregate},null,2));
console.log(JSON.stringify(evidence,null,2));
