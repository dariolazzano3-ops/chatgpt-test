import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  J10_REVISION_DOMAINS,
  J10_ROLLBACK_DOMAINS,
  J10_IMPACT_ACTIONS,
  createJ10RevisionLedger,
  verifyJ10RevisionLedger,
  createJ10Revision,
  diffJ10Revisions,
  analyzeJ10ChangeImpact,
  createJ10RegressionPlan,
  createJ10RollbackPlan,
  runJ10Rollback,
  j10VersioningDiffRollbackManifest
} from '../src/web-factory/versioning-diff-rollback-v1.js';

function stable(v) {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, stable(v[k])]));
  return v;
}

function sha256(v) {
  return createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');
}

function append(ledger, input) {
  const result = createJ10Revision(ledger, input);
  assert.equal(result.ok, true, result.status);
  assert.equal(result.integrity.status, 'PASS');
  return result;
}

const manifest = j10VersioningDiffRollbackManifest();
assert.deepEqual(manifest.revision_domains, ['KNOWLEDGE','REFERENCE','BUILD','PREVIEW','DELIVERY']);
assert.deepEqual(manifest.rollback_domains, ['BUILD','PREVIEW','DELIVERY']);
assert.deepEqual(manifest.impact_actions, ['NO_REBUILD','PARTIAL_REBUILD','FULL_REBUILD','REFERENCE_REVIEW_REQUIRED']);
assert.equal(manifest.duplicate_versioning_engine_created, false);
assert.ok(manifest.lifecycle_governance_reused.includes('createBuildVersion'));
assert.ok(manifest.lifecycle_governance_reused.includes('createRollbackContract'));
assert.equal(manifest.rollback_restores_previous_artifact_without_rebuild, true);
assert.equal(manifest.rollback_rebuild_allowed, false);
assert.equal(manifest.automatic_production_switch, false);
assert.equal(manifest.production_deploy, false);

let created = createJ10RevisionLedger({
  project_scope: 'customer:j10:synthetic',
  created_at: '2026-09-07T10:55:00.000Z'
});
assert.equal(created.ok, true);
let ledger = created.ledger;

const knowledge1 = append(ledger, {
  revision_id: 'knowledge-1',
  domain: 'KNOWLEDGE',
  version: '1.0.0',
  change_reason: 'Initial approved project knowledge',
  created_at: '2026-09-07T10:56:00.000Z',
  source_revision: 'source-a',
  acceptance_status: 'ACCEPTED',
  snapshot: { business_name: 'J10 Fixture', phone: '+49 111', offers: ['A'] }
});
ledger = knowledge1.ledger;

const reference1 = append(ledger, {
  revision_id: 'reference-1',
  domain: 'REFERENCE',
  version: '1.0.0',
  change_reason: 'Initial approved desktop and mobile reference set',
  created_at: '2026-09-07T10:57:00.000Z',
  source_revision: 'ref-a',
  acceptance_status: 'ACCEPTED',
  snapshot: { reference_set: ['desktop-a', 'mobile-a'], state: 'APPROVED' }
});
ledger = reference1.ledger;

const buildArtifact1 = {
  build_id: 'build-1',
  files: {
    'index.html': '<h1>Version 1</h1>',
    'assets/styles.css': 'body{background:#fff}'
  }
};
const build1 = append(ledger, {
  revision_id: 'build-1',
  domain: 'BUILD',
  version: '1.0.0',
  change_reason: 'First known-good build',
  created_at: '2026-09-07T10:58:00.000Z',
  source_revision: 'commit-build-1',
  acceptance_status: 'KNOWN_GOOD',
  artifact_ref: 'artifact://build/1',
  artifact_payload: buildArtifact1,
  snapshot: { build_id: 'build-1', file_count: 2, qa: 'PASS' }
});
ledger = build1.ledger;
assert.equal(build1.revision.lifecycle_version.schema, 'riosystems.web-build-version.v2');
assert.equal(build1.revision.lifecycle_version.production, false);

const previewArtifact1 = { preview_id: 'preview-1', build_id: 'build-1', url_ref: 'preview://j10/1' };
const preview1 = append(ledger, {
  revision_id: 'preview-1',
  domain: 'PREVIEW',
  version: '1.0.0',
  change_reason: 'Known-good preview',
  created_at: '2026-09-07T10:59:00.000Z',
  source_revision: 'commit-build-1',
  acceptance_status: 'KNOWN_GOOD',
  artifact_ref: 'artifact://preview/1',
  artifact_payload: previewArtifact1,
  snapshot: { preview_id: 'preview-1', qa: 'PASS' }
});
ledger = preview1.ledger;

