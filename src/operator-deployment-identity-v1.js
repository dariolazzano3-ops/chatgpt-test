const clean = (value, max = 240) => String(value ?? '').trim().slice(0, max);
const SHA_RE = /^[0-9a-f]{40}$/i;

function strictBoolean(value) {
  if (value === true || String(value ?? '').toLowerCase() === 'true') return true;
  if (value === false || String(value ?? '').toLowerCase() === 'false') return false;
  return null;
}

function validTimestamp(value) {
  const raw = clean(value, 120);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function buildOperatorDeploymentIdentity(env = {}) {
  const metadata = env?.CF_VERSION_METADATA && typeof env.CF_VERSION_METADATA === 'object'
    ? env.CF_VERSION_METADATA
    : null;
  const tag = clean(metadata?.tag, 100);
  const deployedSha = SHA_RE.test(tag) ? tag.toLowerCase() : null;
  const environment = clean(env.RIOSYSTEMS_ENVIRONMENT, 80).toLowerCase() || 'unknown';

  return Object.freeze({
    schema: 'aurentara.operator-deployment-identity.v1',
    environment,
    deployed_sha: deployedSha,
    deployed_at: validTimestamp(metadata?.timestamp),
    production_deploy: strictBoolean(env.RIOSYSTEMS_PRODUCTION_DEPLOY),
    external_writes: strictBoolean(env.RIOSYSTEMS_EXTERNAL_WRITES),
    cloudflare_version_id: clean(metadata?.id, 120) || null,
    evidence: metadata ? 'cloudflare_version_metadata' : 'unavailable',
    version_known: Boolean(deployedSha),
    secrets_exposed: false,
    side_effects: false
  });
}

export function deploymentIdentityResponse(env = {}) {
  const identity = buildOperatorDeploymentIdentity(env);
  return new Response(JSON.stringify(identity, null, 2), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store, no-cache, must-revalidate, max-age=0',
      pragma: 'no-cache',
      expires: '0',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
      'x-aurentara-runtime-version': identity.deployed_sha ? identity.deployed_sha.slice(0, 8) : 'unknown'
    }
  });
}

export function operatorDeploymentIdentityManifest() {
  return {
    schema: 'aurentara.operator-deployment-identity.v1',
    source: 'cloudflare_version_metadata',
    git_sha_source: 'cloudflare_version_tag_written_by_official_staging_workflow',
    read_only: true,
    cache_safe: true,
    secrets_exposed: false,
    side_effects: false,
    production_deploy: false
  };
}
