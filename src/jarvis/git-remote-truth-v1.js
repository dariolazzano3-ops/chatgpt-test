/* JARVIS — Git remote truth resolver V1.

   Read-only. Resolves the genuine remote HEAD SHA of a branch via the GitHub REST
   read API and pairs it with the runtime's own local head so
   `deriveRemoteGitStatus` (src/source-of-truth.js) can classify GIT as
   SYNCED / CHANGED / UNKNOWN.

   Hard rules:
     - GET only. No ref creation, no commit, no PR, no write of any kind.
     - Full 40-char SHA comparison only.
     - Explicit provenance (api, endpoint, http_status, ref, observed_at).
     - Bounded by an AbortController timeout.
     - Fails closed to UNKNOWN. Never fabricates SYNCED.
     - Never logs, copies, commits or returns the token. */

const clean = (value, max = 400) => String(value ?? '').trim().slice(0, max);
const FULL_SHA = /^[0-9a-f]{40}$/i;
const SAFE_SEGMENT = /^[A-Za-z0-9._\-/]{1,200}$/;
const DEFAULT_TIMEOUT_MS = 8000;
const USER_AGENT = 'jarvis-command-center-git-remote-truth/1.0';

function nowIso(clock) {
  try { return new Date(typeof clock === 'function' ? clock() : Date.now()).toISOString(); }
  catch { return new Date().toISOString(); }
}

/** Build a read-only resolver bound to a repo + branch. Returns an async function
 *  that yields { source_id, observed_at, remote_head?, local_head?, provenance, error? }. */
export function createGithubRemoteHeadResolverV1(config = {}) {
  const owner = clean(config.owner, 120);
  const repo = clean(config.repo, 200);
  const branch = clean(config.branch, 200);
  const token = clean(config.token, 12000); // used only as a request header, never returned
  const fetchImpl = typeof config.fetch_impl === 'function' ? config.fetch_impl : globalThis.fetch;
  const timeoutMs = Number.isFinite(Number(config.timeout_ms)) && Number(config.timeout_ms) > 0
    ? Math.min(30000, Math.round(Number(config.timeout_ms)))
    : DEFAULT_TIMEOUT_MS;
  const clock = config.clock;
  const localHeadOf = () => clean(
    (typeof config.local_head === 'function' ? config.local_head() : config.local_head) || '',
    64
  ).toLowerCase();

  const configured = Boolean(owner && repo && branch && token && typeof fetchImpl === 'function'
    && SAFE_SEGMENT.test(owner) && SAFE_SEGMENT.test(repo) && SAFE_SEGMENT.test(branch));

  const endpoint = configured
    ? `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${branch.split('/').map(encodeURIComponent).join('/')}`
    : null;

  async function resolve() {
    const observedAt = nowIso(clock);
    const localHead = localHeadOf();
    const provenanceBase = { api: 'github.rest', ref: `heads/${branch}`, read_only: true };

    if (!configured) {
      return {
        source_id: 'github-remote-head-resolver-v1',
        observed_at: observedAt,
        local_head: FULL_SHA.test(localHead) ? localHead : null,
        provenance: { ...provenanceBase, endpoint: null, http_status: null },
        error: 'GIT_REMOTE_TRUTH_NOT_CONFIGURED'
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetchImpl(endpoint, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          authorization: `Bearer ${token}`,
          accept: 'application/vnd.github+json',
          'x-github-api-version': '2022-11-28',
          'user-agent': USER_AGENT
        }
      });
    } catch (error) {
      clearTimeout(timer);
      return {
        source_id: 'github-remote-head-resolver-v1',
        observed_at: observedAt,
        local_head: FULL_SHA.test(localHead) ? localHead : null,
        provenance: { ...provenanceBase, endpoint, http_status: null },
        error: controller.signal.aborted ? 'GIT_REMOTE_TRUTH_TIMEOUT' : `GIT_REMOTE_TRUTH_NETWORK:${clean(error?.message || error, 160)}`
      };
    }
    clearTimeout(timer);

    const httpStatus = response.status;
    let body = null;
    try { const text = await response.text(); body = text ? JSON.parse(text) : null; } catch {}

    if (!response.ok) {
      return {
        source_id: 'github-remote-head-resolver-v1',
        observed_at: observedAt,
        local_head: FULL_SHA.test(localHead) ? localHead : null,
        provenance: { ...provenanceBase, endpoint, http_status: httpStatus },
        error: `GIT_REMOTE_TRUTH_HTTP_${httpStatus}`
      };
    }

    const remoteSha = clean(body?.object?.sha, 64).toLowerCase();
    if (!FULL_SHA.test(remoteSha)) {
      return {
        source_id: 'github-remote-head-resolver-v1',
        observed_at: observedAt,
        local_head: FULL_SHA.test(localHead) ? localHead : null,
        provenance: { ...provenanceBase, endpoint, http_status: httpStatus, object_type: clean(body?.object?.type, 40) || null },
        error: 'GIT_REMOTE_TRUTH_SHA_INVALID'
      };
    }

    return {
      source_id: 'github-remote-head-resolver-v1',
      observed_at: observedAt,
      remote_head: remoteSha,
      local_head: FULL_SHA.test(localHead) ? localHead : null,
      provenance: { ...provenanceBase, endpoint, http_status: httpStatus, object_type: clean(body?.object?.type, 40) || 'commit' }
    };
  }

  resolve.configured = configured;
  return resolve;
}