const deliveryArtifact1 = { delivery_id: 'delivery-1', build_id: 'build-1', state: 'ACCEPTED' };
const delivery1 = append(ledger, {
  revision_id: 'delivery-1',
  domain: 'DELIVERY',
  version: '1.0.0',
  change_reason: 'Known-good delivery package',
  created_at: '2026-09-07T11:00:00.000Z',
  source_revision: 'commit-build-1',
  acceptance_status: 'KNOWN_GOOD',
  artifact_ref: 'artifact://delivery/1',
  artifact_payload: deliveryArtifact1,
  snapshot: { delivery_id: 'delivery-1', build_id: 'build-1', status: 'PASS' }
});
ledger = delivery1.ledger;

const knowledge2 = append(ledger, {
  revision_id: 'knowledge-2',
  domain: 'KNOWLEDGE',
  version: '1.1.0',
  change_reason: 'Confirmed phone changed',
  created_at: '2026-09-07T11:01:00.000Z',
  source_revision: 'source-b',
  acceptance_status: 'ACCEPTED',
  snapshot: { business_name: 'J10 Fixture', phone: '+49 222', offers: ['A'] }
});
ledger = knowledge2.ledger;

const buildArtifact2 = {
  build_id: 'build-2',
  files: {
    'index.html': '<h1>Version 2 broken candidate</h1>',
    'assets/styles.css': 'body{background:#eee}'
  }
};
const build2 = append(ledger, {
  revision_id: 'build-2',
  domain: 'BUILD',
  version: '1.1.0',
  change_reason: 'Candidate build after content change',
  created_at: '2026-09-07T11:02:00.000Z',
  source_revision: 'commit-build-2',
  acceptance_status: 'PENDING',
  artifact_ref: 'artifact://build/2',
  artifact_payload: buildArtifact2,
  snapshot: { build_id: 'build-2', file_count: 2, qa: 'FAIL' }
});
ledger = build2.ledger;

assert.equal(verifyJ10RevisionLedger(ledger).status, 'PASS');
assert.equal(ledger.revision_count, 7);
assert.deepEqual(J10_REVISION_DOMAINS, ['KNOWLEDGE','REFERENCE','BUILD','PREVIEW','DELIVERY']);
assert.deepEqual(J10_ROLLBACK_DOMAINS, ['BUILD','PREVIEW','DELIVERY']);
assert.deepEqual(J10_IMPACT_ACTIONS, ['NO_REBUILD','PARTIAL_REBUILD','FULL_REBUILD','REFERENCE_REVIEW_REQUIRED']);

const duplicate = createJ10Revision(ledger, {
  revision_id: 'build-2',
  domain: 'BUILD',
  version: '1.2.0',
  change_reason: 'Must not mutate historical record',
  snapshot: { build_id: 'illegal' }
});
assert.equal(duplicate.ok, false);
assert.equal(duplicate.status, 'J10_REVISION_ID_IMMUTABLE_DUPLICATE');

const nonAdvancing = createJ10Revision(ledger, {
  revision_id: 'build-old-version',
  domain: 'BUILD',
  version: '1.0.0',
  change_reason: 'Old semantic version must fail',
  snapshot: { build_id: 'old' }
});
assert.equal(nonAdvancing.ok, false);
assert.equal(nonAdvancing.status, 'J10_REVISION_VERSION_MUST_ADVANCE');

const tampered = structuredClone(ledger);
tampered.revisions[0].snapshot.phone = '+49 999';
const tamperCheck = verifyJ10RevisionLedger(tampered);
assert.equal(tamperCheck.status, 'FAIL');
assert.ok(tamperCheck.blocking_issues.some((x) => x.code === 'J10_REVISION_IMMUTABILITY_HASH_MISMATCH'));
assert.ok(tamperCheck.blocking_issues.some((x) => x.code === 'J10_REVISION_PAYLOAD_HASH_MISMATCH'));

const knowledgeDiff = diffJ10Revisions(knowledge1.revision, knowledge2.revision);
assert.equal(knowledgeDiff.ok, true);
assert.equal(knowledgeDiff.diff.changed, true);
assert.ok(knowledgeDiff.diff.changes.some((change) => change.path === 'phone'));
assert.equal(knowledgeDiff.diff.deterministic, true);

