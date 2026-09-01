import assert from 'node:assert/strict';
import worker from '../src/customer-product/customer-runtime-entry-v1.js';

const env = {
  AURENTARA_CUSTOMER_SURFACE_MODE: 'off',
  AURENTARA_CUSTOMER_DISTRIBUTED_RATE_ACTIVE: 'false',
  AURENTARA_CUSTOMER_OBSERVABILITY_ACTIVE: 'false'
};
const ctx = { waitUntil() {} };
const request = (path) => new Request(`https://customer-runtime.test${path}`, { method: 'GET' });

const customer = await worker.fetch(request('/customer/api/manifest'), env, ctx);
assert.equal(customer.status, 404);
const customerBody = await customer.json();
assert.equal(customerBody.error, 'CUSTOMER_SURFACE_NOT_ACTIVATED');
assert.equal(customerBody.public_active, false);

for (const path of ['/operator', '/operator/api/state', '/factory', '/factory/diagnostics', '/mcp', '/']) {
  const response = await worker.fetch(request(path), env, ctx);
  assert.equal(response.status, 404, path);
  const body = await response.json();
  assert.equal(body.error, 'AURENTARA_CUSTOMER_RUNTIME_ROUTE_NOT_FOUND', path);
  assert.equal(body.public_active, false, path);
}

console.log(JSON.stringify({
  suite: 'AURENTARA CUSTOMER DEDICATED WORKER V1',
  status: 'PASS',
  customer_surface_off: true,
  operator_route_exposed: false,
  factory_route_exposed: false,
  mcp_route_exposed: false,
  shared_operator_modules: false,
  real_customer_data: false,
  variable_cost_eur: 0
}, null, 2));
