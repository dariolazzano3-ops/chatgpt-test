import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compileMissionPackage } from '../src/mission-compiler.js';
import { evaluateMissionRuntime } from '../src/runtime-control-plane.js';
import { createProviderRegistry } from '../src/runtime-governance.js';
import {
  buildAdapterDispatchEnvelope,
  executeCanonicalProviderRoute
} from '../src/execution-adapters.js';
import {
  createCustomerProject,
  assignProjectCapabilities,
  attachProjectMission,
  transitionCustomerProject
} from '../src/project-operating-layer.js';
import {
  createExecutionRun,
  checkpointExecution,
  finalizeUnifiedOperationalDelivery
} from '../src/execution-delivery-operations.js';
import { createOperatorRuntime } from '../src/operator-runtime-v1.js';
import { createMemoryOperatorRuntimeStore } from '../src/operator-runtime-store-v1.js';
import { createOperatorRuntimeApiService } from '../src/operator-runtime-api-v1.js';
import { interpretOperatorAiResult } from '../src/operator-ai/result-interpreter-v1.js';
import { operatorStagingDeploymentEvidenceManifest } from '../src/operator-staging-deployment-evidence-v1.js';

const canonicalHead = 'be28878bc76cb71623805941e04bb39baecb2e34';
const canonicalTree = '91b272351c72aa1cdb9e35fb19f43364578d1cb7';
const scopeKey = 'gelato-donatello:gelato-donatello-website-v1';

function readJson(path) {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
}

const confirmed = readJson('../projects/gelato-donatello-website-v1/confirmed-project-inputs-v1.json');
const autoClosure = readJson('../projects/gelato-donatello-website-v1/auto-customer-input-closure-v1.json');
const multiSource = readJson('../projects/gelato-donatello-website-v1/entity-aware-multi-source-verification-v1.json');
const deliveryContract = readJson('../projects/gelato-donatello-website-v1/customer-delivery-contract-v1.json');

assert.equal(confirmed.project_ref.scope_key, scopeKey);
assert.equal(autoClosure.project_ref.scope_key, scopeKey);
assert.equal(multiSource.project_ref.scope_key, scopeKey);
assert.equal(deliveryContract.scope_key, scopeKey);
assert.equal(confirmed.safety.production_deploy, false);
assert.equal(deliveryContract.safety.production_deploy, false);
assert.equal(deliveryContract.safety.automatic_paid_provider_calls, false);
assert.equal(deliveryContract.safety.uncontrolled_external_writes, false);

const humanQuestions = autoClosure.human_questions || [];
assert.equal(humanQuestions.length, 7, 'Gelato human decisions must remain explicit');
assert.equal(humanQuestions.every((item) => item.required === true), true);
assert.equal(deliveryContract.human_decisions_required.length, 7);
assert.equal(deliveryContract.missing_inputs.length, 6);
assert.equal(deliveryContract.customer_review_required, true);
assert.equal(deliveryContract.production_approval_required, true);
assert.equal(multiSource.discovery.sources_accepted >= 1, true);
assert.equal(confirmed.asset_rights.publishable_asset_count, 5);

const verifiedContent = Object.fromEntries(
  confirmed.facts
    .filter((fact) => fact.verification_status === 'OPERATOR_CONFIRMED')
    .map((fact) => [fact.field_path, fact.value])
);
assert.equal(verifiedContent['business.name'], 'Gelato Donatello');
assert.equal(verifiedContent['products.flavor_count'], 40);

