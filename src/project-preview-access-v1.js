import { GENERATED_PROJECT_PREVIEW_INDEX } from './generated-project-preview-index-v1.js';
const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const clone = (value) => structuredClone(value ?? null);

export const PROJECT_PREVIEW_ACCESS_SCHEMA = 'aurentara.project-preview-access.v2';

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

function safeRepoPath(value = '') {
  const raw = clean(value, 1200).replace(/^\/+/, '').replace(/\/+$/, '');
  if (!raw || raw.includes('..') || raw.includes('\\')) return null;
  if (!/^[a-z0-9._/@:+-]+(?:\/[a-z0-9._@:+-]+)*$/i.test(raw)) return null;
  return raw;
}

function safeProjectToken(value = '') {
  const raw = clean(value, 280);
  if (!raw || raw.includes('/') || raw.includes('\\') || raw.includes('..')) return null;
  return /^[a-z0-9._:+-]+$/i.test(raw) ? raw : null;
}

function normalizedPreviewObject(item = {}) {
  if (!item || typeof item !== 'object') return null;
  const url = safeHttpsUrl(item.preview_url || item.url);
  if (!url || item.private_access_verified === false) return null;
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

function candidateFromPayload(payload = {}) {
  const project = payload?.project || {};
  const deliveryRows = Array.isArray(project.deliveries) ? project.deliveries : [];
  const resultDeliverables = Array.isArray(payload?.results?.deliverables) ? payload.results.deliverables : [];
  const candidates = [
    payload?.customer_review?.current_preview,
    project?.customer_review?.current_preview,
    payload?.results?.customer_review?.current_preview,
    payload?.results?.delivery?.customer_review?.current_preview,
    payload?.results?.delivery?.current_preview,
    payload?.results?.current_preview,
    payload?.preview,
    project?.preview,
    ...deliveryRows.map((item) => item?.preview),
    ...resultDeliverables.map((item) => item?.preview)
  ];
  for (const item of candidates) {
    const normalized = normalizedPreviewObject(item);
    if (normalized) return normalized;
  }

  for (const value of [
    payload?.results?.delivery?.preview_url,
    payload?.results?.preview_url,
    project?.preview_url,
    ...deliveryRows.map((item) => item?.preview_url),
    ...resultDeliverables.map((item) => item?.preview_url)
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

function runtimeHtmlArtifact(runtime = {}, scopeKey = '') {
  const runs = (runtime?.live_staging_runs || []).filter((run) => run?.scope_key === scopeKey && run?.status === 'LIVE_STAGING_VERIFIED');
  for (const run of runs.slice().reverse()) {
    const artifact = run?.evidence?.delivery?.factory_result?.artifact
      || run?.evidence?.factory_result?.artifact
      || run?.evidence?.delivery?.artifact
      || null;
    const files = artifact?.files && typeof artifact.files === 'object' && !Array.isArray(artifact.files) ? artifact.files : null;
    if (!files) continue;
    const root = safeRepoPath(artifact.project_root || run?.evidence?.delivery?.outputs?.artifact_ref || '');
    const paths = Object.keys(files).filter((path) => typeof files[path] === 'string' && /(?:^|\/)index\.html$/i.test(path));
    const sourcePath = paths.find((path) => root && path === root + '/index.html') || paths[0] || null;
    if (!sourcePath) continue;
    return {
      execution_id: clean(run.execution_id, 240) || null,
      source_path: safeRepoPath(sourcePath),
      source_revision: clean(run.updated_at || run.completed_at, 240) || null,
      html: files[sourcePath],
      qa_passed: run?.evidence?.qa?.passed === true
    };
  }
  return null;
}

function addDirectory(set, value) {
  const path = safeRepoPath(value);
  if (!path) return;
  if (path.endsWith('.html')) {
    const dir = path.split('/').slice(0, -1).join('/');
    if (dir) set.add(dir);
    return;
  }
  if (path.startsWith('projects/')) set.add(path);
  else set.add('projects/' + path);
}

export function projectPreviewDirectoryCandidates(payload = {}, options = {}) {
  const project = payload?.project || {};
  const set = new Set();
  const deliveries = Array.isArray(project.deliveries) ? project.deliveries : [];
  const resultDeliverables = Array.isArray(payload?.results?.deliverables) ? payload.results.deliverables : [];

  for (const value of [
    project.project_root,
    project.preview_project_root,
    project.artifact_ref,
    project.website_project_root,
    payload?.results?.delivery?.artifact_ref,
    payload?.results?.delivery?.project_root,
    ...deliveries.flatMap((item) => [item?.artifact_ref, item?.project_root, item?.evidence?.artifact_ref, item?.evidence?.project_root]),
    ...resultDeliverables.flatMap((item) => [item?.artifact_ref, item?.project_root, item?.evidence?.artifact_ref, item?.evidence?.project_root]),
    ...(Array.isArray(options.additional_project_roots) ? options.additional_project_roots : [])
  ]) addDirectory(set, value);

  const scopeKey = clean(options.scope_key || project.scope_key || payload.scope_key, 640);
  const customerId = safeProjectToken(project.customer_id);
  const scopeProjectId = customerId && scopeKey.startsWith(customerId + ':')
    ? safeProjectToken(scopeKey.slice(customerId.length + 1))
    : null;

  for (const token of [
    scopeProjectId,
    safeProjectToken(project.project_id),
    safeProjectToken(project.project_slug),
    safeProjectToken(payload?.results?.delivery?.project_slug)
  ].filter(Boolean)) addDirectory(set, token);

  return [...set].slice(0, 10);
}

export function runtimeProjectPreviewArtifact(runtime = {}, scopeKey = '') {
  const key = clean(scopeKey, 640);
  const hit = runtimeHtmlArtifact(runtime, key);
  if (!hit) return null;
  return {
    execution_id: hit.execution_id,
    source_path: hit.source_path,
    source_revision: hit.source_revision,
    qa_passed: hit.qa_passed,
    html: hit.html
  };
}

export function bundledProjectPreviewArtifact(payload = {}, options = {}) {
  const project = payload?.project || {};
  const scopeKey = clean(options.scope_key || project.scope_key || payload.scope_key, 640);
  const projectId = safeProjectToken(project.project_id || options.project_id);
  const customerId = safeProjectToken(project.customer_id);
  const scopeProjectId = customerId && scopeKey.startsWith(customerId + ':')
    ? safeProjectToken(scopeKey.slice(customerId.length + 1))
    : null;
  const byScope = GENERATED_PROJECT_PREVIEW_INDEX?.by_scope || {};
  const byProject = GENERATED_PROJECT_PREVIEW_INDEX?.by_project || {};
  const entry = (scopeKey && byScope[scopeKey])
    || (scopeProjectId && byProject[scopeProjectId])
    || (projectId && byProject[projectId])
    || null;
  if (!entry || typeof entry.html !== 'string' || !safeRepoPath(entry.source_path)) return null;
  return {
    project_id: clean(entry.project_id, 240) || projectId || scopeProjectId || null,
    customer_id: clean(entry.customer_id, 240) || customerId || null,
    scope_key: clean(entry.scope_key, 640) || scopeKey || null,
    name: clean(entry.name, 320) || clean(project.name, 320) || null,
    source_path: safeRepoPath(entry.source_path),
    content_sha256: clean(entry.content_sha256, 80) || null,
    html: entry.html
  };
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

  const runtimeArtifact = runtimeProjectPreviewArtifact(options.runtime || {}, scopeKey);
  if (runtimeArtifact) {
    return {
      schema: PROJECT_PREVIEW_ACCESS_SCHEMA,
      project_id: projectId,
      scope_key: scopeKey,
      status: 'AVAILABLE',
      available: true,
      access_kind: 'RUNTIME_WEB_FACTORY_ARTIFACT',
      provider: 'RIOSYSTEMS_NATIVE_WEB_RUNTIME',
      operator_route: '/operator/project-preview/' + encodeURIComponent(scopeKey),
      preview_url: null,
      preview_id: scopeKey + ':runtime-preview:' + clean(runtimeArtifact.execution_id || 'latest', 160),
      source_revision: runtimeArtifact.source_revision,
      source_path: runtimeArtifact.source_path,
      execution_id: runtimeArtifact.execution_id,
      exact_head_bound: false,
      private_access_verified: true,
      qa_passed: runtimeArtifact.qa_passed,
      human_outcome_accepted: null,
      project_scoped: true,
      production_deploy: false,
      public_launch: false
    };
  }

  const deployedSha = clean(options.deployed_sha, 80).toLowerCase();
  const bundledArtifact = bundledProjectPreviewArtifact(payload, { scope_key: scopeKey, project_id: projectId });
  if (bundledArtifact) {
    const revision = /^[0-9a-f]{40}$/.test(deployedSha) ? deployedSha : bundledArtifact.content_sha256;
    return {
      schema: PROJECT_PREVIEW_ACCESS_SCHEMA,
      project_id: projectId || bundledArtifact.project_id,
      scope_key: scopeKey,
      status: 'AVAILABLE',
      available: true,
      access_kind: 'BUNDLED_PROJECT_ARTIFACT',
      provider: 'RIOSYSTEMS_BUILD_PREVIEW_INDEX',
      operator_route: '/operator/project-preview/' + encodeURIComponent(scopeKey),
      preview_url: null,
      preview_id: scopeKey + ':bundled-preview:' + clean(revision || 'artifact', 16),
      source_revision: revision || null,
      source_path: bundledArtifact.source_path,
      content_sha256: bundledArtifact.content_sha256,
      exact_head_bound: /^[0-9a-f]{40}$/.test(deployedSha),
      private_access_verified: true,
      qa_passed: null,
      human_outcome_accepted: null,
      project_scoped: true,
      production_deploy: false,
      public_launch: false
    };
  }

  const canonicalSourcePath = safeRepoPath(options.canonical_source_path || '');
  if (canonicalSourcePath && /^[0-9a-f]{40}$/.test(deployedSha)) {
    return {
      schema: PROJECT_PREVIEW_ACCESS_SCHEMA,
      project_id: projectId,
      scope_key: scopeKey,
      status: 'AVAILABLE',
      available: true,
      access_kind: 'CANONICAL_ARTIFACT_PROXY',
      provider: 'CANONICAL_PROJECT_ARTIFACT',
      operator_route: '/operator/project-preview/' + encodeURIComponent(scopeKey),
      preview_url: null,
      preview_id: scopeKey + ':canonical-preview:' + deployedSha.slice(0, 12),
      source_revision: deployedSha,
      source_path: canonicalSourcePath,
      media_type: 'text/html; charset=utf-8',
      label: project.name ? project.name + ' Project Preview' : 'Project Preview',
      exact_head_bound: true,
      private_access_verified: true,
      qa_passed: null,
      human_outcome_accepted: null,
      project_scoped: true,
      production_deploy: false,
      public_launch: false
    };
  }

  const directories = projectPreviewDirectoryCandidates(payload, options);
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
    source_path: null,
    exact_head_bound: false,
    discovery_candidates: directories,
    reason: directories.length ? 'PROJECT_PREVIEW_ARTIFACT_NOT_MATERIALIZED_OR_REGISTERED' : 'NO_PROJECT_PREVIEW_SOURCE_YET',
    project_scoped: true,
    production_deploy: false,
    public_launch: false
  };
}

export function canonicalPreviewRawUrl(access = {}, repositoryFullName = 'dariolazzano3-ops/chatgpt-test') {
  if (access?.access_kind !== 'CANONICAL_ARTIFACT_PROXY') return null;
  if (!/^[0-9a-f]{40}$/.test(clean(access.source_revision, 80))) return null;
  const path = safeRepoPath(access.source_path);
  if (!path) return null;
  return 'https://raw.githubusercontent.com/' + repositoryFullName + '/' + access.source_revision + '/' + path.split('/').map(encodeURIComponent).join('/');
}

export function projectPreviewAccessManifest() {
  return {
    schema: PROJECT_PREVIEW_ACCESS_SCHEMA,
    every_project_detail_gets_preview_projection: true,
    every_project_uses_same_preview_contract: true,
    project_specific_hardcoded_preview_registry: false,
    existing_preview_urls_reused: true,
    existing_customer_review_preview_reused: true,
    runtime_web_factory_artifacts_reused: true,
    build_time_project_preview_index: true,
    build_time_preview_index_runtime_network_dependency: false,
    canonical_project_artifacts_discovered_generically: true,
    canonical_project_artifacts_bundled_generically: true,
    canonical_artifact_exact_deployed_sha_required: true,
    project_scope_required: true,
    scope_key_project_identity_reused: true,
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
