#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createDurableOperatorRuntimeServiceFromEnv } from '../src/operator-runtime-bootstrap-v1.js';

const REQUIRED_CONFIRMATION = 'RUN_OPERATOR_RUNTIME_RESTART_STAGING_ZERO_COST';
const confirmation = String(process.env.RIOSYSTEMS_RUNTIME_RESTART_APPROVED || '').trim();
const phase = String(process.argv[2] || '').trim().toLowerCase();
const testId = String(process.env.RIOSYSTEMS_RUNTIME_RESTART_TEST_ID || '').trim();
const environment = String(process.env.RIOSYSTEMS_ENVIRONMENT || '').trim().toLowerCase();
const mode = String(process.env.RIOSYSTEMS_OPERATOR_RUNTIME_STORE || '').trim().toLowerCase();
const supabaseUrl = String(process.env.RIOSYSTEMS_OPERATOR_RUNTIME_SUPABASE_URL || '').trim().replace(/\/+$/, '');
const serviceRoleKey = String(process.env.RIOSYSTEMS_OPERATOR_RUNTIME_SUPABASE_SERVICE_ROLE_KEY || '').trim();
const table = String(process.env.RIOSYSTEMS_OPERATOR_RUNTIME_SUPABASE_TABLE || 'riosystems_operator_runtime_v1').trim();

if (confirmation !== REQUIRED_CONFIRMATION) throw new Error('RUNTIME_RESTART_EXACT_STAGING_APPROVAL_REQUIRED');
if (environment !== 'staging') throw new Error('RUNTIME_RESTART_STAGING_ONLY');
if (mode !== 'supabase') throw new Error('RUNTIME_RESTART_SUPABASE_STORE_REQUIRED');
if (!supabaseUrl || !serviceRoleKey) throw new Error('RUNTIME_RESTART_SUPABASE_CREDENTIALS_REQUIRED');
if (!/^[a-zA-Z0-9_]+$/.test(table)) throw new Error('RUNTIME_RESTART_TABLE_INVALID');
if (!/^[a-zA-Z0-9._-]{1,100}$/.test(testId)) throw new Error('RUNTIME_RESTART_TEST_ID_INVALID');
if (!['write','read','cleanup'].includes(phase)) throw new Error('RUNTIME_RESTART_PHASE_REQUIRED');

const syntheticEmail = `runtime-restart-acceptance-${testId}@riosystems.invalid`;
const operatorId = `operator:${syntheticEmail}`;
const customerId = `restart-${testId}`;
const projectId = 'durability-v1';
const scopeKey = `${customerId}:${projectId}`;
const runtimeEnv = {
  ...process.env,
  RIOSYSTEMS_OPERATOR_EMAIL: syntheticEmail,
  RIOSYSTEMS_ENVIRONMENT: 'staging',
  RIOSYSTEMS_OPERATOR_RUNTIME_STORE: 'supabase',
  RIOSYSTEMS_OPERATOR_RUNTIME_SUPABASE_URL: supabaseUrl,
  RIOSYSTEMS_OPERATOR_RUNTIME_SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
  RIOSYSTEMS_OPERATOR_RUNTIME_SUPABASE_TABLE: table
};

function headers(extras = {}) {
  return {
    apikey: serviceRoleKey,
    authorization: `Bearer ${serviceRoleKey}`,
    'content-type': 'application/json',
    ...extras
  };
}

function rowUrl(extra = '') {
  const query = `operator_id=eq.${encodeURIComponent(operatorId)}${extra}`;
  return `${supabaseUrl}/rest/v1/${table}?${query}`;
}

async function rawRows() {
  const response = await fetch(rowUrl('&select=operator_id,revision,runtime'), { method: 'GET', headers: headers({ accept: 'application/json' }) });
  if (!response.ok) throw new Error(`RUNTIME_RESTART_RAW_LOAD_FAILED:${response.status}`);
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error('RUNTIME_RESTART_RAW_LOAD_INVALID');
  return rows;
}

