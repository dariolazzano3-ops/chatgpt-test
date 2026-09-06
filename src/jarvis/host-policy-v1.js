const clean = (value, max = 1000) => String(value ?? '').trim().slice(0, max);

const FORBIDDEN_HOST_TOKENS = Object.freeze([
  'gelato',
  'donatello',
  'aurentara',
  'riosystems',
  'hamyren'
]);

export function validateJarvisNeutralHostV1(value = '') {
  let hostname = '';
  try {
    const url = new URL(value.includes('://') ? value : 'https://' + value);
    hostname = clean(url.hostname, 500).toLowerCase();
  } catch {
    return { ok: false, error: 'JARVIS_NEUTRAL_HOST_INVALID' };
  }

  if (!hostname || hostname === 'localhost') return { ok: false, error: 'JARVIS_NEUTRAL_HOST_INVALID' };
  const forbidden = FORBIDDEN_HOST_TOKENS.find((token) => hostname.includes(token));
  if (forbidden) return { ok: false, error: 'JARVIS_NEUTRAL_HOST_FORBIDDEN_TOKEN', forbidden_token: forbidden };

  return {
    ok: true,
    hostname,
    neutral: true,
    forbidden_tokens_present: [],
    aurentara_association: false,
    hamyren_association: false,
    legacy_business_association: false
  };
}

export function jarvisNeutralHostManifestV1() {
  return {
    schema: 'aurentara.jarvis.neutral-host-policy.v1',
    forbidden_tokens: [...FORBIDDEN_HOST_TOKENS],
    inherited_workers_dev_account_subdomain_allowed: false,
    aurentara_domain_allowed: false,
    riosystems_domain_allowed: false,
    hamyren_domain_allowed: false,
    production_deploy: false
  };
}
