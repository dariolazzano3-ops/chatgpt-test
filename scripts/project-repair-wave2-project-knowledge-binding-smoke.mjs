import assert from 'node:assert/strict';
import { compileMissionPackage } from '../src/mission-compiler.js';
import { buildTaskExecutionContract } from '../src/orchestration-state.js';
import { buildAdapterDispatchEnvelope } from '../src/execution-adapters.js';

function context(overrides = {}) {
  const base = {
    schema: 'aurentara.project-mission-context.v1',
    project: {
      operator_id: 'operator-repair',
      customer_id: 'repair-customer',
      project_id: 'repair-project',
      scope_key: 'repair-customer:repair-project'
    },
    knowledge_revision: 7,
    content_pack_ref: { pack_id: 'content-pack-7', version: 3, knowledge_revision: 7 },
    visual_pack_ref: { pack_id: 'visual-pack-7', version: 2, knowledge_revision: 7 },
    readiness_ref: { readiness_id: 'readiness-7', status: 'READY', knowledge_revision: 7 },
    fact_version_refs: [
      { fact_id: 'fact-name', field_path: 'business.name', version: 4, source_refs: ['source-owned'] },
      { fact_id: 'fact-goal', field_path: 'website.primary_goal', version: 2, source_refs: ['source-owned'] }
    ],
    source_refs: ['source-owned'],
    rights_constraints: {
      publishable_rights: ['OWNED_CONFIRMED','CUSTOMER_LICENSED','CUSTOMER_ASSERTED'],
      approved_asset_ids: ['asset-logo'],
      non_publishable_reference_assets_forbidden: true,
      website_source_usage_enforced: true,
      reference_content_copy_forbidden: true
    },
    human_decision_refs: [
      { question_id: 'question-1', status: 'RESOLVED', decided_at: '2026-09-05T10:00:00.000Z', resulting_fact_ids: ['fact-goal'], resulting_state_transition: null }
    ],
    approved_assets: [
      { asset_id: 'asset-logo', source_id: 'source-owned', rights_status: 'OWNED_CONFIRMED', publishable: true, usage_role: 'LOGO' }
    ],
    assets: [
      { asset_id: 'asset-logo', source_id: 'source-owned', rights_status: 'OWNED_CONFIRMED', publishable: true, usage_role: 'LOGO' }
    ],
    open_critical_conflicts: [],
    verified_content: { 'business.name': 'Repair Fixture', 'website.primary_goal': 'Generate qualified leads' },
    visual_context: {},
    visual_references: [],
    website_sources: [{
      source_id: 'source-owned',
      source_type: 'OWNED_WEBSITE',
      rights_status: 'OWNED_CONFIRMED',
      locator: 'https://example.invalid/',
      effective_usage: { content: true, structure_reference: false, design_reference: false }
    }],
    constraints: [],
    quality_contract: { provenance_required: true, rights_enforced: true, website_usage_enforced: true, critical_conflicts_blocked: true },
    deployment_policy: { staging_only: true, production_deploy: false }
  };
  return Object.assign(base, structuredClone(overrides));
}

const projectContext = context();
const compiled = compileMissionPackage({
  prompt: 'Baue eine Website, ein CRM, eine Support-KI und eine Lead-Automation.',
  project_context: projectContext,
  customer_id: 'repair-customer',
  project_id: 'repair-project',
  scope_key: 'repair-customer:repair-project'
});
assert.equal(compiled.ok, true);
const mission = compiled.package.mission;
assert.equal(mission.project_context.schema, 'aurentara.project-mission-context.v1');
assert.equal(mission.project_context_binding.schema, 'aurentara.project-knowledge-snapshot-ref.v1');
assert.equal(mission.project_context_binding.immutable_for_mission, true);
assert.equal(mission.scope_key, 'repair-customer:repair-project');
assert.equal(compiled.package.safeguards.project_context_bound_to_mission, true);

projectContext.verified_content['business.name'] = 'MUTATED AFTER COMPILE';
assert.equal(mission.project_context.verified_content['business.name'], 'Repair Fixture');

const contracts = mission.tasks.map((task) => buildTaskExecutionContract(mission, task.task_id));
assert.equal(contracts.every((contract) => contract.ok), true);
assert.equal(contracts.every((contract) => contract.contract_version === 4), true);
assert.equal(new Set(contracts.map((contract) => contract.project_scope_key)).size, 1);
assert.equal(new Set(contracts.map((contract) => contract.knowledge_revision)).size, 1);
assert.equal(new Set(contracts.map((contract) => contract.content_pack_ref.pack_id)).size, 1);
assert.equal(new Set(contracts.map((contract) => contract.visual_pack_ref.pack_id)).size, 1);
assert.equal(new Set(contracts.map((contract) => contract.readiness_ref.readiness_id)).size, 1);
assert.equal(contracts.every((contract) => contract.fact_version_refs.some((ref) => ref.fact_id === 'fact-name' && ref.version === 4)), true);
assert.equal(contracts.every((contract) => contract.source_refs.includes('source-owned')), true);
assert.equal(contracts.every((contract) => contract.rights_constraints.reference_content_copy_forbidden === true), true);
assert.equal(contracts.every((contract) => contract.human_decision_refs[0].question_id === 'question-1'), true);
assert.equal(contracts.every((contract) => contract.approved_assets[0].asset_id === 'asset-logo'), true);
assert.equal(contracts.every((contract) => contract.open_critical_conflicts.length === 0), true);
assert.equal(contracts.every((contract) => contract.project_knowledge.knowledge_revision === 7), true);
assert.equal(contracts.every((contract) => contract.safeguards.project_knowledge_fail_closed === true), true);

