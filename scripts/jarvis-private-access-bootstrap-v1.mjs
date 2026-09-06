#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const API = 'https://api.cloudflare.com/client/v4';
const clean = (v, max = 2000) => String(v ?? '').trim().slice(0, max);

function normalizeTarget(value = '') {
  try {
    const u = new URL(value.includes('://') ? value : 'https://' + value);
    return { hostname: u.hostname.toLowerCase(), pathname: u.pathname.replace(/\/+$/, '') || '/' };
  } catch {
    return null;
  }
}

function emailFromRule(rule = {}) {
  const value = rule?.email;
  if (typeof value === 'string') return clean(value, 320).toLowerCase();
  if (value && typeof value === 'object') return clean(value.email, 320).toLowerCase();
  return '';
}

function broadRule(rule = {}) {
  const keys = Object.keys(rule || {}).map((k) => k.toLowerCase());
  return keys.some((k) => k === 'everyone' || k === 'login_method' || k === 'email_domain');
}

async function cf(path, token, init = {}) {
  const response = await fetch(API + path, {
    ...init,
    headers: {
      authorization: 'Bearer ' + token,
      accept: 'application/json',
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(init.headers || {})
    }
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.success === false) {
    const detail = clean(body?.errors?.[0]?.message || body?.messages?.[0]?.message || response.statusText, 300);
    throw new Error('CLOUDFLARE_ACCESS_API_FAILED_' + response.status + (detail ? ':' + detail : ''));
  }
  return body?.result;
}

function putWorkerSecret(name, value, config = 'wrangler.jarvis-private.jsonc') {
  const result = spawnSync('npx', ['wrangler', 'secret', 'put', name, '--config', config], {
    input: String(value) + '\n',
    encoding: 'utf8',
    env: process.env,
    stdio: ['pipe', 'pipe', 'pipe']
  });
  if (result.status !== 0) throw new Error('JARVIS_WORKER_SECRET_WRITE_FAILED_' + name);
}

export function deriveSingleOperatorEmail(applications = [], policyMap = {}, expectedWorker = 'riosystems-staging') {
  const candidates = applications.filter((app) => {
    if (clean(app?.type, 80).toLowerCase() !== 'self_hosted') return false;
    const target = normalizeTarget(app?.domain || '');
    return target
      && target.hostname.startsWith(expectedWorker.toLowerCase() + '.')
      && target.hostname.endsWith('.workers.dev')
      && target.pathname === '/operator';
  });
  if (candidates.length !== 1) return { ok: false, error: candidates.length ? 'OPERATOR_ACCESS_APP_AMBIGUOUS' : 'OPERATOR_ACCESS_APP_NOT_FOUND' };

  const policies = policyMap[candidates[0].id] || [];
  if (!policies.length) return { ok: false, error: 'OPERATOR_ACCESS_POLICY_MISSING' };

  const emails = new Set();
  for (const policy of policies) {
    if (clean(policy?.decision, 40).toLowerCase() === 'bypass') return { ok: false, error: 'OPERATOR_ACCESS_BYPASS_REJECTED' };
    if (clean(policy?.decision, 40).toLowerCase() !== 'allow') continue;
    for (const rule of Array.isArray(policy?.include) ? policy.include : []) {
      if (broadRule(rule)) return { ok: false, error: 'OPERATOR_ACCESS_BROAD_RULE_REJECTED' };
      const email = emailFromRule(rule);
      if (email) emails.add(email);
    }
  }

  if (emails.size !== 1) return { ok: false, error: emails.size ? 'OPERATOR_EMAIL_AMBIGUOUS' : 'OPERATOR_EMAIL_NOT_RESOLVED' };
  return { ok: true, email: [...emails][0], source_app_id: candidates[0].id };
}

export function jarvisAppMatch(app = {}, host = '') {
  if (clean(app?.type, 80).toLowerCase() !== 'self_hosted') return false;
  const target = normalizeTarget(app?.domain || '');
  return Boolean(target && target.hostname === clean(host, 500).toLowerCase() && target.pathname === '/');
}

function policyIsExactOperatorAllow(policy = {}, email = '') {
  if (clean(policy?.decision, 40).toLowerCase() !== 'allow') return false;
  const rules = Array.isArray(policy?.include) ? policy.include : [];
  if (rules.length !== 1 || broadRule(rules[0])) return false;
  return emailFromRule(rules[0]) === clean(email, 320).toLowerCase();
}

export async function bootstrapJarvisPrivateAccessV1(runtime = {}) {
  const env = runtime.env || process.env;
  const token = clean(env.CLOUDFLARE_API_TOKEN, 4000);
  const accountId = clean(env.CLOUDFLARE_ACCOUNT_ID, 80);
  const host = clean(env.JARVIS_WORKERS_DEV_HOST, 500).toLowerCase();
  const expectedOperatorWorker = clean(env.RIOSYSTEMS_ACCESS_EXPECTED_WORKER_NAME || 'riosystems-staging', 120);
  const approved = clean(env.JARVIS_PRIVATE_ACCESS_APPROVED, 20).toLowerCase() === 'true';

  if (!approved) throw new Error('JARVIS_PRIVATE_ACCESS_APPROVAL_REQUIRED');
  if (!token || !/^[a-f0-9]{32}$/i.test(accountId)) throw new Error('CLOUDFLARE_CREDENTIALS_REQUIRED');
  if (!host || !host.endsWith('.workers.dev') || !host.startsWith('jarvis-private-staging.')) throw new Error('JARVIS_WORKERS_DEV_HOST_INVALID');

  const applications = await cf('/accounts/' + accountId + '/access/apps?per_page=100', token);
  const policyMap = {};
  for (const app of applications || []) {
    const target = normalizeTarget(app?.domain || '');
    if (target?.pathname === '/operator' && target.hostname.startsWith(expectedOperatorWorker.toLowerCase() + '.')) {
      policyMap[app.id] = await cf('/accounts/' + accountId + '/access/apps/' + app.id + '/policies?per_page=100', token);
    }
  }

  const operator = deriveSingleOperatorEmail(applications || [], policyMap, expectedOperatorWorker);
  if (!operator.ok) throw new Error(operator.error);

  let jarvisApps = (applications || []).filter((app) => jarvisAppMatch(app, host));
  if (jarvisApps.length > 1) throw new Error('JARVIS_ACCESS_APP_AMBIGUOUS');

  let app = jarvisApps[0] || null;
  if (!app) {
    app = await cf('/accounts/' + accountId + '/access/apps', token, {
      method: 'POST',
      body: JSON.stringify({
        name: 'JARVIS Private Staging',
        domain: host,
        type: 'self_hosted',
        session_duration: '24h',
        app_launcher_visible: false,
        auto_redirect_to_identity: false,
        allow_authenticate_via_warp: false
      })
    });
  }

  const aud = clean(app?.aud, 500);
  const appId = clean(app?.id, 100);
  if (!aud || !appId) throw new Error('JARVIS_ACCESS_APP_IDENTITY_MISSING');

  const jarvisPolicies = await cf('/accounts/' + accountId + '/access/apps/' + appId + '/policies?per_page=100', token);
  if ((jarvisPolicies || []).some((p) => clean(p?.decision, 40).toLowerCase() === 'bypass')) throw new Error('JARVIS_ACCESS_BYPASS_REJECTED');
  if ((jarvisPolicies || []).some((p) => (p?.include || []).some(broadRule))) throw new Error('JARVIS_ACCESS_BROAD_RULE_REJECTED');

  let policy = (jarvisPolicies || []).find((p) => policyIsExactOperatorAllow(p, operator.email));
  if (!policy) {
    if ((jarvisPolicies || []).some((p) => clean(p?.decision, 40).toLowerCase() === 'allow')) {
      throw new Error('JARVIS_ACCESS_EXISTING_ALLOW_POLICY_NOT_EXACT_OPERATOR');
    }
    policy = await cf('/accounts/' + accountId + '/access/apps/' + appId + '/policies', token, {
      method: 'POST',
      body: JSON.stringify({
        name: 'Allow JARVIS Operator',
        decision: 'allow',
        precedence: 1,
        include: [{ email: { email: operator.email } }],
        session_duration: '24h'
      })
    });
  }

  console.log('::add-mask::' + operator.email);
  console.log('::add-mask::' + aud);

  const put = runtime.put_secret || putWorkerSecret;
  put('JARVIS_OPERATOR_EMAIL', operator.email);
  put('JARVIS_ACCESS_AUD', aud);

  return {
    ok: true,
    schema: 'aurentara.jarvis.private-access-bootstrap.v1',
    host,
    application_id: appId,
    application_name: clean(app?.name, 200) || 'JARVIS Private Staging',
    policy_id: clean(policy?.id, 100) || null,
    dedicated_access_application: true,
    exact_single_operator_policy: true,
    worker_secrets_written: ['JARVIS_OPERATOR_EMAIL', 'JARVIS_ACCESS_AUD'],
    operator_email_exposed: false,
    audience_exposed: false,
    aurentara_route_modified: false,
    hamyren_data_flow: false,
    production_deploy: false,
    public_access: false
  };
}

const invokedDirectly = process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href;
if (invokedDirectly) {
  bootstrapJarvisPrivateAccessV1()
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(JSON.stringify({ ok: false, error: clean(error?.message || error, 400), production_deploy: false, public_access: false }));
      process.exit(2);
    });
}
