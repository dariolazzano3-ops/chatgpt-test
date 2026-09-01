import assert from 'node:assert/strict';
import {
  parseSupabaseProjectRef,
  validateDedicatedCustomerPlane,
  dedicatedRuntimeBindingsManifest,
  createSupabaseCustomerIdentityBinding,
  createSupabaseCustomerStoreDriver,
  createDedicatedCustomerStoreBinding
} from '../src/customer-product/dedicated-runtime-bindings-v1.js';

const CUSTOMER_REF = 'aaaaaaaaaaaaaaaaaaaa';
const OPERATOR_REF = 'bbbbbbbbbbbbbbbbbbbb';

assert.equal(parseSupabaseProjectRef(`https://${CUSTOMER_REF}.supabase.co`), CUSTOMER_REF);
assert.equal(parseSupabaseProjectRef('http://aaaaaaaaaaaaaaaaaaaa.supabase.co'), null);
assert.equal(validateDedicatedCustomerPlane({ customer_project_ref: OPERATOR_REF, operator_project_ref: OPERATOR_REF }).error, 'CUSTOMER_OPERATOR_DATA_PLANE_COLLISION');
const plane = validateDedicatedCustomerPlane({ customer_project_ref: CUSTOMER_REF, operator_project_ref: OPERATOR_REF });
assert.equal(plane.ok, true);
assert.equal(plane.customer_operator_plane_separate, true);

const manifest = dedicatedRuntimeBindingsManifest();
assert.equal(manifest.identity_binding_contract_ready, true);
assert.equal(manifest.durable_store_binding_contract_ready, true);
assert.equal(manifest.operator_project_reuse_forbidden, true);
assert.equal(manifest.production_customer_project_provisioned, false);
assert.equal(manifest.production_deploy, false);
assert.equal(manifest.variable_cost_eur, 0);

let verifyCalls = 0;
let membershipCalls = 0;
const identity = createSupabaseCustomerIdentityBinding({
  customer_project_ref: CUSTOMER_REF,
  operator_project_ref: OPERATOR_REF,
  synthetic_fixture: true,
  verify_access_token: async ({ access_token, expected_project_ref }) => {
    verifyCalls += 1;
    assert.equal(access_token, 'synthetic-token');
    assert.equal(expected_project_ref, CUSTOMER_REF);
    return {
      ok: true,
      project_ref: CUSTOMER_REF,
      user_id: 'user-a',
      session_id: 'session-a',
      authenticated_at: '2026-09-01T00:00:00.000Z'
    };
  },
  load_memberships: async ({ project_ref, user_id }) => {
    membershipCalls += 1;
    assert.equal(project_ref, CUSTOMER_REF);
    assert.equal(user_id, 'user-a');
    return { ok: true, memberships: [{ tenant_id: 'tenant-a', role: 'owner', status: 'active' }] };
  }
});
const resolved = await identity.resolve({ tenant_id: 'tenant-a', assertion: { access_token: 'synthetic-token' } });
assert.equal(resolved.ok, true);
assert.equal(resolved.principal.tenant_id, 'tenant-a');
assert.equal(resolved.principal.operator_access, false);
assert.equal(verifyCalls, 1);
assert.equal(membershipCalls, 1);
const deniedTenant = await identity.resolve({ tenant_id: 'tenant-b', assertion: { access_token: 'synthetic-token' } });
assert.equal(deniedTenant.error, 'CUSTOMER_TENANT_MEMBERSHIP_REQUIRED');

const wrongIssuer = createSupabaseCustomerIdentityBinding({
  customer_project_ref: CUSTOMER_REF,
  operator_project_ref: OPERATOR_REF,
  synthetic_fixture: true,
  verify_access_token: async () => ({ ok: true, project_ref: OPERATOR_REF, user_id: 'user-a', session_id: 's' }),
  load_memberships: async () => ({ ok: true, memberships: [] })
});
assert.equal((await wrongIssuer.resolve({ tenant_id: 'tenant-a', assertion: { access_token: 'x' } })).error, 'CUSTOMER_IDENTITY_PROJECT_MISMATCH');

