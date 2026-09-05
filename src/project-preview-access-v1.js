const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const clone = (value) => structuredClone(value ?? null);

export const PROJECT_PREVIEW_ACCESS_SCHEMA = 'aurentara.project-preview-access.v1';

export const CANONICAL_PROJECT_PREVIEW_ARTIFACTS = Object.freeze({
  'gelato-donatello:gelato-donatello-website-v1': Object.freeze({
    project_id: 'gelato-donatello-website-v1',
    source_path: 'projects/gelato-donatello-website-v1/ferrari-preview-v1.html',
    provider: 'CANONICAL_REPOSITORY_ARTIFACT',
    media_type: 'text/html; charset=utf-8',
    label: 'Gelato Ferrari Private Preview'
  })
});

function safeHttpsUrl(value = '') {
  const raw = clean(value, 2000);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function candidateFromPayload(payload = {}) {
  const candidates = [
    payload?.customer_review?.current_preview,
    payload?.project?.customer_review?.current_preview,
    payload?.results?.customer_review?.current_preview,
    payload?.results?.delivery?.customer_review?.current_preview,
    payload?.results?.delivery?.current_preview,
    payload?.results?.current_preview,
    payload?.preview,
    payload?.project?.preview
  ].filter((item) => item && typeof item === 'object');

  for (const item of candidates) {
    const url = safeHttpsUrl(item.preview_url || item.url);
    if (!url) continue;
    if (item.private_access_verified === false) continue;
    return {
      preview_url: url,
      preview_id: clean(item.preview_id, 240) || null,
      source_revision: clean(item.source_revision || item.revision, 240) || null,
      preview_status: clean(item.status, 120).toUpperCase() || 'AVAILABLE',
      private_access_verified: item.private_access_verified !== false,
      qa_passed: item.qa_passed === true || item.qa_status === 'PASS',
      human_outcome_accepted: item.human_outcome_accepted === true
    };
  }

  for (const value of [
    payload?.results?.delivery?.preview_url,
    payload?.results?.preview_url,
    payload?.project?.preview_url
  ]) {
    const url = safeHttpsUrl(value);
    if (url) return {
      preview_url: url,
      preview_id: null,
      source_revision: null,
      preview_status: 'AVAILABLE',
      private_access_verified: null,
      qa_passed: null,
      human_outcome_accepted: null
    };
  }
  return null;
}

export function canonicalPreviewArtifactForScope(scopeKey = '') {
  const key = clean(scopeKey, 640);
  return CANONICAL_PROJECT_PREVIEW_ARTIFACTS[key] ? clone(CANONICAL_PROJECT_PREVIEW_ARTIFACTS[key]) : null;
}

export function resolveProjectPreviewAccess(payload = {}, options = {}) {
  const project = payload?.project || {};
  const scopeKey = clean(options.scope_key || project.scope_key || payload.scope_key, 640);
  const projectId = clean(project.project_id || options.project_id, 240) || null;
  if (!scopeKey) return {
    schema: PROJECT_PREVIEW_ACCESS_SCHEMA,
    status: 'NOT_AVAILABLE',
    available: false,
    error: 'PROJECT_SCOPE_REQUIRED',
    project_scoped: true,
    production_deploy: false
  };

  const external = candidateFromPayload(payload);
  if (external) {
    return {
      schema: PROJECT_PREVIEW_ACCESS_SCHEMA,
      project_id: projectId,
      scope_key: scopeKey,
      status: 'AVAILABLE',
      available: true,
      access_kind: 'EXISTING_PRIVATE_PREVIEW_URL',
      provider: 'EXISTING_PROJECT_PREVIEW',
      preview_url: external.preview_url,
      operator_route: '/operator/project-preview/' + encodeURIComponent(scopeKey),
      preview_id: external.preview_id,
      source_revision: external.source_revision,
      private_access_verified: external.private_access_verified,
      qa_passed: external.qa_passed,
      human_outcome_accepted: external.human_outcome_accepted,
      exact_head_bound: false,
      project_scoped: true,
      production_deploy: false,
      public_launch: false
    };
  }

  const artifact = canonicalPreviewArtifactForScope(scopeKey);
  const deployedSha = clean(options.deployed_sha, 80).toLowerCase();
  if (artifact && /^[0-9a-f]{40}$/.test(deployedSha)) {
    return {
      schema: PROJECT_PREVIEW_ACCESS_SCHEMA,
      project_id: projectId || artifact.project_id,
      scope_key: scopeKey,
      status: 'AVAILABLE',
      available: true,
      access_kind: 'CANONICAL_ARTIFACT_PROXY',
      provider: artifact.provider,
      operator_route: '/operator/project-preview/' + encodeURIComponent(scopeKey),
      preview_url: null,
      preview_id: scopeKey + ':canonical-preview:' + deployedSha.slice(0, 12),
      source_revision: deployedSha,
      source_path: artifact.source_path,
      media_type: artifact.media_type,
      label: artifact.label,
      exact_head_bound: true,
      private_access_verified: true,
      qa_passed: null,
      human_outcome_accepted: null,
      project_scoped: true,
      production_deploy: false,
      public_launch: false
    };
  }

  return {
    schema: PROJECT_PREVIEW_ACCESS_SCHEMA,
    project_id: projectId,
    scope_key: scopeKey,
    status: 'NOT_AVAILABLE',
    available: false,
    access_kind: null,
    provider: null,
    operator_route: null,
    preview_url: null,
    preview_id: null,
    source_revision: null,
    source_path: artifact?.source_path || null,
    exact_head_bound: Boolean(artifact),
    reason: artifact ? 'DEPLOYED_CANONICAL_SHA_NOT_AVAILABLE' : 'NO_PROJECT_PREVIEW_REGISTERED',
    project_scoped: true,
    production_deploy: false,
    public_launch: false
  };
}

export function canonicalPreviewRawUrl(access = {}, repositoryFullName = 'dariolazzano3-ops/chatgpt-test') {
  if (access?.access_kind !== 'CANONICAL_ARTIFACT_PROXY') return null;
  if (!/^[0-9a-f]{40}$/.test(clean(access.source_revision, 80))) return null;
  const path = clean(access.source_path, 1200).replace(/^\/+/, '');
  if (!path || path.includes('..')) return null;
  return 'https://raw.githubusercontent.com/' + repositoryFullName + '/' + access.source_revision + '/' + path.split('/').map(encodeURIComponent).join('/');
}

export function projectPreviewAccessManifest() {
  return {
    schema: PROJECT_PREVIEW_ACCESS_SCHEMA,
    every_project_detail_gets_preview_projection: true,
    existing_preview_urls_reused: true,
    existing_customer_review_preview_reused: true,
    canonical_repository_artifact_fallback: true,
    canonical_artifact_exact_deployed_sha_required: true,
    project_scope_required: true,
    no_new_preview_engine: true,
    no_new_provider: true,
    no_public_preview: true,
    production_deploy: false,
    public_launch: false,
    dns_change: false,
    billing_change: false,
    paid_provider_calls: 0,
    variable_cost_eur: 0
  };
}