const projectContext = {
  schema: 'aurentara.project-mission-context.v1',
  project: {
    operator_id: 'operator-wave9-gelato',
    customer_id: confirmed.project_ref.customer_id,
    project_id: confirmed.project_ref.project_id,
    scope_key: scopeKey
  },
  knowledge_revision: 1,
  content_pack_ref: {
    pack_id: 'gelato-wave9-confirmed-content',
    version: 1,
    knowledge_revision: 1
  },
  visual_pack_ref: {
    pack_id: 'gelato-wave9-rights-safe-visuals',
    version: 1,
    knowledge_revision: 1
  },
  readiness_ref: {
    readiness_id: 'gelato-wave9-ready-with-human-gates',
    status: 'READY_WITH_WARNINGS',
    knowledge_revision: 1
  },
  fact_version_refs: confirmed.facts.map((fact, index) => ({
    fact_id: `gelato-confirmed-${index + 1}`,
    field_path: fact.field_path,
    version: 1
  })),
  source_refs: [
    'primary-anchor-website',
    ...multiSource.discovery.results.filter((item) => item.accepted === true).map((item) => item.project_source_id)
  ],
  rights_constraints: {
    publishable_rights: ['OWNED_CONFIRMED','CUSTOMER_LICENSED','CUSTOMER_ASSERTED'],
    approved_asset_ids: [],
    reference_content_copy_forbidden: true
  },
  human_decision_refs: humanQuestions.map((question) => ({
    decision_id: question.id,
    status: 'OPEN',
    required: true
  })),
  approved_assets: [],
  assets: [],
  open_critical_conflicts: [],
  verified_content: verifiedContent,
  visual_context: {
    rights_ready_asset_count: confirmed.asset_rights.publishable_asset_count,
    final_quality_approval_required: true
  },
  visual_references: [],
  website_sources: [{
    source_id: 'primary-anchor-website',
    source_url: multiSource.primary_anchor.source_url,
    source_role: 'ANCHOR_OWNED_WEBSITE',
    effective_usage: {
      content: true,
      structure_reference: false,
      design_reference: false
    }
  }],
  constraints: [
    'private staging only',
    'no production deploy',
    'no DNS changes',
    'no billing or checkout',
    'no automatic paid provider calls',
    'do not auto-answer human decisions'
  ],
  quality_contract: {
    provenance_required: true,
    rights_enforced: true,
    critical_conflicts_blocked: true,
    human_quality_approval_required: true
  },
  deployment_policy: {
    staging_only: true,
    production_deploy: false
  }
};

const compiled = compileMissionPackage({
  prompt: 'Erstelle aus den bestätigten Gelato-Projektfakten eine private Website-Vorschau. Unbestätigte Kontakt-, Legal-, Öffnungszeit- oder Conversion-Angaben dürfen nicht als bestätigt veröffentlicht werden.',
  project_context: projectContext,
  customer_id: confirmed.project_ref.customer_id,
  project_id: confirmed.project_ref.project_id,
  scope_key: scopeKey,
  canonical_branch: 'factory-control',
  active_revision: canonicalHead,
  project_head: canonicalHead,
  mission_revision: canonicalHead,
  expected_parent_sha: canonicalHead
});
assert.equal(compiled.ok, true);
assert.equal(compiled.package.project_context_binding.scope_key, scopeKey);
assert.equal(compiled.package.project_context_binding.knowledge_revision, 1);
assert.equal(compiled.package.safeguards.production_deploy, false);

const registry = createProviderRegistry([{
  id: 'riosystems-native-web',
  capability: 'web.build',
  enabled: true,
  external: false,
  paid: false,
  estimated_cost_units: 0,
  priority: 1,
  runner: async () => ({ ok: true })
}]);

const runtime = evaluateMissionRuntime(compiled.package, {
  registry,
  customer_id: confirmed.project_ref.customer_id,
  project_id: confirmed.project_ref.project_id,
  limit_cost_units: 0,
  approvals: [],
  provider_health: {},
  require_canonical_execution_binding: true,
  project_root: 'projects/gelato-donatello-website-v1'
});
assert.equal(runtime.ok, true);
assert.equal(runtime.blocked, false);
assert.equal(runtime.ready_for_supervised_execution, true);
assert.equal(runtime.scope.scope_key, scopeKey);
assert.equal(runtime.ledger.reserved_cost_units, 0);

const runtimeTask = runtime.tasks.find((task) => task.engine === 'web');
assert.ok(runtimeTask);
assert.ok(runtimeTask.canonical_execution_contract);
assert.equal(runtimeTask.canonical_execution_contract.project_scope_key, scopeKey);
assert.equal(runtimeTask.canonical_execution_contract.environment, 'staging');
assert.equal(runtimeTask.canonical_execution_contract.write_policy, 'NO_EXTERNAL_WRITES');
assert.equal(runtimeTask.canonical_execution_contract.production_policy, 'PRODUCTION_DISABLED');

