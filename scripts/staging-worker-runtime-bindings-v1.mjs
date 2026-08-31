#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const API_ORIGIN = 'https://api.cloudflare.com';
const clean = (value, max = 1200) => String(value ?? '').trim().slice(0, max);

function targetApplication(app = {}, expectedWorkerName = 'riosystems-staging') {
  if (clean(app.type, 80).toLowerCase() !== 'self_hosted') return false;
  const domain = clean(app.domain, 500).toLowerCase();
  const worker = clean(expectedWorkerName, 120).toLowerCase();
  return Boolean(worker) && domain.startsWith(`${worker}.`) && domain.endsWith('.workers.dev');
}

function selectorKeys(rule = {}) {
  return rule && typeof rule === 'object' && !Array.isArray(rule)
    ? Object.keys(rule).map((key) => key.toLowerCase())
    : [];
}

function emailFromRule(rule = {}) {
  const value = rule?.email;
  if (typeof value === 'string') return clean(value, 320).toLowerCase();
  if (value && typeof value === 'object') return clean(value.email, 320).toLowerCase();
  return '';
}

function validEmail(value = '') {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(value, 320));
}

export function deriveStagingOperatorBindings({ applications = [], policies = [], expected_worker_name = 'riosystems-staging' } = {}) {
  const matches = applications.filter((app) => targetApplication(app, expected_worker_name));
  if (matches.length !== 1) return { ok: false, error: matches.length ? 'ACCESS_APPLICATION_AMBIGUOUS' : 'ACCESS_APPLICATION_NOT_FOUND' };

  const app = matches[0];
  const aud = clean(app.aud, 500);
  if (!aud) return { ok: false, error: 'ACCESS_APPLICATION_AUD_MISSING' };

  const allowPolicies = policies.filter((policy) => clean(policy?.decision, 80).toLowerCase() === 'allow');
  if (!allowPolicies.length) return { ok: false, error: 'ACCESS_ALLOW_POLICY_MISSING' };
  if (policies.some((policy) => clean(policy?.decision, 80).toLowerCase() === 'bypass')) return { ok: false, error: 'ACCESS_BYPASS_POLICY_REJECTED' };

  const emails = new Set();
  for (const policy of allowPolicies) {
    const include = Array.isArray(policy?.include) ? policy.include : [];
    if (!include.length) return { ok: false, error: 'ACCESS_BROAD_ALLOW_POLICY_REJECTED' };
    for (const rule of include) {
      const keys = selectorKeys(rule);
      if (keys.some((key) => key === 'everyone' || key === 'login_method')) return { ok: false, error: 'ACCESS_BROAD_ALLOW_POLICY_REJECTED' };
      const email = emailFromRule(rule);
      if (email) {
        if (!validEmail(email)) return { ok: false, error: 'ACCESS_OPERATOR_EMAIL_INVALID' };
        emails.add(email);
      }
    }
  }

  if (emails.size !== 1) return { ok: false, error: emails.size ? 'ACCESS_OPERATOR_EMAIL_AMBIGUOUS' : 'ACCESS_OPERATOR_EMAIL_NOT_RESOLVABLE' };

  return {
    ok: true,
    application_id: clean(app.id, 100),
    audience: aud,
    operator_email: [...emails][0],
    policy_count: policies.length,
    variable_cost_eur: 0,
    production_deploy: false
  };
}

async function fetchJson(url, token) {
  const target = new URL(url);
  if (target.origin !== API_ORIGIN || !target.pathname.startsWith('/client/v4/')) throw new Error('CLOUDFLARE_READ_PATH_REJECTED');
  const response = await fetch(target, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    redirect: 'error'
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.success === false) throw new Error(`CLOUDFLARE_READ_FAILED_${response.status}`);
  return body?.result;
}

