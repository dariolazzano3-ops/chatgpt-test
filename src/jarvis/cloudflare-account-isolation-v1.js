const clean = (value, max = 1000) => String(value ?? '').trim().slice(0, max);

export function validateJarvisCloudflareIsolationV1(input = {}) {
  const jarvisAccountId = clean(input.jarvis_account_id, 128);
  const legacyAccountId = clean(input.legacy_account_id, 128);
  const publicAccess = clean(input.public_access, 20).toLowerCase();
  const production = clean(input.production_deploy, 20).toLowerCase();

  if (!jarvisAccountId) return { ok: false, error: 'JARVIS_CLOUDFLARE_ACCOUNT_REQUIRED' };
  if (legacyAccountId && jarvisAccountId === legacyAccountId) {
    return { ok: false, error: 'JARVIS_CLOUDFLARE_ACCOUNT_MUST_BE_SEPARATE' };
  }
  if (publicAccess !== 'false') return { ok: false, error: 'JARVIS_PUBLIC_ACCESS_MUST_REMAIN_FALSE' };
  if (production !== 'false') return { ok: false, error: 'JARVIS_PRODUCTION_MUST_REMAIN_FALSE' };

  return {
    ok: true,
    dedicated_account: true,
    shared_account: false,
    public_access: false,
    production_deploy: false
  };
}

export function jarvisCloudflareIsolationManifestV1() {
  return {
    schema: 'jarvis.cloudflare-account-isolation.v1',
    account_boundary: 'DEDICATED_ACCOUNT_REQUIRED',
    credential_names: [
      'JARVIS_CLOUDFLARE_ACCOUNT_ID',
      'JARVIS_CLOUDFLARE_API_TOKEN'
    ],
    forbidden_shared_credential_names: [
      'CLOUDFLARE_ACCOUNT_ID',
      'CLOUDFLARE_API_TOKEN',
      'RIOSYSTEMS_CLOUDFLARE_ZERO_COST_CONFIRMED'
    ],
    workers_dev: false,
    neutral_host_required: true,
    public_access: false,
    production_deploy: false
  };
}
