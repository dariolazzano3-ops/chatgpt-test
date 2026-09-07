import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  createJ10RevisionLedger,
  createJ10Revision,
  verifyJ10RevisionLedger,
  diffJ10Revisions,
  analyzeJ10ChangeImpact,
  createJ10RollbackPlan,
  runJ10Rollback
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
  return result;
}

const projectRoot = new URL('../projects/gelato-donatello-website-v1/', import.meta.url);
const dogfood = JSON.parse(await readFile(new URL('project-jaguar-dogfood-v1.json', projectRoot), 'utf8'));
const reassessment = JSON.parse(await readFile(new URL('premium-reassessment-v1.json', projectRoot), 'utf8'));
const indexHtml = await readFile(new URL('index.html', projectRoot), 'utf8');
const stylesCss = await readFile(new URL('styles.css', projectRoot), 'utf8');
const headers = await readFile(new URL('_headers', projectRoot), 'utf8');
const notFound = await readFile(new URL('404.html', projectRoot), 'utf8');

assert.equal(dogfood.safety.production_deploy, false);
assert.equal(dogfood.safety.public_launch, false);
assert.equal(dogfood.safety.dns_changes, false);
assert.equal(dogfood.safety.billing, false);
assert.equal(dogfood.safety.paid_provider_calls, 0);
assert.equal(dogfood.safety.external_writes, false);
assert.equal(reassessment.candidate_technical_evidence.prelaunch_lab_status, 'PASS');
assert.equal(reassessment.candidate_technical_evidence.horizontal_overflow_px, 0);
assert.equal(reassessment.candidate_technical_evidence.true_404, 'PASS');
assert.deepEqual(reassessment.hard_failures, []);

let ledger = createJ10RevisionLedger({
  project_scope: dogfood.project_ref.scope_key,
  created_at: '2026-09-07T11:10:00.000Z'
}).ledger;

const knowledge = append(ledger, {
  revision_id: 'gelato-knowledge-1',
  domain: 'KNOWLEDGE',
  version: '1.0.0',
  change_reason: 'Current confirmed Gelato project facts',
  created_at: '2026-09-07T11:11:00.000Z',
  source_revision: dogfood.source_contract.authoritative_confirmed_input,
  acceptance_status: 'ACCEPTED',
  snapshot: {
    confirmed_facts: dogfood.confirmed_facts,
    forbidden_unverified_render_values: dogfood.forbidden_unverified_render_values,
    primary_goal: dogfood.mission.primary_goal
  }
});
ledger = knowledge.ledger;

const reference = append(ledger, {
  revision_id: 'gelato-reference-state-1',
  domain: 'REFERENCE',
  version: '1.0.0',
  change_reason: 'Current design-intent state; no Approved Reference claimed by this dogfood file',
  created_at: '2026-09-07T11:12:00.000Z',
  source_revision: 'project-jaguar-dogfood-v1',
  acceptance_status: 'PENDING',
  snapshot: {
    operator_design_intent: dogfood.mission.operator_design_intent,
    approved_reference_claimed: false,
    live_site_is_automatic_design_reference: dogfood.source_contract.live_site_is_automatic_design_reference
  }
});
ledger = reference.ledger;

const knownGoodBuildArtifact = {
  project: dogfood.project_ref,
  files: {
    'index.html': indexHtml,
    'styles.css': stylesCss,
    '_headers': headers,
    '404.html': notFound
  }
};
const knownGoodBuild = append(ledger, {
  revision_id: 'gelato-build-technical-known-good-1',
  domain: 'BUILD',
  version: '1.0.0',
  change_reason: 'Repository Gelato build with evidence-backed technical prelaunch PASS',
  created_at: '2026-09-07T11:13:00.000Z',
  source_revision: reassessment.evidence_run.head_sha,
  acceptance_status: 'KNOWN_GOOD',
  artifact_ref: 'repo://projects/gelato-donatello-website-v1@technical-known-good-1',
  artifact_payload: knownGoodBuildArtifact,
  snapshot: {
    evidence_run: reassessment.evidence_run,
    technical_evidence: reassessment.candidate_technical_evidence,
    hard_failures: reassessment.hard_failures,
    premium_delivery_ready: reassessment.premium_delivery_ready,
    public_launch_ready: reassessment.public_launch_ready
  }
});
ledger = knownGoodBuild.ledger;