const buildDiff = diffJ10Revisions(build1.revision, build2.revision);
assert.equal(buildDiff.ok, true);
assert.equal(buildDiff.diff.changed, true);
assert.ok(buildDiff.diff.change_count >= 2);

const model = {
  pages: [
    { page_id: 'home', components: ['hero', 'cta'], sections: [{ component: 'hero' }, { component: 'cta' }] },
    { page_id: 'contact', components: ['form'], sections: [{ component: 'form' }] }
  ],
  components: ['hero','cta','form']
};

const noRebuild = analyzeJ10ChangeImpact({ domain: 'DELIVERY', type: 'metadata', target: 'label' }, model);
assert.equal(noRebuild.impact.action, 'NO_REBUILD');

const knowledgeReview = analyzeJ10ChangeImpact({ domain: 'KNOWLEDGE', type: 'fact', target: 'phone' }, model);
assert.equal(knowledgeReview.impact.action, 'REFERENCE_REVIEW_REQUIRED');

const referenceCandidate = analyzeJ10ChangeImpact({ domain: 'REFERENCE', type: 'reference', target: 'mobile', reference_state: 'CANDIDATE' }, model);
assert.equal(referenceCandidate.impact.action, 'REFERENCE_REVIEW_REQUIRED');

const referenceApproved = analyzeJ10ChangeImpact({ domain: 'REFERENCE', type: 'reference', target: 'mobile', reference_state: 'APPROVED' }, model);
assert.equal(referenceApproved.impact.action, 'FULL_REBUILD');

const partial = analyzeJ10ChangeImpact({ domain: 'BUILD', type: 'content', target: 'home' }, model);
assert.equal(partial.impact.action, 'PARTIAL_REBUILD');
assert.deepEqual(partial.impact.affected_pages, ['home']);

const fullDesign = analyzeJ10ChangeImpact({ domain: 'BUILD', type: 'design_token', target: 'spacing' }, model);
assert.equal(fullDesign.impact.action, 'FULL_REBUILD');
assert.equal(fullDesign.impact.blast_radius.affected_page_count, 2);

const crossFactory = analyzeJ10ChangeImpact({ domain: 'BUILD', type: 'form_schema', target: 'contact' }, model);
assert.equal(crossFactory.impact.action, 'FULL_REBUILD');
assert.equal(crossFactory.impact.blast_radius.severity, 'CROSS_FACTORY');
assert.ok(crossFactory.impact.cross_factory_dependencies.includes('business-factory'));

const regression = createJ10RegressionPlan(
  { build_id: 'build-1', content_version: '1.0.0', golden_snapshots: ['golden:1'] },
  { build_id: 'build-2', content_version: '1.1.0' },
  { domain: 'BUILD', type: 'content', target: 'home' },
  model
);
assert.equal(regression.ok, true);
assert.equal(regression.regression_plan.existing_regression_contracts.schema, 'riosystems.web-regression-suite.v2');
assert.equal(regression.regression_plan.visual_regression_must_use_existing_foundry, true);
assert.equal(regression.regression_plan.browser_acceptance_must_use_j9, true);
assert.equal(regression.regression_plan.reference_closure_must_use_j8_when_required, true);

const rollbackPlan = createJ10RollbackPlan(ledger, {
  current_revision_id: 'build-2',
  rollback_reason: 'Candidate failed acceptance'
});
assert.equal(rollbackPlan.ok, true);
assert.equal(rollbackPlan.plan.target_revision_id, 'build-1');
assert.equal(rollbackPlan.plan.previous_known_good_version, '1.0.0');
assert.equal(rollbackPlan.plan.previous_known_good_artifact_ref, 'artifact://build/1');
assert.equal(rollbackPlan.plan.rebuild_required, false);
assert.equal(rollbackPlan.plan.rebuild_allowed_during_rollback, false);
assert.equal(rollbackPlan.plan.existing_lifecycle_rollback_contract.schema, 'riosystems.safe-rollback-contract.v2');
assert.equal(rollbackPlan.plan.existing_lifecycle_rollback_contract.automatic_production_switch, false);