const envelope = buildAdapterDispatchEnvelope(runtimeTask.canonical_execution_contract);
assert.equal(envelope.ok, true);
assert.equal(envelope.project_scope_key, scopeKey);
assert.equal(envelope.provider_route.provider_id, 'riosystems-native-web');

const executed = await executeCanonicalProviderRoute(envelope, {
  current_runtime_verified_provider_ids: ['riosystems-native-web'],
  synthetic_acceptance: true,
  executors: {
    'riosystems-native-web': async ({ provider_id, descriptor }) => ({
      ok: true,
      status: 'COMPLETED',
      outputs: {
        preview_url: 'projects/gelato-donatello-website-v1/ferrari-preview-v1.html',
        artifact_ref: 'projects/gelato-donatello-website-v1/ferrari-preview-v1.html',
        evidence_mode: 'SAFE_INJECTED_STAGING_ACCEPTANCE'
      },
      actual_provider: provider_id,
      executor_id: descriptor.executor_id,
      external_job_id: 'wave9-gelato-private-acceptance',
      actual_cost_eur: 0,
      production_deploy: false
    })
  }
});
assert.equal(executed.ok, true);
assert.equal(executed.status, 'COMPLETED');
assert.equal(executed.provider_truth.planned_provider, 'riosystems-native-web');
assert.equal(executed.provider_truth.dispatched_provider, 'riosystems-native-web');
assert.equal(executed.provider_truth.actual_provider, 'riosystems-native-web');
assert.equal(executed.provider_truth.executor_id, 'web-factory-native-v1');
assert.equal(executed.raw_result.actual_cost_eur, 0);
assert.equal(executed.result.production_deploy, false);

const mission = structuredClone(compiled.package.mission);
const missionTask = mission.tasks.find((task) => task.task_id === runtimeTask.task_id);
assert.ok(missionTask);
missionTask.state = 'COMPLETED';
missionTask.attempt = 1;
missionTask.inputs = {
  ...(missionTask.inputs || {}),
  dispatch_envelope: envelope
};
missionTask.outputs = {
  preview_url: executed.raw_result.outputs.preview_url,
  qa_status: 'passed',
  artifacts: [{
    type: 'website',
    ref: executed.raw_result.outputs.artifact_ref
  }],
  execution_evidence: {
    dispatched_provider: executed.provider_truth.dispatched_provider,
    actual_provider: executed.provider_truth.actual_provider,
    executor_id: executed.provider_truth.executor_id
  }
};
mission.status = 'COMPLETED';

let project = createCustomerProject({
  customer_id: confirmed.project_ref.customer_id,
  project_id: confirmed.project_ref.project_id,
  name: 'Gelato Donatello',
  objective: deliveryContract.customer_problem,
  project_root: 'projects/gelato-donatello-website-v1',
  budget_cost_units: 0
}).project;
project.delivery_contract = structuredClone(deliveryContract);
project = assignProjectCapabilities(project, [{
  id: missionTask.capability,
  factory: missionTask.domain || missionTask.engine,
  required: true
}]).project;
project = attachProjectMission(project, {
  mission_id: mission.mission_id,
  customer_id: project.customer_id,
  project_id: project.project_id,
  status: mission.status,
  source_revision: canonicalHead
}).project;
project = transitionCustomerProject(project, { state: 'READY', actor: 'wave9-acceptance' }).project;
project = transitionCustomerProject(project, { state: 'ACTIVE', actor: 'wave9-acceptance' }).project;

let run = createExecutionRun(project, { run_id: 'run-wave9-gelato-full-integration' }).run;
run = checkpointExecution(run, {
  status: 'RUNNING',
  actor: 'wave9-acceptance',
  mission_id: mission.mission_id
}).run;
run = checkpointExecution(run, {
  status: 'QA',
  actor: 'wave9-acceptance',
  mission_id: mission.mission_id
}).run;

const runtimeCreated = createOperatorRuntime({
  operator_id: 'operator-wave9-gelato',
  portfolio: {
    operator_id: 'operator-wave9-gelato',
    projects: [project]
  },
  selected_project_scope: scopeKey
});
assert.equal(runtimeCreated.ok, true);
const store = createMemoryOperatorRuntimeStore();
const service = createOperatorRuntimeApiService({
  operator_id: 'operator-wave9-gelato',
  store,
  initial_runtime: runtimeCreated.runtime
});

