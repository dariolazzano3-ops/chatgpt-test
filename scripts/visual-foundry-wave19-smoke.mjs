import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createProviderBenchmarkCase, runProviderBenchmark, authorizeBenchmarkWinner, goldStandardBenchmarkStatus } from '../src/visual-foundry/benchmark-harness.js';

const benchmarkCase=createProviderBenchmarkCase({
  benchmark_id:'synthetic-three-provider-harness',project_id:'synthetic',
  reference_id:'synthetic-approved-ref',reference_hash:'sha256:synthetic',reference_spec_version:'1',reference_spec_hash:'sha256:spec',
  codebase_revision:'synthetic-revision',viewport:{width:1440,height:1100,device_pixel_ratio:1},fixture_version:'1',iteration_limit:8,
  tools:['playwright','dom-measurement','pixel-diff','ssim'],acceptance:{geometry_score_min:.97,perceptual_score_min:.96,pixel_difference_percent_max:3}
});
const mk=(family,quality,cost,iterations)=>async ({case_hash})=>({
  status:'COMPLETED',case_hash,visual_fidelity:quality,geometry_score:quality+.005,perceptual_score:quality-.005,human_review:'PASS',
  iteration_count:iterations,latency_ms:2000+iterations*100,input_tokens:2000,output_tokens:500,cost_usd:cost,
  regression_rate:.01,hallucination_rate:.01,architecture_drift:0,files_changed:['projects/synthetic/styles.css'],delta_start:12,delta_end:1
});
const report=await runProviderBenchmark(benchmarkCase,[
  {id:'openai-synthetic',family:'OPENAI',model:'synthetic-a',runner:mk('OPENAI',.98,1.2,4)},
  {id:'anthropic-synthetic',family:'ANTHROPIC',model:'synthetic-b',runner:mk('ANTHROPIC',.975,1.0,5)},
  {id:'google-synthetic',family:'GOOGLE',model:'synthetic-c',runner:mk('GOOGLE',.97,.8,4)}
],{real_provider_calls:false});
assert.equal(report.status,'SYNTHETIC_HARNESS_VALIDATED');
assert.equal(report.identical_case_for_all_providers,true);
assert.deepEqual(report.missing_provider_families,[]);
assert.equal(report.winner_declared,false);
assert.equal(report.eligible_for_winner_selection,false);
assert.equal(report.benchmark_not_marketing_based,true);
assert.ok(report.runs.every(r=>r.case_hash===benchmarkCase.case_hash));
assert.ok(report.runs.every(r=>r.delta_reduction_per_dollar>0));
assert.throws(()=>authorizeBenchmarkWinner(report,{provider_id:'openai-synthetic',human_approved:true}),/REAL_COMPLETE_BENCHMARK_REQUIRED/);

const overCost=await runProviderBenchmark(benchmarkCase,[
  {id:'openai-costly',family:'OPENAI',model:'costly',runner:async({case_hash})=>({status:'COMPLETED',case_hash,cost_usd:5.5,human_review:'PASS'})}
],{real_provider_calls:false});
assert.equal(overCost.runs[0].status,'COST_REVIEW_REQUIRED');

const registry=JSON.parse(await readFile('factory-state/visual-foundry/reference-registry.json','utf8'));
const approved=registry.records.some(r=>r.status==='APPROVED'&&r.project_id==='aurentara-masterdashboard');
const gold=goldStandardBenchmarkStatus({approved_reference_available:approved});
assert.equal(approved,false);
assert.equal(gold.status,'BLOCKED_APPROVED_REFERENCE_REQUIRED');
assert.equal(gold.fake_reference_allowed,false);

const evidence={ok:true,suite:'visual-foundry-wave19-smoke',identical_benchmark_case:'PASS',openai_family_harness:'PASS',anthropic_family_harness:'PASS',google_family_harness:'PASS',delta_reduction_per_dollar:'PASS',cost_review_guard:'PASS',synthetic_winner_declared:false,aurentara_gold_standard_status:gold.status,production_deploy:false,external_writes:false};
await mkdir('artifacts/visual-foundry/wave19',{recursive:true});
await writeFile('artifacts/visual-foundry/wave19/evidence.json',JSON.stringify({evidence,benchmark_case:benchmarkCase,report,over_cost:overCost,gold_standard:gold},null,2));
console.log(JSON.stringify(evidence,null,2));
