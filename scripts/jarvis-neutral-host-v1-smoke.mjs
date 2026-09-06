import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateJarvisNeutralHostV1, jarvisNeutralHostManifestV1 } from '../src/jarvis/host-policy-v1.js';

for (const bad of [
  'legacy-gelato.example.invalid',
  'jarvis-donatello.example.invalid',
  'jarvis.aurentara.example.invalid',
  'jarvis.riosystems.example.invalid',
  'jarvis.hamyren.example.invalid'
]) {
  const result = validateJarvisNeutralHostV1(bad);
  assert.equal(result.ok, false);
  assert.equal(result.error, 'JARVIS_NEUTRAL_HOST_FORBIDDEN_TOKEN');
}

const good = validateJarvisNeutralHostV1('jarvis-private.example.invalid');
assert.equal(good.ok, true);
assert.equal(good.neutral, true);

const wrangler = JSON.parse(fs.readFileSync('wrangler.jarvis-private.jsonc', 'utf8'));
assert.equal(wrangler.workers_dev, false);

const manifest = jarvisNeutralHostManifestV1();
assert.equal(manifest.inherited_workers_dev_account_subdomain_allowed, false);

const sensitiveCurrentTree = [
  '.github/jarvis-private-access-request.json',
  '.github/jarvis-disable-workersdev-request.json',
  '.github/workflows/jarvis-private-access-bootstrap.yml',
  '.github/workflows/jarvis-disable-workersdev.yml'
];
for (const path of sensitiveCurrentTree) {
  assert.equal(fs.existsSync(path), false, path + ' must be removed from current tree');
}

console.log('JARVIS Neutral Host Policy V1 smoke: PASS');
