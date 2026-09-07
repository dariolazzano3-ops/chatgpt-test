import { createHash } from 'node:crypto';
import {
  createWebsiteVersion,
  createBuildVersion,
  analyzeChangeImpact,
  calculateBlastRadius,
  createRegressionContracts,
  createRollbackContract
} from './lifecycle-governance-v2.js';

export const J10_REVISION_DOMAINS = Object.freeze([
  'KNOWLEDGE',
  'REFERENCE',
  'BUILD',
  'PREVIEW',
  'DELIVERY'
]);

export const J10_ROLLBACK_DOMAINS = Object.freeze([
  'BUILD',
  'PREVIEW',
  'DELIVERY'
]);

export const J10_IMPACT_ACTIONS = Object.freeze([
  'NO_REBUILD',
  'PARTIAL_REBUILD',
  'FULL_REBUILD',
  'REFERENCE_REVIEW_REQUIRED'
]);

export const J10_ACCEPTED_ARTIFACT_STATES = Object.freeze([
  'ACCEPTED',
  'KNOWN_GOOD'
]);

const arr = (v) => Array.isArray(v) ? v : [];
const clean = (v, max = 1000) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const clone = (v) => v == null ? v : structuredClone(v);

function stable(v) {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.keys(v).sort().map((key) => [key, stable(v[key])]));
  }
  return v;
}

function sha256(v) {
  return createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');
}

function domain(v) {
  const value = clean(v, 80).toUpperCase();
  return J10_REVISION_DOMAINS.includes(value) ? value : null;
}

function acceptedState(v) {
  return J10_ACCEPTED_ARTIFACT_STATES.includes(clean(v, 80).toUpperCase());
}

function versionTuple(v) {
  const raw = clean(v, 80);
  const match = raw.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;
  return match.slice(1).map(Number);
}

function compareVersions(a, b) {
  const x = versionTuple(a);
  const y = versionTuple(b);
  if (!x || !y) return null;
  for (let i = 0; i < 3; i += 1) {
    if (x[i] !== y[i]) return x[i] - y[i];
  }
  return 0;
}

function recordHashPayload(record = {}) {
  const copy = clone(record);
  delete copy.record_hash;
  return copy;
}

function fail(status, extra = {}) {
  return {
    ok: false,
    status,
    ...extra,
    production_deploy: false,
    public_launch: false,
    dns_change: false,
    billing_activation: false,
    automatic_paid_activation: false,
    external_writes: false,
    variable_cost_eur: 0
  };
}

function pass(status, extra = {}) {
  return {
    ok: true,
    status,
    ...extra,
    production_deploy: false,
    public_launch: false,
    dns_change: false,
    billing_activation: false,
    automatic_paid_activation: false,
    external_writes: false,
    variable_cost_eur: 0
  };
}

export function createJ10RevisionLedger(input = {}) {
  const projectScope = clean(input.project_scope || input.scope_key || input.project_id, 320);
  if (!projectScope) return fail('J10_PROJECT_SCOPE_REQUIRED');
  const ledger = {
    schema: 'riosystems.j10-revision-ledger.v1',
    project_scope: projectScope,
    created_at: clean(input.created_at || input.now || new Date().toISOString(), 100),
    revision_count: 0,
    head_revision_id: null,
    head_record_hash: null,
    revisions: [],
    domains: [...J10_REVISION_DOMAINS],
    historical_revisions_immutable: true,
    append_only: true,
    production_deploy: false
  };
  return pass('J10_REVISION_LEDGER_READY', { ledger });
}

