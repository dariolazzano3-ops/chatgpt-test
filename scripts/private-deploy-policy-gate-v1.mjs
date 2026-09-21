import fs from 'node:fs';
import { evaluateYsrioExecutionRiskV1 } from '../src/jarvis/execution-risk-policy-v1.js';

const requestPath = process.argv[2] || '.github/jarvis-pages-private-deploy-request.json';
const request = JSON.parse(fs.readFileSync(requestPath, 'utf8'));

const decision = evaluateYsrioExecutionRiskV1({
  effect: 'PRIVATE_DEPLOY',
  environment: request.environment || request.branch || 'private',
  visibility: 'PRIVATE',
  public_access: request.public_access === true,
  production: request.production_deploy === true,
  private_access_verified: request.cloudflare_access_active === true
    && request.access_audience_dedicated === true,
  dns_change: request.dns_changed === true,
  billing_change: request.billing_changed === true,
  secret_access: request.secret_access === true,
  secret_change: request.secrets_changed === true,
  destructive: request.destructive_action === true,
  protected_branch: false,
  merge: false,
  force_push: false,
  estimated_cost_eur: Number(request.estimated_cost_eur || 0),
  existing_target: request.existing_target === true,
  rollback_available: request.rollback_available === true,
  explicit_approval: false
});

if (decision.execution_authorized !== true || decision.approval_required === true) {
  console.error(JSON.stringify({
    ok: false,
    gate: 'YSRIO_PRIVATE_INTERNAL_AUTONOMY_V1',
    decision
  }));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  gate: 'YSRIO_PRIVATE_INTERNAL_AUTONOMY_V1',
  project: request.project || null,
  host: request.host || null,
  branch: request.branch || null,
  source_sha: request.source_sha || null,
  execution_authorized: true,
  approval_required: false,
  production_deploy: false,
  public_access: false,
  dns_changed: false
}));