const previewArtifact = {
  project: dogfood.project_ref,
  build_revision_id: knownGoodBuild.revision.revision_id,
  preview_kind: 'PRIVATE_REPOSITORY_PREVIEW',
  production: false
};
const preview = append(ledger, {
  revision_id: 'gelato-preview-technical-known-good-1',
  domain: 'PREVIEW',
  version: '1.0.0',
  change_reason: 'Technical private preview evidence',
  created_at: '2026-09-07T11:14:00.000Z',
  source_revision: reassessment.evidence_run.head_sha,
  acceptance_status: 'KNOWN_GOOD',
  artifact_ref: 'repo-preview://gelato-donatello-website-v1/technical-known-good-1',
  artifact_payload: previewArtifact,
  snapshot: {
    horizontal_overflow_px: reassessment.candidate_technical_evidence.horizontal_overflow_px,
    true_404: reassessment.candidate_technical_evidence.true_404,
    prelaunch_lab_status: reassessment.candidate_technical_evidence.prelaunch_lab_status,
    production: false
  }
});
ledger = preview.ledger;

const deliveryArtifact = {
  project: dogfood.project_ref,
  delivery_state: 'NOT_PREMIUM_DELIVERY_READY',
  public_launch_ready: false,
  production: false
};
const delivery = append(ledger, {
  revision_id: 'gelato-delivery-state-1',
  domain: 'DELIVERY',
  version: '1.0.0',
  change_reason: 'Evidence-backed delivery state snapshot',
  created_at: '2026-09-07T11:15:00.000Z',
  source_revision: reassessment.evidence_run.head_sha,
  acceptance_status: 'KNOWN_GOOD',
  artifact_ref: 'repo-delivery://gelato-donatello-website-v1/state-1',
  artifact_payload: deliveryArtifact,
  snapshot: {
    score: reassessment.final_evidence_backed_score,
    customer_review_ready: reassessment.customer_review_ready,
    premium_delivery_ready: reassessment.premium_delivery_ready,
    public_launch_ready: reassessment.public_launch_ready,
    not_verified_hard_gates: reassessment.not_verified_hard_gates,
    production_deploy: false
  }
});
ledger = delivery.ledger;

const candidateArtifact = structuredClone(knownGoodBuildArtifact);
candidateArtifact.files['index.html'] = candidateArtifact.files['index.html'].replace('</body>', '<div data-j10-candidate="broken">candidate change</div></body>');
const candidate = append(ledger, {
  revision_id: 'gelato-build-candidate-2',
  domain: 'BUILD',
  version: '1.1.0',
  change_reason: 'In-memory J10 candidate used only to exercise version/diff/rollback policy',
  created_at: '2026-09-07T11:16:00.000Z',
  source_revision: 'j10-dogfood-candidate',
  acceptance_status: 'PENDING',
  artifact_ref: 'memory://gelato-build-candidate-2',
  artifact_payload: candidateArtifact,
  snapshot: {
    candidate_only: true,
    qa: 'FAIL',
    production: false,
    public: false,
    changed_file: 'index.html'
  }
});
ledger = candidate.ledger;

assert.equal(verifyJ10RevisionLedger(ledger).status, 'PASS');
assert.equal(ledger.revision_count, 6);

const diff = diffJ10Revisions(knownGoodBuild.revision, candidate.revision);
assert.equal(diff.ok, true);
assert.equal(diff.diff.changed, true);
assert.ok(diff.diff.changes.some((change) => change.path === 'candidate_only' || change.path === 'changed_file'));