export function verifyJ10RevisionLedger(input = {}) {
  const ledger = clone(input);
  const issues = [];
  if (ledger?.schema !== 'riosystems.j10-revision-ledger.v1') {
    issues.push({ code: 'J10_LEDGER_SCHEMA_INVALID', severity: 'BLOCK' });
  }
  if (!clean(ledger?.project_scope, 320)) {
    issues.push({ code: 'J10_LEDGER_PROJECT_SCOPE_REQUIRED', severity: 'BLOCK' });
  }

  const revisions = arr(ledger?.revisions);
  const ids = new Set();
  let previousHash = null;
  for (let index = 0; index < revisions.length; index += 1) {
    const record = revisions[index];
    if (!record || record.schema !== 'riosystems.j10-revision-record.v1') {
      issues.push({ code: 'J10_REVISION_SCHEMA_INVALID', severity: 'BLOCK', index });
      continue;
    }
    if (ids.has(record.revision_id)) {
      issues.push({ code: 'J10_REVISION_ID_DUPLICATE', severity: 'BLOCK', revision_id: record.revision_id });
    }
    ids.add(record.revision_id);
    if (!J10_REVISION_DOMAINS.includes(record.domain)) {
      issues.push({ code: 'J10_REVISION_DOMAIN_INVALID', severity: 'BLOCK', revision_id: record.revision_id });
    }
    if (record.previous_record_hash !== previousHash) {
      issues.push({
        code: 'J10_REVISION_CHAIN_BROKEN',
        severity: 'BLOCK',
        revision_id: record.revision_id,
        expected: previousHash,
        actual: record.previous_record_hash ?? null
      });
    }
    const expectedRecordHash = sha256(recordHashPayload(record));
    if (record.record_hash !== expectedRecordHash) {
      issues.push({
        code: 'J10_REVISION_IMMUTABILITY_HASH_MISMATCH',
        severity: 'BLOCK',
        revision_id: record.revision_id,
        expected: expectedRecordHash,
        actual: record.record_hash || null
      });
    }
    if (record.payload_hash !== sha256(record.snapshot)) {
      issues.push({
        code: 'J10_REVISION_PAYLOAD_HASH_MISMATCH',
        severity: 'BLOCK',
        revision_id: record.revision_id
      });
    }
    previousHash = record.record_hash || previousHash;
  }

  if (Number(ledger?.revision_count || 0) !== revisions.length) {
    issues.push({
      code: 'J10_REVISION_COUNT_MISMATCH',
      severity: 'BLOCK',
      expected: revisions.length,
      actual: ledger?.revision_count ?? null
    });
  }
  const expectedHead = revisions.at(-1) || null;
  if ((ledger?.head_revision_id || null) !== (expectedHead?.revision_id || null)) {
    issues.push({ code: 'J10_LEDGER_HEAD_REVISION_MISMATCH', severity: 'BLOCK' });
  }
  if ((ledger?.head_record_hash || null) !== (expectedHead?.record_hash || null)) {
    issues.push({ code: 'J10_LEDGER_HEAD_HASH_MISMATCH', severity: 'BLOCK' });
  }

  return {
    schema: 'riosystems.j10-revision-ledger-verification.v1',
    status: issues.length ? 'FAIL' : 'PASS',
    project_scope: ledger?.project_scope || null,
    revision_count: revisions.length,
    head_revision_id: expectedHead?.revision_id || null,
    head_record_hash: expectedHead?.record_hash || null,
    historical_revisions_immutable: true,
    append_only: true,
    blocking_issues: issues,
    production_deploy: false
  };
}

