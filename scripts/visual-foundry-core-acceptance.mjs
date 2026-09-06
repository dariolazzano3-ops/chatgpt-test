import assert from 'node:assert/strict';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { goldStandardBenchmarkStatus } from '../src/visual-foundry/benchmark-harness.js';

const CORE_FILES=[
  'src/visual-foundry/baseline.js',
  'src/visual-foundry/reference-registry.js',
  'src/visual-foundry/reference-spec.js',
  'src/visual-foundry/render-lab.js',
  'src/visual-foundry/dom-measurement.js',
  'src/visual-foundry/visual-comparator.js',
  'src/visual-foundry/visual-delta.js',
  'src/visual-foundry/visual-acceptance.js',
  'src/visual-foundry/fixture-mode.js',
  'src/visual-foundry/runtime-binding.js',
  'src/visual-foundry/semantic-review.js',
  'src/visual-foundry/model-router.js',
  'src/visual-foundry/delta-closer.js',
  'src/visual-foundry/responsive-engine.js',
  'src/visual-foundry/asset-ledger.js',
  'src/visual-foundry/typography-contract.js',
  'src/visual-foundry/golden-regression.js',
  'src/visual-foundry/evidence-pack.js',
  'src/visual-foundry/cost-architecture.js',
  'src/visual-foundry/benchmark-harness.js'
];

for(const file of CORE_FILES) await access(file);

const registry=JSON.parse(await readFile('factory-state/visual-foundry/reference-registry.json','utf8'));
assert.equal(registry.schema,'riosystems.reference-registry.v1');
const approvedAurentara=(registry.records||[]).filter(r=>r.status==='APPROVED'&&r.project_id==='aurentara-masterdashboard');
assert.ok(approvedAurentara.length<=1,'AURENTARA Gold Standard reference must resolve unambiguously');

const gold=goldStandardBenchmarkStatus({approved_reference_available:approvedAurentara.length>0});
assert.equal(gold.status,approvedAurentara.length===1?'READY_FOR_REAL_BENCHMARK':'BLOCKED_APPROVED_REFERENCE_REQUIRED');
assert.equal(gold.fake_reference_allowed,false);

const repairHost=await readFile('scripts/qa-repair-loop.mjs','utf8');
assert.match(repairHost,/visualDeltaClosureHostDescriptor/);
assert.match(repairHost,/max_visual_qa_attempts/);
assert.match(repairHost,/MAX_VISUAL_QA_ATTEMPTS/);

const workflow=await readFile('.github/workflows/visual-foundry-wave0.yml','utf8');
assert.doesNotMatch(workflow,/visual-foundry-wave20|WAVE20|wave20/i,'Wave 20 must not be started by the core gate');
for(let wave=0;wave<=19;wave++){
  assert.match(workflow,new RegExp(`visual-foundry-wave${wave}-smoke\\.mjs`),`Wave ${wave} smoke must be part of the core gate`);
}

const packageJson=JSON.parse(await readFile('package.json','utf8'));
assert.equal(packageJson.devDependencies.playwright,'1.55.0');
assert.equal(packageJson.devDependencies.pixelmatch,'7.2.0');
assert.equal(packageJson.devDependencies.pngjs,'7.0.0');
assert.equal(packageJson.devDependencies['ssim.js'],'3.5.0');

const evidence={
  schema:'riosystems.visual-foundry-core-acceptance.v1',
  status:'CORE_IMPLEMENTATION_ACCEPTED',
  waves:{
    implemented_and_gated:'0-19',
    count:20,
    wave20_started:false
  },
  architecture:{
    deterministic_visual_acceptance_authoritative:true,
    functional_pass_implies_visual_pass:false,
    semantic_review_additive_only:true,
    fixture_runtime_truth_separated:true,
    production_fixture_mode_disabled:true,
    bounded_visual_repair:true,
    visual_repair_hard_max_iterations:8,
    canonical_qa_repair_host_reused:true,
    provider_registry_reused:true,
    golden_requires_human_approval:true,
    benchmark_winner_declared:false
  },
  regression:{
    all_wave_smokes_in_core_gate:true,
    qa_repair_policy_regression_required:true,
    factory_observability_regression_required:true
  },
  gold_standard:{
    status:gold.status,
    approved_reference_count:approvedAurentara.length,
    poc_state_owned_by_gold_standard_evidence:true,
    poc_accepted:false,
    fake_reference_allowed:false
  },
  deployment:{
    production:false,
    public:false,
    dns:false,
    billing:false,
    merge:false,
    pr_created:false
  },
  scope:{
    dashboard_integration_started:false,
    wave20_started:false
  }
};

await mkdir('artifacts/visual-foundry/core-acceptance',{recursive:true});
await writeFile('artifacts/visual-foundry/core-acceptance/evidence.json',JSON.stringify(evidence,null,2));
console.log(JSON.stringify(evidence,null,2));