const records = new Map();
const key = (input) => `${input.project_ref}|${input.tenant_id}|${input.scope}|${input.collection}|${input.id}`;
const executeOperation = async (input) => {
  assert.equal(input.project_ref, CUSTOMER_REF);
  if (input.operation === 'get') return { ok: true, record: records.get(key(input)) ?? null };
  if (input.operation === 'put') {
    const k = key(input);
    const current = records.get(k);
    const revision = Number(current?.revision || 0);
    if (input.expected_revision !== undefined && Number(input.expected_revision) !== revision) {
      return { ok: false, error: 'STORE_REVISION_CONFLICT', expected_revision: Number(input.expected_revision), actual_revision: revision };
    }
    const next = { revision: revision + 1, value: structuredClone(input.value) };
    records.set(k, next);
    return { ok: true, ...next };
  }
  if (input.operation === 'list') {
    const prefix = `${input.project_ref}|${input.tenant_id}|${input.scope}|${input.collection}|`;
    return {
      ok: true,
      records: [...records.entries()].filter(([k]) => k.startsWith(prefix)).map(([k, value]) => ({ id: k.slice(prefix.length), ...structuredClone(value) }))
    };
  }
  if (input.operation === 'purgeTenant') {
    const prefix = `${input.project_ref}|${input.tenant_id}|`;
    let deleted = 0;
    for (const k of [...records.keys()]) if (k.startsWith(prefix)) { records.delete(k); deleted += 1; }
    return { ok: true, deleted_records: deleted };
  }
  return { ok: false, error: 'UNKNOWN_OPERATION' };
};

const driver = createSupabaseCustomerStoreDriver({
  customer_project_ref: CUSTOMER_REF,
  operator_project_ref: OPERATOR_REF,
  synthetic_fixture: true,
  execute_operation: executeOperation
});
assert.equal(driver.manifest().dedicated_plane_config_ok, true);
assert.equal(driver.manifest().provider_active, false);
assert.equal(driver.manifest().browser_service_role_key_forbidden, true);

const store = createDedicatedCustomerStoreBinding({ driver, synthetic_fixture: true });
assert.equal((await store.put('tenant-a:business-1', 'memory-facts', 'm1', { tenant_id: 'tenant-a', value: 'A' })).ok, true);
assert.equal((await store.put('tenant-b:business-1', 'memory-facts', 'm1', { tenant_id: 'tenant-b', value: 'B' })).ok, true);
assert.equal((await store.get('tenant-a:business-1', 'memory-facts', 'm1')).value.value, 'A');
assert.equal((await store.get('tenant-b:business-1', 'memory-facts', 'm1')).value.value, 'B');
const conflict = await store.put('tenant-a:business-1', 'memory-facts', 'm1', { value: 'C' }, { expected_revision: 0 });
assert.equal(conflict.error, 'STORE_REVISION_CONFLICT');
assert.equal(await store.put('tenant-a:business-1', 'operator-secrets', 'x', { secret: true }).then((x) => x.error), 'CUSTOMER_STORE_COLLECTION_NOT_ALLOWED');

const collisionDriver = createSupabaseCustomerStoreDriver({
  customer_project_ref: OPERATOR_REF,
  operator_project_ref: OPERATOR_REF,
  synthetic_fixture: true,
  execute_operation: executeOperation
});
assert.equal(collisionDriver.manifest().dedicated_plane_config_ok, false);
const collisionStore = createDedicatedCustomerStoreBinding({ driver: collisionDriver, synthetic_fixture: true });
assert.equal((await collisionStore.put('tenant-a:business-1', 'memory-facts', 'm2', { value: 'X' })).error, 'CUSTOMER_OPERATOR_DATA_PLANE_COLLISION');

console.log(JSON.stringify({
  suite: 'AURENTARA PERSONAL BUSINESS AI DEDICATED CUSTOMER RUNTIME BINDINGS V1',
  status: 'PASS',
  customer_operator_plane_separation_enforced: true,
  operator_project_reuse_rejected: true,
  identity_project_binding_verified: true,
  tenant_membership_enforced: true,
  durable_store_tenant_isolation_verified: true,
  collection_allowlist_verified: true,
  optimistic_revision_conflict_verified: true,
  browser_service_role_key_forbidden: true,
  production_customer_project_provisioned: false,
  real_customer_data: false,
  production_changes: false,
  paid_api_calls: 0,
  variable_cost_eur: 0
}, null, 2));
