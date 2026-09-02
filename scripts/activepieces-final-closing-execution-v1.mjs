import fs from 'node:fs';

const evidencePath = '.activepieces-final-close/evidence.json';
fs.mkdirSync('.activepieces-final-close', { recursive: true });

const cfToken = process.env.CLOUDFLARE_API_TOKEN || '';
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || '';
const appId = process.env.ACCESS_APP_ID || '';
const factoryUrl = (process.env.FACTORY_URL || '').replace(/\/$/, '');
const factoryApiToken = process.env.FACTORY_API_TOKEN_A || process.env.FACTORY_API_TOKEN_B || '';
const runMarker = `${process.env.GITHUB_RUN_ID || 'run'}-${process.env.GITHUB_RUN_ATTEMPT || '1'}`;
const tempName = `activepieces-final-close-${runMarker}`;

const evidence = {
  schema_version: '1.0',
  provider_id: 'activepieces-cloud-free',
  environment: 'staging',
  verification_method: 'protected_worker_diagnostic_exact_one_shot',
  source_secrets: {
    factory_api_token_present: Boolean(factoryApiToken),
    activepieces_api_key_present: Boolean(process.env.ACTIVEPIECES_SOURCE_SECRET || ''),
    webflow_site_token_present: Boolean(process.env.WEBFLOW_SOURCE_SECRET || ''),
    cloudflare_api_token_present: Boolean(cfToken),
    cloudflare_account_id_present: Boolean(accountId)
  },
  durable_secret_restore: {
    activepieces_api_key_restorable: Boolean(process.env.ACTIVEPIECES_SOURCE_SECRET || ''),
    webflow_site_token_restorable: Boolean(process.env.WEBFLOW_SOURCE_SECRET || ''),
    durability_gate_remains: !Boolean(process.env.ACTIVEPIECES_SOURCE_SECRET || '') || !Boolean(process.env.WEBFLOW_SOURCE_SECRET || '')
  },
  runtime_bindings: {
    checked: false,
    activepieces_api_key_present: false,
    webflow_site_token_present: false,
    api_token_present: false,
    pass: false
  },
  access: {
    ephemeral_service_token_created: false,
    service_auth_policy_created: false,
    propagation_wait_completed: false,
    human_policy_preserved: false,
    bypass_count_before: null,
    bypass_count_after: null,
    broad_allow_count_before: null,
    broad_allow_count_after: null,
    cleanup_verified: false,
    temp_token_remains: null,
    temp_policy_remains: null
  },
  presence: {
    attempted: false,
    http_status: null,
    worker_reached: false,
    ok: false,
    credential_present: false,
    provider_requests: null,
    provider_writes: null,
    flow_execution_performed: null,
    production_deploy: null,
    external_writes: null,
    real_customer_data: null,
    variable_cost_eur: null,
    pass: false
  },
  verify: {
    attempted: false,
    http_status: null,
    worker_reached: false,
    ok: false,
    credential_present: false,
    credential_valid: false,
    authenticated: false,
    api_accessible: false,
    connected_staging: false,
    provider_requests: null,
    provider_writes: null,
    flow_execution_performed: null,
    production_deploy: null,
    external_writes: null,
    real_customer_data: null,
    variable_cost_eur: null,
    pass: false
  },
  totals: {
    activepieces_provider_requests: 0,
    provider_writes: 0,
    flow_executions: 0,
    variable_cost_eur: 0
  },
  safety: {
    production: false,
    external_writes: false,
    real_customer_data: false,
    secrets_persisted: false,
    raw_provider_payload_persisted: false,
    retry_performed: false,
    redirects_followed: false
  },
  final: {
    activepieces_l3_connected: false,
    blocker: null
  }
};

let tempTokenId = null;
let tempPolicyId = null;
let accessClientId = null;
let accessClientSecret = null;
let humanPolicyId = null;
let failed = false;

const writeEvidence = () => {
  fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
};