const deliveryAttempt = await finalizeUnifiedOperationalDelivery(
  project,
  run,
  { mission },
  {
    qa_passed: true,
    scope_verified: true,
    costs_reconciled: true,
    execution_results: {
      [missionTask.task_id]: {
        execution_id: envelope.execution_id,
        provider_truth: executed.provider_truth,
        actual_cost_eur: 0,
        preview_url: executed.raw_result.outputs.preview_url,
        artifacts: missionTask.outputs.artifacts
      }
    },
    task_quality: {
      [missionTask.task_id]: {
        status: 'PASS',
        score: 100,
        evidence: 'confirmed-content private acceptance'
      }
    },
    actor: 'operator-wave9-gelato',
    now: '2026-09-05T13:00:00.000Z'
  },
  {
    operator_runtime_service: service,
    runtime_revision: 1,
    validate: async () => ({
      passed: true,
      quality: {
        status: 'PASS',
        score: 100
      }
    })
  }
);

assert.equal(deliveryAttempt.ok, false);
assert.equal(deliveryAttempt.error, 'PROJECT_DELIVERY_NOT_READY');
assert.equal(
  deliveryAttempt.gate.blockers.some((item) => item.code === 'CUSTOMER_REVIEW_REQUIRED'),
  true,
  'Real Gelato delivery must remain blocked until the human/customer review exists'
);
assert.equal(project.state, 'ACTIVE');
assert.equal(project.deliveries.length, 0);

const operatorInterpretation = interpretOperatorAiResult({
  ok: true,
  status: 'PARTIALLY_BLOCKED',
  canonical_execution: true,
  blockers: [{
    classification: 'CUSTOMER_REQUIRED',
    code: 'GELATO_HUMAN_DECISIONS_REQUIRED',
    message: '7 Gelato Human Decisions und Customer Review bleiben erforderlich.'
  }],
  tests: [{
    name: 'wave9-gelato-full-integration',
    status: 'PASS_UNTIL_HUMAN_GATE'
  }],
  variable_cost_eur: 0,
  paid_provider_calls: 0
});
assert.equal(operatorInterpretation.status, 'BLOCKED_EXTERNAL');
assert.equal(operatorInterpretation.canonical_execution, true);
assert.equal(operatorInterpretation.production_changed, false);
assert.equal(operatorInterpretation.external_writes, false);
assert.equal(operatorInterpretation.variable_cost_eur, 0);
assert.equal(operatorInterpretation.paid_provider_calls, 0);
assert.match(operatorInterpretation.next_action, /7 Gelato Human Decisions/);

const stagingManifest = operatorStagingDeploymentEvidenceManifest();
assert.equal(stagingManifest.exact_head_required, true);
assert.equal(stagingManifest.github_read_only, true);
assert.equal(stagingManifest.validate_only_never_counts_as_deploy, true);

console.log(JSON.stringify({
  ok: true,
  suite: 'project-repair-wave9-gelato-full-integration-dogfood-v1',
  canonical_head: canonicalHead,
  canonical_tree: canonicalTree,
  scope_key: scopeKey,
  real_project_evidence: true,
  accepted_multi_sources: multiSource.discovery.sources_accepted,
  confirmed_fact_count: confirmed.facts.length,
  publishable_asset_count: confirmed.asset_rights.publishable_asset_count,
  human_decisions_open: humanQuestions.length,
  canonical_mission_compiler: 'PASS',
  project_knowledge_binding: 'PASS',
  runtime_control_plane: 'PASS',
  canonical_provider_executor_truth: 'PASS',
  cost_actual_eur: executed.raw_result.actual_cost_eur,
  paid_provider_calls: 0,
  external_writes: 0,
  qa: 'PASS',
  delivery_gate: 'CORRECTLY_BLOCKED_BY_CUSTOMER_REVIEW',
  operator_ai_projection: operatorInterpretation.status,
  staging_exact_head_requirement: 'ENFORCED',
  production_deploy: false
}, null, 2));
