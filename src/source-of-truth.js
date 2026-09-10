const clean = (value, max = 200) => String(value ?? '').trim().slice(0, max);
const FULL_SHA = /^[0-9a-f]{40}$/i;
const REVISION_FIELDS = ['active_revision', 'project_head', 'staging_head', 'mission_revision', 'expected_parent_sha'];

function normalizeSha(value) {
  const normalized = clean(value, 64).toLowerCase();
  return normalized || null;
}

function invalidRevisionField(input = {}) {
  for (const field of REVISION_FIELDS) {
    const value = normalizeSha(input[field]);
    if (value && !FULL_SHA.test(value)) return field;
  }
  return null;
}

export function buildSourceOfTruth(input = {}) {
  const invalidField = invalidRevisionField(input);
  if (invalidField) {
    return {
      ok: false,
      error: 'INVALID_REVISION_SHA',
      field: invalidField,
      requirement: 'full_40_character_git_sha'
    };
  }

  const canonicalBranch = clean(input.canonical_branch, 120) || null;
  const baselineBranch = clean(input.baseline_branch, 120) || canonicalBranch;
  const activeRevision = normalizeSha(input.active_revision || input.project_head || input.expected_parent_sha);
  const projectHead = normalizeSha(input.project_head || activeRevision);
  const missionRevision = normalizeSha(input.mission_revision || activeRevision || projectHead);
  const expectedParentSha = normalizeSha(input.expected_parent_sha || missionRevision || projectHead);
  const stagingHead = normalizeSha(input.staging_head);
  const bound = Boolean(expectedParentSha || missionRevision || projectHead || activeRevision);

  return {
    ok: true,
    context: {
      contract_version: 1,
      canonical_branch: canonicalBranch,
      baseline_branch: baselineBranch,
      active_revision: activeRevision,
      project_head: projectHead,
      staging_head: stagingHead,
      mission_revision: missionRevision,
      expected_parent_sha: expectedParentSha,
      bound,
      enforcement: bound ? 'strict' : 'legacy_unbound'
    }
  };
}

export function validateSourceOfTruth(context = {}, observed = {}) {
  const built = buildSourceOfTruth(context);
  if (!built.ok) return built;
  const normalized = built.context;
  const expected = normalized.expected_parent_sha;
  const observedHead = normalizeSha(observed.project_head || observed.active_revision);

  if (!expected) {
    return {
      ok: true,
      status: 'UNBOUND',
      code: 'SOURCE_OF_TRUTH_UNBOUND',
      execution_allowed: true,
      context: normalized
    };
  }

  if (!observedHead || !FULL_SHA.test(observedHead)) {
    return {
      ok: false,
      status: 'BLOCKED',
      code: 'CURRENT_PROJECT_HEAD_REQUIRED',
      category: 'state_consistency',
      severity: 'high',
      retryable: true,
      repairable: false,
      execution_allowed: false,
      expected_parent_sha: expected,
      observed_project_head: observedHead,
      recommended_action: 'resolve_current_project_head_then_retry',
      context: normalized
    };
  }

  if (expected !== observedHead) {
    return {
      ok: false,
      status: 'BLOCKED',
      code: 'STALE_PROJECT_HEAD',
      category: 'state_consistency',
      severity: 'critical',
      retryable: true,
      repairable: false,
      execution_allowed: false,
      expected_parent_sha: expected,
      observed_project_head: observedHead,
      recommended_action: 'refresh_baseline_recompile_and_review_diff',
      context: normalized
    };
  }

  return {
    ok: true,
    status: 'CURRENT',
    code: 'SOURCE_OF_TRUTH_CURRENT',
    execution_allowed: true,
    expected_parent_sha: expected,
    observed_project_head: observedHead,
    context: normalized
  };
}

export async function resolveAndValidateSourceOfTruth(context = {}, options = {}) {
  const built = buildSourceOfTruth(context);
  if (!built.ok) return built;
  if (!built.context.bound) return validateSourceOfTruth(built.context, options.observed || {});

  let observed = { ...(options.observed || {}) };
  if (!observed.project_head && !observed.active_revision && typeof options.resolve_project_head === 'function') {
    try {
      observed = { ...observed, project_head: await options.resolve_project_head(built.context) };
    } catch (error) {
      return {
        ok: false,
        status: 'BLOCKED',
        code: 'PROJECT_HEAD_RESOLUTION_FAILED',
        category: 'source_control',
        severity: 'high',
        retryable: true,
        repairable: false,
        execution_allowed: false,
        message: clean(error?.message || error, 500) || null,
        recommended_action: 'retry_source_control_resolution',
        context: built.context
      };
    }
  }
  return validateSourceOfTruth(built.context, observed);
}

export function deriveRemoteGitStatus(input = {}) {
  const remoteHead = normalizeSha(input.remote_head || input.remote_project_head || input.genuine_remote_head);
  const localHead = normalizeSha(input.local_head || input.observed_project_head || input.project_head || input.active_revision);
  const observedAt = clean(input.observed_at, 80) || null;
  const sourceId = clean(input.source_id, 240) || null;

  if (!remoteHead || !FULL_SHA.test(remoteHead) || !sourceId || !observedAt) {
    return {
      status: 'UNKNOWN',
      code: 'REMOTE_GIT_TRUTH_UNPROVEN',
      remote_head: FULL_SHA.test(remoteHead || '') ? remoteHead : null,
      local_head: FULL_SHA.test(localHead || '') ? localHead : null,
      source_id: sourceId,
      observed_at: observedAt
    };
  }

  if (!localHead || !FULL_SHA.test(localHead)) {
    return {
      status: 'UNKNOWN',
      code: 'LOCAL_PROJECT_HEAD_REQUIRED',
      remote_head: remoteHead,
      local_head: null,
      source_id: sourceId,
      observed_at: observedAt
    };
  }

  return remoteHead === localHead
    ? { status: 'SYNCED', code: 'REMOTE_GIT_TRUTH_CURRENT', remote_head: remoteHead, local_head: localHead, source_id: sourceId, observed_at: observedAt }
    : { status: 'CHANGED', code: 'REMOTE_GIT_TRUTH_DIVERGED', remote_head: remoteHead, local_head: localHead, source_id: sourceId, observed_at: observedAt };
}

export function sourceOfTruthManifest() {
  return {
    version: '1.0',
    full_git_sha_required_for_bound_missions: true,
    stale_project_head_blocks_execution: true,
    resolver_is_explicitly_injected: true,
    legacy_unbound_compatibility: true,
    remote_git_status_fails_closed_to_unknown: true,
    production_deploy: false
  };
}
