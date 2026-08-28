const clean = (value, max = 500) => String(value || '').trim().slice(0, max);
const FULL_SHA = /^[0-9a-f]{40}$/i;
const SAFE_PATH = /^(?:factory-state\/missions|factory-state\/mission-contracts|factory-state\/mission-packages)\/[a-zA-Z0-9._-]+\.json$/;

async function githubJson(fetchImpl, url, options = {}) {
  const response = await fetchImpl(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(`GITHUB_API_FAILED_${response.status}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

export async function commitJsonFilesAtomically(input = {}, dependencies = {}) {
  const repository = clean(input.repository, 240);
  const branch = clean(input.branch, 160);
  const token = clean(input.token, 1000);
  const message = clean(input.message, 500);
  const expectedParent = clean(input.expected_parent_sha, 40).toLowerCase();
  const files = Array.isArray(input.files) ? input.files : [];
  const fetchImpl = dependencies.fetch_impl || globalThis.fetch;
  if (!repository.includes('/') || !branch || !token || !message || typeof fetchImpl !== 'function') return { ok: false, code: 'ATOMIC_COMMIT_CONFIGURATION_INVALID', production_deploy: false };
  if (expectedParent && !FULL_SHA.test(expectedParent)) return { ok: false, code: 'ATOMIC_COMMIT_PARENT_SHA_INVALID', production_deploy: false };
  if (!files.length || files.some((file) => !SAFE_PATH.test(clean(file?.path, 500)) || file?.value === undefined)) return { ok: false, code: 'ATOMIC_COMMIT_FILE_INVALID', production_deploy: false };
  if (new Set(files.map((file) => file.path)).size !== files.length) return { ok: false, code: 'ATOMIC_COMMIT_DUPLICATE_PATH', production_deploy: false };

  const baseUrl = `https://api.github.com/repos/${repository}`;
  const headers = { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'content-type': 'application/json' };
  const request = (method, body) => ({ method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  try {
    const ref = await githubJson(fetchImpl, `${baseUrl}/git/ref/heads/${encodeURIComponent(branch)}`, request('GET'));
    const parentSha = clean(ref.object?.sha, 40).toLowerCase();
    if (!FULL_SHA.test(parentSha)) return { ok: false, code: 'ATOMIC_COMMIT_BRANCH_HEAD_INVALID', production_deploy: false };
    if (expectedParent && parentSha !== expectedParent) return { ok: false, code: 'ATOMIC_COMMIT_PARENT_CONFLICT', expected_parent_sha: expectedParent, actual_parent_sha: parentSha, retryable: true, production_deploy: false };
    const parentCommit = await githubJson(fetchImpl, `${baseUrl}/git/commits/${parentSha}`, request('GET'));
    const baseTree = clean(parentCommit.tree?.sha, 40).toLowerCase();
    if (!FULL_SHA.test(baseTree)) return { ok: false, code: 'ATOMIC_COMMIT_BASE_TREE_INVALID', production_deploy: false };

    const treeEntries = [];
    for (const file of files) {
      const content = `${JSON.stringify(file.value, null, 2)}\n`;
      const blob = await githubJson(fetchImpl, `${baseUrl}/git/blobs`, request('POST', { content: Buffer.from(content).toString('base64'), encoding: 'base64' }));
      if (!FULL_SHA.test(blob.sha || '')) return { ok: false, code: 'ATOMIC_COMMIT_BLOB_INVALID', path: file.path, production_deploy: false };
      treeEntries.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha });
    }
    const tree = await githubJson(fetchImpl, `${baseUrl}/git/trees`, request('POST', { base_tree: baseTree, tree: treeEntries }));
    const commit = await githubJson(fetchImpl, `${baseUrl}/git/commits`, request('POST', { message, tree: tree.sha, parents: [parentSha] }));
    await githubJson(fetchImpl, `${baseUrl}/git/refs/heads/${encodeURIComponent(branch)}`, request('PATCH', { sha: commit.sha, force: false }));
    return { ok: true, commit_sha: commit.sha, parent_sha: parentSha, paths: treeEntries.map((entry) => entry.path), atomic: true, production_deploy: false };
  } catch (error) {
    const conflict = [409, 422].includes(Number(error?.status));
    return { ok: false, code: conflict ? 'ATOMIC_COMMIT_REF_CONFLICT' : 'ATOMIC_COMMIT_FAILED', retryable: conflict, status: Number(error?.status) || null, production_deploy: false };
  }
}

export function githubAtomicCommitManifest() {
  return { version: 'riosystems.github-atomic-json-commit.v1', single_ref_update: true, expected_parent_guard: true, force_push: false, allowed_paths_scoped: true, production_deploy: false };
}