const knowledgeImpact = analyzeJ10ChangeImpact({
  domain: 'KNOWLEDGE',
  type: 'fact',
  target: 'confirmed_facts'
}, {
  pages: [
    { page_id: 'home', components: ['hero','offer-grid'], sections: [{ component: 'hero' }, { component: 'offer-grid' }] },
    { page_id: 'menu', components: ['menu-grid'], sections: [{ component: 'menu-grid' }] }
  ]
});
assert.equal(knowledgeImpact.impact.action, 'REFERENCE_REVIEW_REQUIRED');

const contentImpact = analyzeJ10ChangeImpact({
  domain: 'BUILD',
  type: 'content',
  target: 'menu'
}, {
  pages: [
    { page_id: 'home', components: ['hero'], sections: [{ component: 'hero' }] },
    { page_id: 'menu', components: ['menu-grid'], sections: [{ component: 'menu-grid' }] }
  ]
});
assert.equal(contentImpact.impact.action, 'PARTIAL_REBUILD');
assert.deepEqual(contentImpact.impact.affected_pages, ['menu']);

const rollbackPlan = createJ10RollbackPlan(ledger, {
  current_revision_id: candidate.revision.revision_id,
  rollback_reason: 'Dogfood candidate intentionally not accepted'
});
assert.equal(rollbackPlan.ok, true);
assert.equal(rollbackPlan.plan.target_revision_id, knownGoodBuild.revision.revision_id);
assert.equal(rollbackPlan.plan.previous_known_good_artifact_ref, knownGoodBuild.revision.artifact_ref);
assert.equal(rollbackPlan.plan.rebuild_required, false);

let rebuildCalls = 0;
const rollback = await runJ10Rollback(ledger, {
  current_revision_id: candidate.revision.revision_id,
  rollback_reason: 'Dogfood candidate intentionally not accepted'
}, {
  async restore_artifact({ artifact_ref, rebuild_required }) {
    assert.equal(artifact_ref, knownGoodBuild.revision.artifact_ref);
    assert.equal(rebuild_required, false);
    return structuredClone(knownGoodBuildArtifact);
  },
  async hash_artifact({ artifact }) {
    return { sha256: sha256(artifact) };
  },
  async validate_rollback({ restored_artifact, plan }) {
    assert.equal(plan.rebuild_required, false);
    assert.equal(restored_artifact.files['index.html'], indexHtml);
    assert.equal(restored_artifact.files['styles.css'], stylesCss);
    return {
      status: 'PASS',
      exact_known_good_artifact_restored: true,
      production_deploy: false,
      public_launch: false
    };
  },
  async rebuild() {
    rebuildCalls += 1;
    return { status: 'ILLEGAL' };
  }
});
assert.equal(rollback.ok, true);
assert.equal(rollback.rollback.rebuild_invoked, false);
assert.equal(rebuildCalls, 0);
assert.equal(rollback.rollback.restored_artifact_hash, knownGoodBuild.revision.artifact_hash);
assert.equal(rollback.rollback.validation.exact_known_good_artifact_restored, true);
assert.equal(rollback.rollback.production_switch_performed, false);

console.log(JSON.stringify({
  ok: true,
  suite: 'webfactory-100-j10-gelato-donatello-dogfood',
  project_scope: dogfood.project_ref.scope_key,
  real_project_repository_evidence: true,
  external_writes: false,
  production_deploy: false,
  public_launch: false,
  dns_changes: false,
  billing: false,
  paid_provider_calls: 0,
  revision_domains_covered: ['KNOWLEDGE','REFERENCE','BUILD','PREVIEW','DELIVERY'],
  ledger_integrity: 'PASS',
  knowledge_change_action: knowledgeImpact.impact.action,
  bounded_content_change_action: contentImpact.impact.action,
  rollback_target: rollbackPlan.plan.target_revision_id,
  rollback_restore_mode: rollback.rollback.restore_mode,
  rollback_without_rebuild: rebuildCalls === 0 ? 'PASS' : 'FAIL',
  restored_hash_verified: rollback.rollback.restored_artifact_hash === knownGoodBuild.revision.artifact_hash ? 'PASS' : 'FAIL',
  premium_delivery_ready_claimed: reassessment.premium_delivery_ready,
  public_launch_ready_claimed: reassessment.public_launch_ready
}, null, 2));
