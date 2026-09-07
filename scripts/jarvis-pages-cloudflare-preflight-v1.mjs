const clean = (value, max = 20000) => String(value ?? '').trim().slice(0, max);

const accountId = clean(process.env.CLOUDFLARE_ACCOUNT_ID, 128);
const apiToken = clean(process.env.CLOUDFLARE_API_TOKEN, 12000);
const projectName = clean(process.env.JARVIS_PAGES_PROJECT || 'jarvis-private-core', 128);

if (!accountId) throw new Error('JARVIS_CLOUDFLARE_ACCOUNT_ID_REQUIRED');
if (!apiToken) throw new Error('JARVIS_CLOUDFLARE_API_TOKEN_REQUIRED');
if (projectName !== 'jarvis-private-core') throw new Error('JARVIS_PAGES_PROJECT_MISMATCH');

const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/pages/projects/${encodeURIComponent(projectName)}`;
const response = await fetch(url, {
  headers: { authorization: 'Bearer ' + apiToken, accept: 'application/json' }
});

if (!response.ok) throw new Error('JARVIS_PAGES_PROJECT_LOOKUP_FAILED:' + response.status);
const body = await response.json();
if (body?.success !== true || !body?.result) throw new Error('JARVIS_PAGES_PROJECT_LOOKUP_INVALID');

const project = body.result;
if (project.name !== projectName) throw new Error('JARVIS_PAGES_PROJECT_NAME_MISMATCH');
if (project.subdomain !== 'jarvis-private-core.pages.dev') throw new Error('JARVIS_PAGES_HOST_MISMATCH');
if (project.production_branch !== 'production-disabled') throw new Error('JARVIS_PAGES_PRODUCTION_BRANCH_NOT_DISABLED');

const preview = project.deployment_configs?.preview || {};
const production = project.deployment_configs?.production || {};
if (preview.fail_open !== false) throw new Error('JARVIS_PAGES_PREVIEW_FAIL_OPEN');
if (production.fail_open !== false) throw new Error('JARVIS_PAGES_PRODUCTION_FAIL_OPEN');

const requiredSecrets = [
  'JARVIS_ACCESS_AUD',
  'JARVIS_ACCESS_TEAM_DOMAIN',
  'JARVIS_OPERATOR_EMAIL',
  'JARVIS_PERSONAL_MEMORY_SUPABASE_SERVICE_ROLE_KEY'
];

const previewVars = preview.env_vars || {};
const missing = [];
const wrongType = [];
for (const name of requiredSecrets) {
  const item = previewVars[name];
  if (!item) missing.push(name);
  else if (item.type !== 'secret_text') wrongType.push(name);
}

if (missing.length) throw new Error('JARVIS_PAGES_PREVIEW_SECRETS_MISSING:' + missing.join(','));
if (wrongType.length) throw new Error('JARVIS_PAGES_PREVIEW_SECRETS_NOT_ENCRYPTED:' + wrongType.join(','));

const forbiddenTokens = ['AURENTARA', 'RIOSYSTEMS', 'HAMYREN'];
const envNames = Object.keys(previewVars);
const forbidden = envNames.filter((name) => forbiddenTokens.some((token) => name.toUpperCase().includes(token)));
if (forbidden.length) throw new Error('JARVIS_PAGES_FORBIDDEN_SHARED_BINDING:' + forbidden.join(','));

console.log(JSON.stringify({
  ok: true,
  project: projectName,
  host: project.subdomain,
  production_branch: project.production_branch,
  preview_fail_open: false,
  production_fail_open: false,
  required_secret_names_present: requiredSecrets.length,
  secret_values_exposed: false,
  production_deploy: false,
  public_access: false
}));
