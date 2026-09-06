import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createGoldenBaseline, evaluateGoldenRegression, validateGoldenBaseline } from '../src/visual-foundry/golden-regression.js';

assert.throws(()=>createGoldenBaseline({visual_acceptance:'PASS',functional_acceptance:'PASS',responsive_acceptance:'PASS',accessibility_acceptance:'PASS',human_visual_approval:'NOT_EVALUATED'}),/GOLDEN_HUMAN_VISUAL_APPROVAL_REQUIRED/);

const golden=createGoldenBaseline({
  golden_id:'golden-v1',project_id:'p',reference_id:'ref-v1',reference_version:'1.0',reference_hash:'sha256:ref',
  approved_runtime_screenshot:'approved-runtime.png',approved_runtime_screenshot_hash:'sha256:runtime',implementation_commit:'approved-commit',
  browser_environment:{browser:'chromium',version:'pinned'},approved_by:'operator',
  visual_acceptance:'PASS',functional_acceptance:'PASS',responsive_acceptance:'PASS',accessibility_acceptance:'PASS',human_visual_approval:'PASS'
});
assert.equal(validateGoldenBaseline(golden).ok,true);
assert.equal(golden.reference_understanding_replaced,false);
assert.equal(Object.isFrozen(golden),true);

const perfect={schema:'riosystems.visual-measurement-report.v1',geometry:{dimensions_equal:true},perceptual:{score:1},pixel_difference:{percent:0},color:{score:1},edge:{score:1}};
const pass=evaluateGoldenRegression({golden,implementation_commit:'later',measurement_report:perfect,critical_delta_count:0});
assert.equal(pass.status,'PASS');
assert.equal(pass.mode,'POST_APPROVAL_VISUAL_REGRESSION');
assert.equal(pass.initial_reference_replication_reopened,false);

const drift={schema:'riosystems.visual-measurement-report.v1',geometry:{dimensions_equal:true},perceptual:{score:.94},pixel_difference:{percent:4},color:{score:.97},edge:{score:.96}};
const fail=evaluateGoldenRegression({golden,implementation_commit:'drift',measurement_report:drift,critical_delta_count:1});
assert.equal(fail.status,'FAIL');
assert.ok(fail.failed_checks.includes('perceptual_score'));
assert.ok(fail.failed_checks.includes('critical_delta_count'));

const pending=evaluateGoldenRegression({golden});
assert.equal(pending.status,'NOT_EVALUATED');

const evidence={ok:true,suite:'visual-foundry-wave16-smoke',golden_requires_human_approval:'PASS',golden_immutable:'PASS',post_approval_regression:'PASS',visual_drift_detected:'PASS',reference_understanding_preserved:'PASS',production_deploy:false,external_writes:false};
await mkdir('artifacts/visual-foundry/wave16',{recursive:true});
await writeFile('artifacts/visual-foundry/wave16/evidence.json',JSON.stringify({evidence,golden,pass,fail,pending},null,2));
console.log(JSON.stringify(evidence,null,2));