async function cleanup() {
  if (!operatorId.startsWith('operator:runtime-restart-acceptance-') || !operatorId.endsWith('@riosystems.invalid')) {
    throw new Error('RUNTIME_RESTART_CLEANUP_SCOPE_REJECTED');
  }
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/riosystems_cleanup_operator_runtime_acceptance`, {
    method: 'POST',
    headers: headers({ accept: 'application/json' }),
    body: JSON.stringify({ p_operator_id: operatorId })
  });
  if (!response.ok) throw new Error(`RUNTIME_RESTART_CLEANUP_FAILED:${response.status}`);
  const deletedCount = Number(await response.json());
  if (!Number.isInteger(deletedCount) || deletedCount < 0 || deletedCount > 1) throw new Error('RUNTIME_RESTART_CLEANUP_RESPONSE_INVALID');
  const remaining = await rawRows();
  assert.equal(remaining.length, 0, 'temporary runtime row must be removed');
  return { ok: true, cleaned: true, deleted_count: deletedCount };
}

if (phase === 'write') {
  const before = await rawRows();
  assert.equal(before.length, 0, 'test operator must not pre-exist');

  const service = createDurableOperatorRuntimeServiceFromEnv(runtimeEnv, { at: new Date().toISOString() });
  const initial = await service.handle({ method: 'GET', path: '/snapshot' });
  assert.equal(initial.ok, true);
  assert.equal(initial.runtime.operator_id, operatorId);
  assert.equal(initial.runtime.revision, 1);

  const created = await service.handle({
    method: 'POST',
    path: '/commands',
    expected_revision: initial.runtime.revision,
    body: {
      type: 'CREATE_PROJECT',
      expected_revision: initial.runtime.revision,
      customer_id: customerId,
      project_id: projectId,
      business_name: 'Synthetic Runtime Restart Acceptance',
      industry: 'acceptance-test',
      country: 'DE',
      language: 'de',
      mission_context: 'Synthetic staging durability acceptance only',
      allowed_environments: ['staging'],
      data_policy: { synthetic_only: true, real_customer_data: false },
      budget_policy: { variable_cost_ceiling_eur: 0, paid_overflow: false },
      production_authorized: false,
      production_deploy: false
    }
  });
  assert.equal(created.ok, true);
  assert.equal(created.runtime.revision, 2);
  assert.ok(created.runtime.command_center_state.portfolio.projects.some((project) => project.scope_key === scopeKey));

  const rows = await rawRows();
  assert.equal(rows.length, 1);
  assert.equal(Number(rows[0].revision), 2);
  assert.equal(rows[0].runtime.operator_id, operatorId);
  assert.equal(rows[0].runtime.revision, 2);

  console.log(JSON.stringify({
    ok: true,
    phase: 'write',
    operator_id: operatorId,
    persisted_revision: 2,
    scope_key: scopeKey,
    synthetic_only: true,
    variable_cost_eur: 0,
    production_deploy: false
  }, null, 2));
}

if (phase === 'read') {
  const service = createDurableOperatorRuntimeServiceFromEnv(runtimeEnv, { at: new Date().toISOString() });
  const recovered = await service.handle({ method: 'GET', path: '/snapshot' });
  assert.equal(recovered.ok, true);
  assert.equal(recovered.runtime.operator_id, operatorId);
  assert.equal(recovered.runtime.revision, 2, 'fresh service instance must recover persisted revision');
  assert.ok(recovered.runtime.command_center_state.portfolio.projects.some((project) => project.scope_key === scopeKey), 'fresh service instance must recover persisted project');

  console.log(JSON.stringify({
    ok: true,
    phase: 'read',
    restart_recovery: 'VERIFIED',
    recovered_revision: recovered.runtime.revision,
    scope_key: scopeKey,
    synthetic_only: true,
    variable_cost_eur: 0,
    production_deploy: false
  }, null, 2));
}

if (phase === 'cleanup') {
  const result = await cleanup();
  console.log(JSON.stringify({
    ...result,
    phase: 'cleanup',
    operator_id: operatorId,
    remaining_rows: 0,
    production_deploy: false
  }, null, 2));
}