/** Build the `git` probe function expected by
 *  createJarvisCommandCenterLiveProbeBindingsV1. Shape:
 *  { source_id, observed_at, remote_head, local_head } (or omitted fields ->
 *  the probe layer classifies GIT as UNKNOWN). */
export function createJarvisGitRemoteTruthProbeV1(config = {}) {
  const resolver = typeof config.resolver === 'function'
    ? config.resolver
    : createGithubRemoteHeadResolverV1(config);
  const probe = async () => {
    const out = await resolver();
    // Even on error we return provenance so the probe layer can fail closed
    // without inventing anything.
    return {
      source_id: out.source_id,
      observed_at: out.observed_at,
      remote_head: out.remote_head || null,
      local_head: out.local_head || null,
      provenance: out.provenance || null,
      error: out.error || null
    };
  };
  probe.configured = resolver.configured === true;
  return probe;
}

export function createJarvisGitRemoteTruthProbeFromEnvV1(env = {}, options = {}) {
  const repoFull = clean(env.JARVIS_GIT_REPOSITORY || env.GITHUB_REPOSITORY, 300);
  const [owner, repo] = repoFull.includes('/') ? repoFull.split('/', 2) : [clean(env.JARVIS_GIT_OWNER, 120), clean(env.JARVIS_GIT_REPO, 200)];
  const token = clean(env.JARVIS_GIT_READ_TOKEN || env.GITHUB_TOKEN, 12000);
  const branch = clean(env.JARVIS_GIT_BRANCH || 'factory/jarvis-command-center-real-truth-v1', 200);
  const localHead = clean(env.JARVIS_PROJECT_HEAD || env.CF_VERSION_ID || options.local_head, 64);
  if (!owner || !repo || !token) return null;
  return createJarvisGitRemoteTruthProbeV1({
    owner, repo, branch, token,
    local_head: localHead || undefined,
    fetch_impl: options.fetch_impl || globalThis.fetch,
    timeout_ms: Number(env.JARVIS_GIT_TIMEOUT_MS) || undefined,
    clock: options.clock
  });
}

export function jarvisGitRemoteTruthManifestV1() {
  return {
    schema: 'aurentara.jarvis.git-remote-truth.v1',
    api: 'github.rest',
    method: 'GET',
    read_only: true,
    write_operations: 0,
    full_sha_only: true,
    fabricates_synced: false,
    fails_closed_to: 'UNKNOWN',
    timeout_ms_default: DEFAULT_TIMEOUT_MS,
    token_returned_or_logged: false,
    production_deploy: false,
    hamyren_data_flow: false
  };
}