export function createJ10Revision(ledgerInput = {}, input = {}) {
  const integrity = verifyJ10RevisionLedger(ledgerInput);
  if (integrity.status !== 'PASS') return fail('J10_LEDGER_INTEGRITY_REQUIRED', { integrity });

  const ledger = clone(ledgerInput);
  const revisionDomain = domain(input.domain);
  if (!revisionDomain) return fail('J10_REVISION_DOMAIN_REQUIRED', { allowed_domains: [...J10_REVISION_DOMAINS] });

  const revisionId = clean(input.revision_id, 240);
  const version = clean(input.version, 80);
  const changeReason = clean(input.change_reason, 1000);
  const createdAt = clean(input.created_at || input.now || new Date().toISOString(), 100);
  const sourceRevision = clean(input.source_revision || 'unknown', 180);
  if (!revisionId) return fail('J10_REVISION_ID_REQUIRED');
  if (!versionTuple(version)) return fail('J10_SEMVER_REQUIRED', { version });
  if (!changeReason) return fail('J10_CHANGE_REASON_REQUIRED');
  if (!input.snapshot || typeof input.snapshot !== 'object' || Array.isArray(input.snapshot)) {
    return fail('J10_REVISION_SNAPSHOT_REQUIRED');
  }
  if (ledger.revisions.some((record) => record.revision_id === revisionId)) {
    return fail('J10_REVISION_ID_IMMUTABLE_DUPLICATE', { revision_id: revisionId });
  }

  const previousInDomain = [...ledger.revisions].reverse().find((record) => record.domain === revisionDomain) || null;
  if (previousInDomain) {
    const cmp = compareVersions(version, previousInDomain.version);
    if (cmp == null || cmp <= 0) {
      return fail('J10_REVISION_VERSION_MUST_ADVANCE', {
        domain: revisionDomain,
        previous_version: previousInDomain.version,
        proposed_version: version
      });
    }
  }

  const acceptanceStatus = clean(input.acceptance_status || 'PENDING', 80).toUpperCase();
  const artifactRef = clean(input.artifact_ref, 1000) || null;
  let artifactHash = clean(input.artifact_hash, 128).toLowerCase() || null;
  if (input.artifact_payload != null) {
    const actualArtifactHash = sha256(input.artifact_payload);
    if (artifactHash && artifactHash !== actualArtifactHash) {
      return fail('J10_ARTIFACT_HASH_MISMATCH', { expected: artifactHash, actual: actualArtifactHash });
    }
    artifactHash = actualArtifactHash;
  }
  if (acceptedState(acceptanceStatus) && J10_ROLLBACK_DOMAINS.includes(revisionDomain) && (!artifactRef || !artifactHash)) {
    return fail('J10_ACCEPTED_ARTIFACT_REF_AND_HASH_REQUIRED', { domain: revisionDomain });
  }

  let lifecycleVersion = null;
  if (revisionDomain === 'BUILD') {
    lifecycleVersion = createBuildVersion({
      ...clone(input.lifecycle || {}),
      build_id: artifactRef || revisionId,
      website_version: version,
      source_revision: sourceRevision,
      previous_known_good: previousInDomain && acceptedState(previousInDomain.acceptance_status)
        ? previousInDomain.artifact_ref
        : null
    });
  } else {
    lifecycleVersion = createWebsiteVersion({
      ...clone(input.lifecycle || {}),
      website_version: version,
      source_revision: sourceRevision
    });
  }

  const snapshot = clone(input.snapshot);
  const record = {
    schema: 'riosystems.j10-revision-record.v1',
    revision_id: revisionId,
    domain: revisionDomain,
    version,
    created_at: createdAt,
    change_reason: changeReason,
    source_revision: sourceRevision,
    acceptance_status: acceptanceStatus,
    accepted_artifact: acceptedState(acceptanceStatus),
    artifact_ref: artifactRef,
    artifact_hash: artifactHash,
    snapshot,
    payload_hash: sha256(snapshot),
    previous_revision_id: previousInDomain?.revision_id || null,
    previous_record_hash: ledger.head_record_hash || null,
    lifecycle_version: lifecycleVersion,
    immutable: true,
    production_deploy: false
  };
  record.record_hash = sha256(recordHashPayload(record));

  ledger.revisions.push(record);
  ledger.revision_count = ledger.revisions.length;
  ledger.head_revision_id = record.revision_id;
  ledger.head_record_hash = record.record_hash;

  const after = verifyJ10RevisionLedger(ledger);
  if (after.status !== 'PASS') return fail('J10_LEDGER_POST_APPEND_INTEGRITY_FAILED', { integrity: after });

  return pass('J10_REVISION_APPENDED', {
    ledger,
    revision: clone(record),
    integrity: after
  });
}