for (const contract of contracts) {
  const envelope = buildAdapterDispatchEnvelope({ ...contract, state: 'READY' });
  assert.equal(envelope.ok, true);
  assert.equal(envelope.envelope_version, 2);
  assert.equal(envelope.project_scope_key, 'repair-customer:repair-project');
  assert.equal(envelope.knowledge_revision, 7);
  assert.equal(envelope.knowledge_snapshot_ref.content_pack_ref.pack_id, 'content-pack-7');
  assert.equal(envelope.project_knowledge.source_refs.includes('source-owned'), true);
  assert.equal(envelope.approved_assets[0].rights_status, 'OWNED_CONFIRMED');
  assert.equal(envelope.execution.production_deploy, false);
}

const blocked = compileMissionPackage({
  prompt: 'Baue eine Website.',
  project_context: context({ readiness_ref: { readiness_id: 'blocked', status: 'BLOCKED', knowledge_revision: 7 } }),
  customer_id: 'repair-customer',
  project_id: 'repair-project',
  scope_key: 'repair-customer:repair-project'
});
assert.equal(blocked.ok, false);
assert.equal(blocked.error, 'PROJECT_CONTENT_READINESS_BLOCKED');

const stalePack = compileMissionPackage({
  prompt: 'Baue eine Website.',
  project_context: context({ content_pack_ref: { pack_id: 'old', version: 1, knowledge_revision: 6 } }),
  customer_id: 'repair-customer',
  project_id: 'repair-project',
  scope_key: 'repair-customer:repair-project'
});
assert.equal(stalePack.ok, false);
assert.equal(stalePack.error, 'PROJECT_MISSION_CONTEXT_STALE_PACK_OR_READINESS');

const crossScope = compileMissionPackage({
  prompt: 'Baue eine Website.',
  project_context: context(),
  customer_id: 'other-customer',
  project_id: 'repair-project',
  scope_key: 'other-customer:repair-project'
});
assert.equal(crossScope.ok, false);
assert.equal(crossScope.error, 'PROJECT_MISSION_CONTEXT_SCOPE_MISMATCH');

const conflict = compileMissionPackage({
  prompt: 'Baue eine Website.',
  project_context: context({ open_critical_conflicts: [{ fact_id: 'fact-price', field_path: 'business.pricing', version: 3, source_refs: ['source-owned'] }] }),
  customer_id: 'repair-customer',
  project_id: 'repair-project',
  scope_key: 'repair-customer:repair-project'
});
assert.equal(conflict.ok, false);
assert.equal(conflict.error, 'PROJECT_CRITICAL_CONFLICT_UNRESOLVED');

const badRightsContext = context();
badRightsContext.approved_assets = [{ asset_id: 'asset-bad', rights_status: 'PUBLIC_REFERENCE_ONLY', publishable: true }];
badRightsContext.assets = structuredClone(badRightsContext.approved_assets);
const badRights = compileMissionPackage({
  prompt: 'Baue eine Website.',
  project_context: badRightsContext,
  customer_id: 'repair-customer',
  project_id: 'repair-project',
  scope_key: 'repair-customer:repair-project'
});
assert.equal(badRights.ok, false);
assert.equal(badRights.error, 'PROJECT_APPROVED_ASSET_RIGHTS_INVALID');

const tamperedMission = structuredClone(mission);
tamperedMission.project_context.knowledge_revision = 8;
const tamperedContract = buildTaskExecutionContract(tamperedMission, tamperedMission.tasks[0].task_id);
assert.equal(tamperedContract.ok, false);
assert.equal(tamperedContract.error, 'PROJECT_KNOWLEDGE_BINDING_STALE');

const rightsTamperedMission = structuredClone(mission);
rightsTamperedMission.project_context.approved_assets[0].rights_status = 'PUBLIC_REFERENCE_ONLY';
rightsTamperedMission.project_context.assets[0].rights_status = 'PUBLIC_REFERENCE_ONLY';
const rightsTamperedContract = buildTaskExecutionContract(rightsTamperedMission, rightsTamperedMission.tasks[0].task_id);
assert.equal(rightsTamperedContract.ok, false);
assert.equal(rightsTamperedContract.error, 'PROJECT_APPROVED_ASSET_RIGHTS_INVALID');

const legacy = compileMissionPackage({ prompt: 'Baue eine Website.', project: 'legacy-test-harness' });
assert.equal(legacy.ok, true);
const legacyContract = buildTaskExecutionContract(legacy.package.mission, legacy.package.mission.tasks[0].task_id);
assert.equal(legacyContract.ok, true);
assert.equal(legacyContract.knowledge_snapshot_ref, null);
assert.equal(legacyContract.safeguards.project_knowledge_fail_closed, false);

console.log('PROJECT REPAIR Wave 2 project knowledge binding: OK');