const artifactStore = new Map([
  ['artifact://build/1', buildArtifact1],
  ['artifact://build/2', buildArtifact2]
]);
let rebuildCalls = 0;
const rollback = await runJ10Rollback(ledger, {
  current_revision_id: 'build-2',
  rollback_reason: 'Acceptance failure'
}, {
  async restore_artifact({ artifact_ref, rebuild_required }) {
    assert.equal(rebuild_required, false);
    return structuredClone(artifactStore.get(artifact_ref));
  },
  async hash_artifact({ artifact }) {
    return { sha256: sha256(artifact) };
  },
  async validate_rollback({ plan, restored_artifact, artifact_hash }) {
    assert.equal(plan.restore_mode, 'ARTIFACT_POINTER_RESTORE');
    assert.equal(plan.rebuild_required, false);
    assert.equal(restored_artifact.build_id, 'build-1');
    assert.equal(artifact_hash, sha256(buildArtifact1));
    return { status: 'PASS', browser_qa: 'PASS', regression_qa: 'PASS', production: false };
  },
  async rebuild() {
    rebuildCalls += 1;
    return { status: 'ILLEGAL' };
  }
});
assert.equal(rollback.ok, true);
assert.equal(rollback.status, 'J10_ROLLBACK_PASS');
assert.equal(rollback.rollback.rebuild_invoked, false);
assert.equal(rebuildCalls, 0);
assert.equal(rollback.rollback.restored_artifact_ref, 'artifact://build/1');
assert.equal(rollback.rollback.restored_artifact_hash, sha256(buildArtifact1));
assert.equal(rollback.rollback.new_revision_record_required, true);
assert.equal(rollback.rollback.automatic_acceptance, false);
assert.equal(rollback.rollback.production_switch_performed, false);

const tamperedRollback = await runJ10Rollback(ledger, {
  current_revision_id: 'build-2'
}, {
  async restore_artifact() {
    return { build_id: 'tampered', files: {} };
  },
  async hash_artifact({ artifact }) {
    return { sha256: sha256(artifact) };
  },
  async validate_rollback() {
    return { status: 'PASS' };
  }
});
assert.equal(tamperedRollback.ok, false);
assert.equal(tamperedRollback.status, 'J10_ROLLBACK_ARTIFACT_HASH_MISMATCH');
assert.equal(tamperedRollback.rebuild_invoked, false);

let emptyLedger = createJ10RevisionLedger({ project_scope: 'customer:j10:no-known-good', created_at: '2026-09-07T11:03:00.000Z' }).ledger;
const failedOnly = append(emptyLedger, {
  revision_id: 'build-failed-only',
  domain: 'BUILD',
  version: '1.0.0',
  change_reason: 'No previous accepted artifact exists',
  created_at: '2026-09-07T11:04:00.000Z',
  source_revision: 'failed',
  acceptance_status: 'PENDING',
  artifact_ref: 'artifact://build/failed',
  artifact_payload: { build_id: 'failed' },
  snapshot: { build_id: 'failed', qa: 'FAIL' }
});
emptyLedger = failedOnly.ledger;
const noKnownGood = createJ10RollbackPlan(emptyLedger, { current_revision_id: 'build-failed-only' });
assert.equal(noKnownGood.ok, false);
assert.equal(noKnownGood.status, 'J10_PREVIOUS_ACCEPTED_ARTIFACT_REQUIRED');

const unsupportedDomainRollback = createJ10RollbackPlan(ledger, { current_revision_id: 'knowledge-2' });
assert.equal(unsupportedDomainRollback.ok, false);
assert.equal(unsupportedDomainRollback.status, 'J10_ROLLBACK_DOMAIN_UNSUPPORTED');

console.log(JSON.stringify({
  ok: true,
  suite: 'webfactory-100-j10-versioning-diff-rollback',
  revision_domains: J10_REVISION_DOMAINS,
  revision_count: ledger.revision_count,
  ledger_integrity: 'PASS',
  historical_revision_immutability: 'PASS',
  deterministic_diff: 'PASS',
  impact_actions: {
    no_rebuild: noRebuild.impact.action,
    partial_rebuild: partial.impact.action,
    full_rebuild: fullDesign.impact.action,
    reference_review: knowledgeReview.impact.action
  },
  lifecycle_governance_reuse: 'PASS',
  rollback_previous_accepted_artifact: 'PASS',
  rollback_without_rebuild: rollback.rollback.rebuild_invoked === false ? 'PASS' : 'FAIL',
  tampered_restore_rejected: 'PASS',
  no_known_good_blocks: 'PASS',
  production_deploy: false,
  public_launch: false,
  dns_change: false,
  billing_activation: false,
  external_writes: false
}, null, 2));