function deepDiff(before, after, path = '', output = []) {
  if (output.length >= 500) return output;
  const beforeObject = before && typeof before === 'object';
  const afterObject = after && typeof after === 'object';
  if (!beforeObject || !afterObject) {
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      output.push({ path: path || '$', change: 'CHANGED', before: clone(before), after: clone(after) });
    }
    return output;
  }

  const beforeArray = Array.isArray(before);
  const afterArray = Array.isArray(after);
  if (beforeArray !== afterArray) {
    output.push({ path: path || '$', change: 'CHANGED_TYPE', before: clone(before), after: clone(after) });
    return output;
  }
  if (beforeArray) {
    const max = Math.max(before.length, after.length);
    for (let i = 0; i < max; i += 1) {
      const nextPath = path ? path + '[' + i + ']' : '[' + i + ']';
      if (i >= before.length) output.push({ path: nextPath, change: 'ADDED', before: null, after: clone(after[i]) });
      else if (i >= after.length) output.push({ path: nextPath, change: 'REMOVED', before: clone(before[i]), after: null });
      else deepDiff(before[i], after[i], nextPath, output);
      if (output.length >= 500) break;
    }
    return output;
  }

  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  for (const key of keys) {
    const nextPath = path ? path + '.' + key : key;
    if (!Object.hasOwn(after, key)) output.push({ path: nextPath, change: 'REMOVED', before: clone(before[key]), after: null });
    else if (!Object.hasOwn(before, key)) output.push({ path: nextPath, change: 'ADDED', before: null, after: clone(after[key]) });
    else deepDiff(before[key], after[key], nextPath, output);
    if (output.length >= 500) break;
  }
  return output;
}

export function diffJ10Revisions(before = {}, after = {}) {
  if (before?.schema !== 'riosystems.j10-revision-record.v1' || after?.schema !== 'riosystems.j10-revision-record.v1') {
    return fail('J10_REVISION_RECORDS_REQUIRED');
  }
  const changes = deepDiff(before.snapshot, after.snapshot);
  return pass('J10_REVISION_DIFF_READY', {
    diff: {
      schema: 'riosystems.j10-revision-diff.v1',
      before_revision_id: before.revision_id,
      after_revision_id: after.revision_id,
      before_domain: before.domain,
      after_domain: after.domain,
      before_version: before.version,
      after_version: after.version,
      changed: changes.length > 0,
      change_count: changes.length,
      truncated: changes.length >= 500,
      changes,
      before_payload_hash: before.payload_hash,
      after_payload_hash: after.payload_hash,
      deterministic: true
    }
  });
}

export function analyzeJ10ChangeImpact(change = {}, model = {}) {
  const lifecycleImpact = analyzeChangeImpact(change, model);
  const blastRadius = calculateBlastRadius(change, model);
  const type = clean(change.type, 100).toLowerCase();
  const changeDomain = domain(change.domain);
  const referenceState = clean(change.reference_state, 80).toUpperCase();
  let action = 'NO_REBUILD';
  const reasons = [];

  if (change.noop === true || ['metadata', 'note', 'label'].includes(type)) {
    action = 'NO_REBUILD';
    reasons.push('NON_RENDERING_CHANGE');
  } else if (changeDomain === 'KNOWLEDGE' || ['knowledge', 'fact', 'business_fact'].includes(type)) {
    action = 'REFERENCE_REVIEW_REQUIRED';
    reasons.push('PROJECT_KNOWLEDGE_CHANGED');
  } else if (changeDomain === 'REFERENCE' || type === 'reference') {
    if (referenceState && referenceState !== 'APPROVED') {
      action = 'REFERENCE_REVIEW_REQUIRED';
      reasons.push('REFERENCE_NOT_APPROVED');
    } else {
      action = 'FULL_REBUILD';
      reasons.push('APPROVED_REFERENCE_CHANGED');
    }
  } else if (['design_token', 'global_layout', 'route', 'routing', 'page_structure', 'global_style'].includes(type)) {
    action = 'FULL_REBUILD';
    reasons.push('GLOBAL_OR_ROUTING_CHANGE');
  } else if (blastRadius.severity === 'CROSS_FACTORY' || blastRadius.severity === 'HIGH') {
    action = 'FULL_REBUILD';
    reasons.push('BLAST_RADIUS_REQUIRES_FULL_REBUILD');
  } else if (
    ['content', 'component', 'cta', 'form_schema', 'asset', 'page'].includes(type) ||
    lifecycleImpact.affected_pages.length > 0 ||
    lifecycleImpact.forms_impact ||
    lifecycleImpact.analytics_impact
  ) {
    action = 'PARTIAL_REBUILD';
    reasons.push('BOUNDED_AFFECTED_SCOPE');
  } else {
    action = 'NO_REBUILD';
    reasons.push('NO_RENDERING_OR_INTEGRATION_IMPACT_DETECTED');
  }

  return pass('J10_CHANGE_IMPACT_READY', {
    impact: {
      schema: 'riosystems.j10-change-impact-decision.v1',
      action,
      allowed_actions: [...J10_IMPACT_ACTIONS],
      reasons,
      lifecycle_impact: lifecycleImpact,
      blast_radius: blastRadius,
      affected_pages: clone(lifecycleImpact.affected_pages),
      cross_factory_dependencies: clone(lifecycleImpact.business_integrations),
      requires_retest: lifecycleImpact.requires_retest === true,
      production_change_allowed: false
    }
  });
}

