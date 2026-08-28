import fs from 'node:fs';

const mode = process.argv[2] || '--dry-run';
const config = JSON.parse(fs.readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
const staging = config.env?.staging;
const blockers = [];

if (config.name !== 'chatgpt-test') blockers.push('ROOT_WORKER_NAME_UNEXPECTED');
if (!staging || staging.name !== 'riosystems-staging') blockers.push('STAGING_WORKER_NOT_ISOLATED');
if (staging?.workers_dev !== true) blockers.push('STAGING_WORKERS_DEV_REQUIRED');
if (!Array.isArray(staging?.routes) || staging.routes.length !== 0) blockers.push('STAGING_CUSTOM_ROUTES_FORBIDDEN');
if (!Array.isArray(staging?.d1_databases) || staging.d1_databases.length !== 0) blockers.push('STAGING_D1_BINDING_FORBIDDEN');
if (staging?.observability?.enabled !== false) blockers.push('STAGING_OBSERVABILITY_MUST_BE_DISABLED');

const vars = staging?.vars || {};
if (vars.RIOSYSTEMS_ENVIRONMENT !== 'staging') blockers.push('STAGING_ENVIRONMENT_MARKER_REQUIRED');
if (vars.RIOSYSTEMS_PRODUCTION_DEPLOY !== 'false') blockers.push('PRODUCTION_DEPLOY_MUST_BE_FALSE');
if (vars.RIOSYSTEMS_EXTERNAL_WRITES !== 'false') blockers.push('EXTERNAL_WRITES_MUST_BE_FALSE');
if (vars.FACTORY_CONTROL_BRANCH !== 'factory-control') blockers.push('FACTORY_CONTROL_BRANCH_REQUIRED');

for (const forbidden of ['ai','kv_namespaces','r2_buckets','services','queues','durable_objects','hyperdrive','vectorize','workflows']) {
  if (staging && forbidden in staging) blockers.push(`STAGING_BINDING_FORBIDDEN:${forbidden}`);
}

for (const [key, value] of Object.entries(vars)) {
  if (/TOKEN|SECRET|PASSWORD|KEY/i.test(key) || /^(?:sk-|github_pat_|phc_)/i.test(String(value))) {
    blockers.push(`STAGING_SECRET_IN_VARS_FORBIDDEN:${key}`);
  }
}

if (mode === '--production') blockers.push('PRODUCTION_DEPLOY_COMMAND_DISABLED');
if (!['--dry-run','--deploy','--production'].includes(mode)) blockers.push('UNKNOWN_DEPLOY_MODE');

if (mode === '--deploy') {
  if (process.env.RIOSYSTEMS_STAGING_DEPLOY_APPROVED !== 'true') blockers.push('STAGING_DEPLOY_APPROVAL_REQUIRED');
  if (process.env.RIOSYSTEMS_ZERO_COST_CONFIRMED !== 'true') blockers.push('ZERO_COST_CONFIRMATION_REQUIRED');
  if (process.env.RIOSYSTEMS_STAGING_CONFIRMATION !== 'DEPLOY_RIOSYSTEMS_STAGING_ZERO_COST') blockers.push('STAGING_CONFIRMATION_MISMATCH');
}

const result = {
  ok: blockers.length === 0,
  mode,
  worker: staging?.name || null,
  environment: staging?.vars?.RIOSYSTEMS_ENVIRONMENT || null,
  custom_routes: staging?.routes?.length || 0,
  persistent_bindings: 0,
  external_writes: false,
  production_deploy: false,
  zero_cost_confirmation_required: mode === '--deploy',
  blockers
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
