import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { buildAcceptanceEnvelope, evaluateVisualAcceptance, resolveVisualThresholds } from '../src/visual-foundry/visual-acceptance.js';

const measurement={
  schema:'riosystems.visual-measurement-report.v1',
  pixel_difference:{ratio:0.01,percent:1},
  perceptual:{score:0.98},
  geometry:{dimensions_equal:true,reference:{width:1440,height:1100},actual:{width:1440,height:1100}},
  color:{score:0.99},
  edge:{score:1},
  regions:[]
};
const geometry={schema:'riosystems.geometry-comparison.v1',score:0.99,components:[],blocking_count:0};

const pass=evaluateVisualAcceptance({measurement_report:measurement,geometry_report:geometry,typography_score:0.99,deltas:[]});
assert.equal(pass.status,'PASS');
assert.equal(pass.structural_score,1);
assert.equal(pass.critical_delta_count,0);

const criticalLocal=evaluateVisualAcceptance({
  measurement_report:measurement,geometry_report:geometry,typography_score:0.99,
  deltas:[{category:'STRUCTURE',severity:'CRITICAL',blocking:true,region:'hero'}]
});
assert.equal(criticalLocal.status,'FAIL');
assert.ok(criticalLocal.failed_checks.includes('critical_delta_count'));
assert.ok(criticalLocal.failed_checks.includes('blocking_delta_count'));

const missing=evaluateVisualAcceptance({geometry_report:geometry,typography_score:0.99,deltas:[]});
assert.equal(missing.status,'NOT_EVALUATED');
assert.equal(missing.reason,'DETERMINISTIC_VISUAL_MEASUREMENT_REQUIRED');

const missingTypography=evaluateVisualAcceptance({measurement_report:measurement,geometry_report:geometry,deltas:[]});
assert.equal(missingTypography.status,'NOT_EVALUATED');
assert.ok(missingTypography.missing_metrics.includes('typography_score'));

const strict=evaluateVisualAcceptance({measurement_report:measurement,geometry_report:geometry,typography_score:0.99,deltas:[],thresholds:{perceptual_score_min:0.995}});
assert.equal(strict.status,'FAIL');
assert.equal(resolveVisualThresholds({perceptual_score_min:0.95}).perceptual_score_min,0.95);

const envelope=buildAcceptanceEnvelope({visual_acceptance:pass,functional_acceptance:'PASS',responsive_acceptance:'PASS',accessibility_acceptance:'PASS',human_visual_approval:'NOT_EVALUATED'});
assert.equal(envelope.visual_acceptance,'PASS');
assert.equal(envelope.machine_ready_for_human,true);
assert.equal(envelope.overall_status,'NOT_EVALUATED');
assert.equal(envelope.functional_pass_implies_visual_pass,false);

const independent=buildAcceptanceEnvelope({visual_acceptance:missing,functional_acceptance:'PASS',responsive_acceptance:'PASS',accessibility_acceptance:'PASS',human_visual_approval:'NOT_EVALUATED'});
assert.equal(independent.functional_acceptance,'PASS');
assert.equal(independent.visual_acceptance,'NOT_EVALUATED');
assert.equal(independent.machine_ready_for_human,false);

const evidence={ok:true,suite:'visual-foundry-wave7-smoke',separate_acceptance_states:'PASS',configurable_thresholds:'PASS',critical_region_gate:'PASS',missing_measurement_not_evaluated:'PASS',functional_does_not_imply_visual:'PASS',human_approval_separate:'PASS',production_deploy:false,external_writes:false};
await mkdir('artifacts/visual-foundry/wave7',{recursive:true});
await writeFile('artifacts/visual-foundry/wave7/evidence.json',JSON.stringify({evidence,pass,criticalLocal,missing,missingTypography,strict,envelope,independent},null,2));
console.log(JSON.stringify(evidence,null,2));