export function createJ10RegressionPlan(previous = {}, current = {}, change = {}, model = {}) {
  const regression = createRegressionContracts(previous, current);
  const impactResult = analyzeJ10ChangeImpact(change, model);
  if (!impactResult.ok) return impactResult;
  return pass('J10_REGRESSION_PLAN_READY', {
    regression_plan: {
      schema: 'riosystems.j10-regression-plan.v1',
      impact: impactResult.impact,
      existing_regression_contracts: regression,
      visual_regression_must_use_existing_foundry: true,
      browser_acceptance_must_use_j9: true,
      reference_closure_must_use_j8_when_required: true,
      automatic_approval: false
    }
  });
}

function revisionIndex(ledger, revisionId) {
  return ledger.revisions.findIndex((record) => record.revision_id === revisionId);
}

export function createJ10RollbackPlan(ledgerInput = {}, input = {}) {
  const integrity = verifyJ10RevisionLedger(ledgerInput);
  if (integrity.status !== 'PASS') return fail('J10_LEDGER_INTEGRITY_REQUIRED', { integrity });
  const ledger = clone(ledgerInput);
  const currentRevisionId = clean(input.current_revision_id, 240);
  if (!currentRevisionId) return fail('J10_CURRENT_REVISION_REQUIRED');

  const currentIndex = revisionIndex(ledger, currentRevisionId);
  if (currentIndex < 0) return fail('J10_CURRENT_REVISION_NOT_FOUND', { current_revision_id: currentRevisionId });
  const current = ledger.revisions[currentIndex];
  if (!J10_ROLLBACK_DOMAINS.includes(current.domain)) {
    return fail('J10_ROLLBACK_DOMAIN_UNSUPPORTED', {
      domain: current.domain,
      supported_domains: [...J10_ROLLBACK_DOMAINS]
    });
  }

  let target = null;
  const requestedTarget = clean(input.target_revision_id, 240);
  if (requestedTarget) {
    const targetIndex = revisionIndex(ledger, requestedTarget);
    if (targetIndex < 0 || targetIndex >= currentIndex) {
      return fail('J10_ROLLBACK_TARGET_MUST_BE_HISTORICAL', { target_revision_id: requestedTarget });
    }
    target = ledger.revisions[targetIndex];
  } else {
    target = ledger.revisions
      .slice(0, currentIndex)
      .reverse()
      .find((record) => record.domain === current.domain && acceptedState(record.acceptance_status)) || null;
  }

  if (!target || target.domain !== current.domain || !acceptedState(target.acceptance_status)) {
    return fail('J10_PREVIOUS_ACCEPTED_ARTIFACT_REQUIRED', {
      current_revision_id: current.revision_id,
      domain: current.domain
    });
  }
  if (!target.artifact_ref || !target.artifact_hash) {
    return fail('J10_PREVIOUS_ACCEPTED_ARTIFACT_REF_AND_HASH_REQUIRED', { target_revision_id: target.revision_id });
  }

  const existingRollback = createRollbackContract({
    previous_known_good: target.artifact_ref,
    failed_build: current.artifact_ref || current.revision_id
  });

  return pass('J10_ROLLBACK_PLAN_READY', {
    plan: {
      schema: 'riosystems.j10-rollback-plan.v1',
      current_revision_id: current.revision_id,
      current_version: current.version,
      target_revision_id: target.revision_id,
      previous_known_good_version: target.version,
      previous_known_good_artifact_ref: target.artifact_ref,
      previous_known_good_artifact_hash: target.artifact_hash,
      rollback_reason: clean(input.rollback_reason, 1000) || 'CURRENT_REVISION_FAILED_ACCEPTANCE',
      rollback_validation: 'REQUIRED_BEFORE_ROLLBACK_ACCEPTANCE',
      restore_mode: 'ARTIFACT_POINTER_RESTORE',
      rebuild_required: false,
      rebuild_allowed_during_rollback: false,
      existing_lifecycle_rollback_contract: existingRollback,
      automatic_production_switch: false,
      operator_approval_required_before_any_production_change: true,
      production: false
    }
  });
}

