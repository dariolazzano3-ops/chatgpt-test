import assert from 'node:assert/strict';
import { createProjectSourceStorageClient, PROJECT_SOURCE_BUCKET } from '../src/project-source-storage-supabase-v1.js';

const env = {
  RIOSYSTEMS_OPERATOR_RUNTIME_SUPABASE_URL: 'https://example.supabase.co',
  RIOSYSTEMS_OPERATOR_RUNTIME_SUPABASE_SERVICE_ROLE_KEY: 'synthetic-secret'
};
const objects = new Map();
const calls = [];
const marker = `/storage/v1/object/${encodeURIComponent(PROJECT_SOURCE_BUCKET)}/`;
const fetcher = async (input, init = {}) => {
  const url = String(input), method = String(init.method || 'GET').toUpperCase();
  calls.push({ url, method });
  if (method === 'POST') {
    const path = decodeURIComponent(url.slice(url.indexOf(marker) + marker.length));
    objects.set(path, new Uint8Array(await new Response(init.body).arrayBuffer()));
    return new Response(JSON.stringify({ Key: `${PROJECT_SOURCE_BUCKET}/${path}` }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (method === 'DELETE') {
    const body = JSON.parse(String(init.body || '{}'));
    for (const path of body.prefixes || []) objects.delete(path);
    return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
  }
  return new Response('not found', { status: 404 });
};
const client = createProjectSourceStorageClient(env, { fetcher });
const a = { operator_id: 'operator:a', customer_id: 'customer-a', project_id: 'project-a', scope_key: 'customer-a:project-a' };
const b = { operator_id: 'operator:a', customer_id: 'customer-b', project_id: 'project-b', scope_key: 'customer-b:project-b' };
const file = (name, text) => { const blob = new Blob([text], { type: 'image/png' }); Object.defineProperty(blob, 'name', { value: name }); return blob; };

const original = await client.upload(file('logo.png', 'v1'), a);
assert.equal(original.ok, true);
const beforeCrossScope = calls.length;
const crossScope = await client.replace(file('logo.png', 'v2'), original.storage_ref, b);
assert.equal(crossScope.ok, false);
assert.equal(crossScope.error, 'PROJECT_SOURCE_STORAGE_CROSS_SCOPE_REJECTED');
assert.equal(calls.length, beforeCrossScope);

const replacement = await client.replace(file('logo.png', 'v2'), original.storage_ref, a);
assert.equal(replacement.ok, true);
assert.equal(replacement.replaces_storage_ref, original.storage_ref);
assert.equal(replacement.previous_object_retained_for_traceability, true);
assert.equal(replacement.blind_overwrite, false);
assert.notEqual(replacement.storage_ref, original.storage_ref);
assert.equal(objects.size, 2);

const removed = await client.remove(original.storage_ref, a);
assert.equal(removed.ok, true);
assert.equal(objects.size, 1);

console.log(JSON.stringify({
  ok: true,
  suite: 'project-source-intake-storage-replace-v1',
  cross_project_replace_denied: true,
  replace_creates_new_storage_ref: true,
  previous_object_retained_for_traceability: true,
  blind_overwrite: false,
  delete_project_scoped: true,
  variable_cost_eur: 0,
  production_deploy: false
}, null, 2));