const cf = async (path, { method = 'GET', body } = {}) => {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${cfToken}`,
      'Content-Type': 'application/json'
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual'
  });
  let json = null;
  try { json = await res.json(); } catch {}
  if (!res.ok || json?.success === false) throw new Error(`CLOUDFLARE_API_${method}_${res.status}`);
  return json?.result ?? json;
};

const includeRules = (policy) => Array.isArray(policy?.include) ? policy.include : [];
const isHumanRestrictive = (policy) =>
  policy?.decision === 'allow' && includeRules(policy).some((rule) => rule && typeof rule === 'object' && rule.email && rule.email.email);
const isBroadAllow = (policy) =>
  policy?.decision === 'allow' && includeRules(policy).some((rule) =>
    rule && typeof rule === 'object' && (
      Object.prototype.hasOwnProperty.call(rule, 'everyone') ||
      Object.prototype.hasOwnProperty.call(rule, 'any_valid_service_token')
    )
  );
const countBy = (policies, predicate) => policies.filter(predicate).length;

const sanitizePresence = (status, body) => ({
  attempted: true,
  http_status: status,
  worker_reached: body?.worker_reached === true,
  ok: body?.ok === true,
  credential_present: body?.credential_present === true,
  provider_requests: Number.isFinite(body?.provider_requests) ? body.provider_requests : null,
  provider_writes: Number.isFinite(body?.provider_writes) ? body.provider_writes : null,
  flow_execution_performed: body?.flow_execution_performed === true,
  production_deploy: body?.production_deploy === true,
  external_writes: body?.external_writes === true,
  real_customer_data: body?.real_customer_data === true,
  variable_cost_eur: Number.isFinite(body?.variable_cost_eur) ? body.variable_cost_eur : null,
  pass: false
});

const sanitizeVerify = (status, body) => ({
  attempted: true,
  http_status: status,
  worker_reached: body?.worker_reached === true,
  ok: body?.ok === true,
  credential_present: body?.credential_present === true,
  credential_valid: body?.credential_valid === true,
  authenticated: body?.authenticated === true,
  api_accessible: body?.api_accessible === true,
  connected_staging: body?.connected_staging === true,
  provider_requests: Number.isFinite(body?.provider_requests) ? body.provider_requests : null,
  provider_writes: Number.isFinite(body?.provider_writes) ? body.provider_writes : null,
  flow_execution_performed: body?.flow_execution_performed === true,
  production_deploy: body?.production_deploy === true,
  external_writes: body?.external_writes === true,
  real_customer_data: body?.real_customer_data === true,
  variable_cost_eur: Number.isFinite(body?.variable_cost_eur) ? body.variable_cost_eur : null,
  pass: false
});

try {
  if (!cfToken || !accountId || !appId || !factoryUrl || !factoryApiToken) {
    evidence.final.blocker = 'REQUIRED_EXECUTION_SECRET_SOURCE_MISSING';
    failed = true;
    throw new Error('required execution source missing');
  }

  const secretBindings = await cf(`/accounts/${accountId}/workers/scripts/riosystems-staging/secrets`);
  const secretNames = new Set((Array.isArray(secretBindings) ? secretBindings : []).map((item) => item?.name).filter(Boolean));
  evidence.runtime_bindings.checked = true;
  evidence.runtime_bindings.activepieces_api_key_present = secretNames.has('ACTIVEPIECES_API_KEY');
  evidence.runtime_bindings.webflow_site_token_present = secretNames.has('WEBFLOW_SITE_TOKEN');
  evidence.runtime_bindings.api_token_present = secretNames.has('API_TOKEN');
  evidence.runtime_bindings.pass =
    evidence.runtime_bindings.activepieces_api_key_present === true &&
    evidence.runtime_bindings.webflow_site_token_present === true &&
    evidence.runtime_bindings.api_token_present === true;
  if (!evidence.runtime_bindings.pass) {
    evidence.final.blocker = 'POST_DEPLOY_STAGING_SECRET_BINDING_GATE';
    failed = true;
    throw new Error('post deploy binding gate failed');
  }

  const policiesBefore = await cf(`/accounts/${accountId}/access/apps/${appId}/policies?per_page=100`);
  const listBefore = Array.isArray(policiesBefore) ? policiesBefore : [];
  evidence.access.bypass_count_before = countBy(listBefore, (p) => p?.decision === 'bypass');
  evidence.access.broad_allow_count_before = countBy(listBefore, isBroadAllow);
  const human = listBefore.find(isHumanRestrictive);
  humanPolicyId = human?.id || null;

  if (!humanPolicyId || evidence.access.bypass_count_before !== 0 || evidence.access.broad_allow_count_before !== 0) {
    evidence.final.blocker = 'CLOUDFLARE_ACCESS_PREMUTATION_SAFETY_GATE';
    failed = true;
    throw new Error('access premutation gate failed');
  }

  const token = await cf(`/accounts/${accountId}/access/service_tokens`, {
    method: 'POST',
    body: { name: tempName, duration: '60m', enabled: true }
  });
  tempTokenId = token?.id || null;
  accessClientId = token?.client_id || null;
  accessClientSecret = token?.client_secret || null;
  if (!tempTokenId || !accessClientId || !accessClientSecret) {
    evidence.final.blocker = 'CLOUDFLARE_EPHEMERAL_TOKEN_CREATE_BLOCKER';
    failed = true;
    throw new Error('ephemeral token create failed');
  }
  evidence.access.ephemeral_service_token_created = true;

  const precedence = Math.max(0, ...listBefore.map((p) => Number.isFinite(p?.precedence) ? p.precedence : 0)) + 1;
  const policy = await cf(`/accounts/${accountId}/access/apps/${appId}/policies`, {
    method: 'POST',
    body: {
      name: tempName,
      decision: 'non_identity',
      precedence,
      include: [{ service_token: { token_id: tempTokenId } }]
    }
  });
  tempPolicyId = policy?.id || null;
  if (!tempPolicyId) {
    evidence.final.blocker = 'CLOUDFLARE_EPHEMERAL_POLICY_CREATE_BLOCKER';
    failed = true;
    throw new Error('ephemeral policy create failed');
  }
  evidence.access.service_auth_policy_created = true;

  await new Promise((resolve) => setTimeout(resolve, 30000));
  evidence.access.propagation_wait_completed = true;

  const authHeaders = {
    'CF-Access-Client-Id': accessClientId,
    'CF-Access-Client-Secret': accessClientSecret,
    Authorization: `Bearer ${factoryApiToken}`,
    Accept: 'application/json'
  };

  const presenceRes = await fetch(`${factoryUrl}/factory/diagnostics/activepieces-connection`, {
    method: 'GET',
    headers: authHeaders,
    redirect: 'manual'
  });
  let presenceBody = null;
  try { presenceBody = await presenceRes.json(); } catch {}
  evidence.presence = sanitizePresence(presenceRes.status, presenceBody);
  evidence.presence.pass =
    presenceRes.status === 200 &&
    evidence.presence.worker_reached === true &&
    evidence.presence.ok === true &&
    evidence.presence.credential_present === true &&
    evidence.presence.provider_requests === 0 &&
    evidence.presence.provider_writes === 0 &&
    evidence.presence.flow_execution_performed === false &&
    evidence.presence.production_deploy === false &&
    evidence.presence.external_writes === false &&
    evidence.presence.real_customer_data === false &&
    evidence.presence.variable_cost_eur === 0;

  if (!evidence.presence.pass) {
    evidence.final.blocker = 'ACTIVEPIECES_PRESENCE_FAILED_NO_VERIFY_PERFORMED';
    failed = true;
    throw new Error('presence failed; provider verify skipped');
  }

  const verifyRes = await fetch(`${factoryUrl}/factory/diagnostics/activepieces-connection?verify=projects`, {
    method: 'GET',
    headers: authHeaders,
    redirect: 'manual'
  });
  let verifyBody = null;
  try { verifyBody = await verifyRes.json(); } catch {}
  evidence.verify = sanitizeVerify(verifyRes.status, verifyBody);
  evidence.verify.pass =
    verifyRes.status === 200 &&
    evidence.verify.worker_reached === true &&
    evidence.verify.ok === true &&
    evidence.verify.credential_present === true &&
    evidence.verify.credential_valid === true &&
    evidence.verify.authenticated === true &&
    evidence.verify.api_accessible === true &&
    evidence.verify.connected_staging === true &&
    evidence.verify.provider_requests === 1 &&
    evidence.verify.provider_writes === 0 &&
    evidence.verify.flow_execution_performed === false &&
    evidence.verify.production_deploy === false &&
    evidence.verify.external_writes === false &&
    evidence.verify.real_customer_data === false &&
    evidence.verify.variable_cost_eur === 0;

  evidence.totals.activepieces_provider_requests =
    (evidence.presence.provider_requests || 0) + (evidence.verify.provider_requests || 0);
  evidence.totals.provider_writes =
    (evidence.presence.provider_writes || 0) + (evidence.verify.provider_writes || 0);
  evidence.totals.flow_executions = evidence.verify.flow_execution_performed ? 1 : 0;
  evidence.totals.variable_cost_eur =
    (evidence.presence.variable_cost_eur || 0) + (evidence.verify.variable_cost_eur || 0);

  if (!evidence.verify.pass || evidence.totals.activepieces_provider_requests !== 1) {
    evidence.final.blocker = 'ACTIVEPIECES_PROVIDER_VERIFY_FAILED';
    failed = true;
  }
} catch {
  if (!evidence.final.blocker) evidence.final.blocker = 'ONE_SHOT_EXECUTION_BLOCKER';
} finally {
  if (tempPolicyId && cfToken && accountId && appId) {
    try {
      await cf(`/accounts/${accountId}/access/apps/${appId}/policies/${tempPolicyId}`, { method: 'DELETE' });
    } catch {
      failed = true;
      evidence.final.blocker = 'CLOUDFLARE_EPHEMERAL_ACCESS_CLEANUP_BLOCKER';
    }
  }
  if (tempTokenId && cfToken && accountId) {
    try {
      await cf(`/accounts/${accountId}/access/service_tokens/${tempTokenId}`, { method: 'DELETE' });
    } catch {
      failed = true;
      evidence.final.blocker = 'CLOUDFLARE_EPHEMERAL_ACCESS_CLEANUP_BLOCKER';
    }
  }

  if (cfToken && accountId && appId) {
    try {
      const policiesAfter = await cf(`/accounts/${accountId}/access/apps/${appId}/policies?per_page=100`);
      const tokensAfter = await cf(`/accounts/${accountId}/access/service_tokens?per_page=1000`);
      const listAfter = Array.isArray(policiesAfter) ? policiesAfter : [];
      const tokenListAfter = Array.isArray(tokensAfter) ? tokensAfter : [];
      evidence.access.bypass_count_after = countBy(listAfter, (p) => p?.decision === 'bypass');
      evidence.access.broad_allow_count_after = countBy(listAfter, isBroadAllow);
      evidence.access.human_policy_preserved = Boolean(
        humanPolicyId && listAfter.some((p) => p?.id === humanPolicyId && isHumanRestrictive(p))
      );
      evidence.access.temp_policy_remains = Boolean(
        tempPolicyId && listAfter.some((p) => p?.id === tempPolicyId || p?.name === tempName)
      );
      evidence.access.temp_token_remains = Boolean(
        tempTokenId && tokenListAfter.some((t) => t?.id === tempTokenId || t?.name === tempName)
      );
      evidence.access.cleanup_verified =
        evidence.access.human_policy_preserved === true &&
        evidence.access.bypass_count_after === 0 &&
        evidence.access.broad_allow_count_after === 0 &&
        evidence.access.temp_policy_remains === false &&
        evidence.access.temp_token_remains === false;
    } catch {
      evidence.access.cleanup_verified = false;
      failed = true;
      evidence.final.blocker = 'CLOUDFLARE_EPHEMERAL_ACCESS_CLEANUP_BLOCKER';
    }
  }

  if (!evidence.access.cleanup_verified) {
    failed = true;
    evidence.final.blocker = 'CLOUDFLARE_EPHEMERAL_ACCESS_CLEANUP_BLOCKER';
  }

  evidence.final.activepieces_l3_connected =
    evidence.runtime_bindings.pass === true &&
    evidence.presence.pass === true &&
    evidence.verify.pass === true &&
    evidence.totals.activepieces_provider_requests === 1 &&
    evidence.totals.provider_writes === 0 &&
    evidence.access.cleanup_verified === true;

  if (evidence.final.activepieces_l3_connected) evidence.final.blocker = null;
  writeEvidence();
}

if (failed || !evidence.final.activepieces_l3_connected) process.exitCode = 1;