export async function runJ10Rollback(ledgerInput = {}, input = {}, adapters = {}) {
  const planResult = createJ10RollbackPlan(ledgerInput, input);
  if (!planResult.ok) return planResult;
  const plan = planResult.plan;

  for (const name of ['restore_artifact', 'hash_artifact', 'validate_rollback']) {
    if (typeof adapters[name] !== 'function') return fail('J10_ROLLBACK_ADAPTER_REQUIRED', { adapter: name });
  }

  const restored = await adapters.restore_artifact({
    artifact_ref: plan.previous_known_good_artifact_ref,
    expected_hash: plan.previous_known_good_artifact_hash,
    target_revision_id: plan.target_revision_id,
    current_revision_id: plan.current_revision_id,
    restore_mode: plan.restore_mode,
    rebuild_required: false
  });
  if (!restored) return fail('J10_ARTIFACT_RESTORE_FAILED', { plan });

  const actualHashRaw = await adapters.hash_artifact({
    artifact: restored,
    artifact_ref: plan.previous_known_good_artifact_ref
  });
  const actualHash = clean(typeof actualHashRaw === 'string' ? actualHashRaw : actualHashRaw?.sha256, 128).toLowerCase();
  if (!actualHash || actualHash !== plan.previous_known_good_artifact_hash) {
    return fail('J10_ROLLBACK_ARTIFACT_HASH_MISMATCH', {
      plan,
      expected: plan.previous_known_good_artifact_hash,
      actual: actualHash || null,
      rebuild_invoked: false
    });
  }

  const validation = await adapters.validate_rollback({
    plan: clone(plan),
    restored_artifact: restored,
    artifact_hash: actualHash
  });
  if (!validation || clean(validation.status, 80).toUpperCase() !== 'PASS') {
    return fail('J10_ROLLBACK_VALIDATION_FAILED', {
      plan,
      validation: clone(validation || null),
      rebuild_invoked: false
    });
  }

  return pass('J10_ROLLBACK_PASS', {
    rollback: {
      schema: 'riosystems.j10-rollback-result.v1',
      plan,
      restored_artifact_ref: plan.previous_known_good_artifact_ref,
      restored_artifact_hash: actualHash,
      validation: clone(validation),
      rebuild_invoked: false,
      restore_mode: 'ARTIFACT_POINTER_RESTORE',
      new_revision_record_required: true,
      automatic_acceptance: false,
      production_switch_performed: false
    }
  });
}

export function j10VersioningDiffRollbackManifest() {
  return {
    schema: 'riosystems.j10-versioning-diff-rollback-manifest.v1',
    revision_domains: [...J10_REVISION_DOMAINS],
    rollback_domains: [...J10_ROLLBACK_DOMAINS],
    impact_actions: [...J10_IMPACT_ACTIONS],
    historical_revisions_immutable: true,
    append_only_ledger: true,
    deterministic_payload_hashing: 'SHA-256',
    deterministic_record_hash_chain: true,
    lifecycle_governance_reused: [
      'createWebsiteVersion',
      'createBuildVersion',
      'analyzeChangeImpact',
      'calculateBlastRadius',
      'createRegressionContracts',
      'createRollbackContract'
    ],
    duplicate_versioning_engine_created: false,
    change_impact_must_choose_one_action: true,
    rollback_requires_previous_accepted_artifact: true,
    rollback_restores_previous_artifact_without_rebuild: true,
    rollback_rebuild_allowed: false,
    rollback_validation_required: true,
    automatic_rollback_acceptance: false,
    automatic_production_switch: false,
    production_deploy: false,
    public_launch: false,
    dns_change: false,
    billing_activation: false,
    automatic_paid_activation: false,
    external_writes: false
  };
}
