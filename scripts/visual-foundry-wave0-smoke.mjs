import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { captureRuntimeScreenshot, buildWave0EvidencePack, VISUAL_ACCEPTANCE_NOT_EVALUATED } from '../src/visual-foundry/baseline.js';

const tmp = await mkdtemp(path.join(os.tmpdir(), 'visual-foundry-wave0-'));
const reference = path.join(tmp, 'reference.png');
const runtime = path.join(tmp, 'runtime.png');
const changed = path.join(tmp, 'changed.png');

let mode = 'reference';
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(`<!doctype html><html><body style="margin:0;background:#111;color:white;font-family:Arial"><main style="padding:40px"><h1>${mode === 'reference' ? 'REFERENCE' : 'CHANGED'}</h1><p>Wave 0 deterministic harness</p></main></body></html>`);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const url = `http://127.0.0.1:${port}`;

try {
  const renderEnvironment = await captureRuntimeScreenshot({
    url,
    output_path: reference,
    viewport: { width: 800, height: 600, device_pixel_ratio: 1 }
  });
  await writeFile(runtime, await readFile(reference));

  const exact = await buildWave0EvidencePack({
    project_id: 'synthetic-wave0',
    reference_id: 'synthetic-approved-reference',
    reference_version: '1',
    reference_status: 'APPROVED',
    reference_path: reference,
    runtime_screenshot_path: runtime,
    runtime_url: url,
    commit_sha: 'synthetic',
    render_environment: renderEnvironment
  });
  assert.equal(exact.comparison.status, 'EXACT_BINARY_MATCH');
  assert.equal(exact.visual_acceptance, VISUAL_ACCEPTANCE_NOT_EVALUATED);
  assert.equal(exact.fake_success_prevented, true);

  mode = 'changed';
  await captureRuntimeScreenshot({
    url,
    output_path: changed,
    viewport: { width: 800, height: 600, device_pixel_ratio: 1 }
  });
  const delta = await buildWave0EvidencePack({
    project_id: 'synthetic-wave0',
    reference_id: 'synthetic-approved-reference',
    reference_version: '1',
    reference_status: 'APPROVED',
    reference_path: reference,
    runtime_screenshot_path: changed,
    runtime_url: url,
    commit_sha: 'synthetic',
    render_environment: renderEnvironment
  });
  assert.equal(delta.comparison.status, 'REFERENCE_DIFFERENCE_DETECTED');
  assert.equal(delta.visual_acceptance, VISUAL_ACCEPTANCE_NOT_EVALUATED);

  await assert.rejects(
    buildWave0EvidencePack({ reference_path: path.join(tmp, 'missing.png'), runtime_screenshot_path: runtime }),
    /APPROVED_REFERENCE_MISSING/
  );

  console.log(JSON.stringify({
    ok: true,
    suite: 'visual-foundry-wave0-smoke',
    exact_binary_path: 'PASS',
    difference_detection_path: 'PASS',
    missing_reference_fail_closed: 'PASS',
    visual_acceptance_without_real_comparator: VISUAL_ACCEPTANCE_NOT_EVALUATED,
    production_deploy: false,
    external_writes: false
  }, null, 2));
} finally {
  server.close();
}