function putSecret(name, value, runtime = {}) {
  const command = runtime.spawn_sync || spawnSync;
  const result = command('npx', ['wrangler', 'secret', 'put', name, '--env', 'staging'], {
    input: `${value}\n`,
    encoding: 'utf8',
    env: process.env,
    stdio: ['pipe', 'pipe', 'pipe']
  });
  if (result?.status !== 0) throw new Error(`WORKER_SECRET_WRITE_FAILED_${name}`);
}

export async function bootstrapStagingWorkerBindings(runtime = {}) {
  const token = clean(process.env.CLOUDFLARE_API_TOKEN, 1600);
  const accountId = clean(process.env.CLOUDFLARE_ACCOUNT_ID, 80);
  const serviceRoleKey = clean(process.env.RIOSYSTEMS_OPERATOR_RUNTIME_SUPABASE_SERVICE_ROLE_KEY, 2000);
  const expectedWorkerName = clean(process.env.RIOSYSTEMS_ACCESS_EXPECTED_WORKER_NAME || 'riosystems-staging', 120);

  if (process.env.RIOSYSTEMS_STAGING_BINDINGS_APPROVED !== 'true') throw new Error('STAGING_BINDINGS_APPROVAL_REQUIRED');
  if (process.env.RIOSYSTEMS_ZERO_COST_CONFIRMED !== 'true') throw new Error('ZERO_COST_CONFIRMATION_REQUIRED');
  if (!token || !/^[a-f0-9]{32}$/i.test(accountId)) throw new Error('CLOUDFLARE_CREDENTIALS_REQUIRED');
  if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY_REQUIRED');

  const applications = await fetchJson(`${API_ORIGIN}/client/v4/accounts/${accountId}/access/apps?per_page=100`, token);
  const appMatches = Array.isArray(applications) ? applications.filter((app) => targetApplication(app, expectedWorkerName)) : [];
  if (appMatches.length !== 1) throw new Error(appMatches.length ? 'ACCESS_APPLICATION_AMBIGUOUS' : 'ACCESS_APPLICATION_NOT_FOUND');
  const appId = clean(appMatches[0]?.id, 100);
  if (!appId) throw new Error('ACCESS_APPLICATION_ID_MISSING');
  const policies = await fetchJson(`${API_ORIGIN}/client/v4/accounts/${accountId}/access/apps/${appId}/policies?per_page=100`, token);

  const derived = deriveStagingOperatorBindings({
    applications: Array.isArray(applications) ? applications : [],
    policies: Array.isArray(policies) ? policies : [],
    expected_worker_name: expectedWorkerName
  });
  if (!derived.ok) throw new Error(derived.error);

  // Prevent operator identity and Access audience from appearing in Actions logs.
  console.log(`::add-mask::${derived.operator_email}`);
  console.log(`::add-mask::${derived.audience}`);

  putSecret('RIOSYSTEMS_OPERATOR_EMAIL', derived.operator_email, runtime);
  putSecret('RIOSYSTEMS_ACCESS_AUD', derived.audience, runtime);
  putSecret('RIOSYSTEMS_OPERATOR_RUNTIME_SUPABASE_SERVICE_ROLE_KEY', serviceRoleKey, runtime);

  return {
    ok: true,
    schema: 'riosystems.staging-worker-runtime-bindings.v1',
    access_application_verified: true,
    single_operator_identity_derived: true,
    worker_secret_names_written: [
      'RIOSYSTEMS_OPERATOR_EMAIL',
      'RIOSYSTEMS_ACCESS_AUD',
      'RIOSYSTEMS_OPERATOR_RUNTIME_SUPABASE_SERVICE_ROLE_KEY'
    ],
    sensitive_values_returned: false,
    production_deploy: false,
    external_customer_data: false,
    variable_cost_eur: 0
  };
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  try {
    const result = await bootstrapStagingWorkerBindings();
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(JSON.stringify({
      ok: false,
      error: clean(error?.message || error, 240),
      sensitive_values_returned: false,
      production_deploy: false,
      external_customer_data: false,
      variable_cost_eur: 0
    }));
    process.exit(2);
  }
}
