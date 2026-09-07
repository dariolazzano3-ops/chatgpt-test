const clean = (value, max = 1000) => String(value ?? '').trim().slice(0, max);

export function validateJarvisCloudflareResourceIsolationV1(input = {}) {
  const accountId = clean(input.account_id, 128);
  const workerName = clean(input.worker_name, 128);
  const accessAudience = clean(input.access_audience, 256);
  const host = clean(input.host, 500).toLowerCase();
  const publicAccess = clean(input.public_access, 20).toLowerCase();
  const production = clean(input.production_deploy, 20).toLowerCase();

  if (!accountId) return { ok: false, error: 'JARVIS_CLOUDFLARE_ACCOUNT_REQUIRED' };
  if (workerName !== 'jarvis-private-staging') {
    return { ok: false, error: 'JARVIS_DEDICATED_WORKER_REQUIRED' };
  }
  if (!accessAudience) return { ok: false, error: 'JARVIS_DEDICATED_ACCESS_AUDIENCE_REQUIRED' };
  if (!host) return { ok: false, error: 'JARVIS_NEUTRAL_HOST_REQUIRED' };
  if (publicAccess !== 'false') return { ok: false, error: 'JARVIS_PUBLIC_ACCESS_MUST_REMAIN_FALSE' };
  if (production !== 'false') return { ok: false, error: 'JARVIS_PRODUCTION_MUST_REMAIN_FALSE' };

  return {
    ok: true,
    account_sharing_allowed: true,
    dedicated_worker: true,
    dedicated_secrets_required: true,
    dedicated_access_application_required: true,
    neutral_host_required: true,
    public_access: false,
    production_deploy: false
  };
}

export function jarvisCloudflareResourceIsolationManifestV1() {
  return {
    schema: 'jarvis.cloudflare-resource-isolation.v1',
    account_boundary: 'SHARED_ACCOUNT_ALLOWED',
    resource_boundary: 'DEDICATED_JARVIS_RESOURCES_REQUIRED',
    worker_name: 'jarvis-private-staging',
    credential_names: [
      'JARVIS_CLOUDFLARE_ACCOUNT_ID',
      'JARVIS_CLOUDFLARE_API_TOKEN'
    ],
    shared_generic_credential_names_allowed: false,
    dedicated_access_application_required: true,
    dedicated_access_audience_required: true,
    workers_dev: false,
    neutral_host_required: true,
    public_access: false,
    production_deploy: false
  };
}
