import assert from 'node:assert/strict';
import fs from 'node:fs';
import { injectReferenceDrivenHq, referenceDrivenHqManifest } from '../src/operator-reference-hq-v1.js';

const manifest = referenceDrivenHqManifest();
assert.equal(manifest.schema, 'aurentara.project-ferrari.reference-driven-hq.v1');
assert.equal(manifest.reference, 'AURENTARA Masterdashboard im Dark-Mode.png');
assert.deepEqual(manifest.reference_dimensions, [1586, 992]);
assert.equal(manifest.presentation_only, true);
assert.equal(manifest.existing_runtime_truth_reused, true);
assert.equal(manifest.existing_project_identity_reused, true);
assert.equal(manifest.existing_operator_ai_reused, true);
assert.equal(manifest.existing_preview_contract_reused, true);
assert.equal(manifest.project_detail_openable_respected, true);
assert.equal(manifest.repository_only_project_detail_forbidden, true);
assert.equal(manifest.fake_progress_forbidden, true);
assert.equal(manifest.production_deploy, false);
assert.equal(manifest.external_writes, false);
assert.equal(manifest.duplicate_registry, false);
assert.equal(manifest.duplicate_runtime, false);

const base = '<!doctype html><html><body><main>operator</main></body></html>';
const injected = injectReferenceDrivenHq(base);
assert.match(injected, /aurentara-ferrari-reference-hq-v1-style/);
assert.match(injected, /aurentara-ferrari-reference-hq-v1-script/);
assert.match(injected, /PROJECT FERRARI PREMIUM MASTERDASHBOARD V1/);
assert.match(injected, /project_detail_openable===true/);
assert.match(injected, /workspace_enabled===true/);
assert.match(injected, /aurentaraOpenGlobalOperatorAiV1/);
assert.equal((injected.match(/aurentara-ferrari-reference-hq-v1-script/g) || []).length, 1);
assert.equal(injectReferenceDrivenHq(injected), injected, 'injection must remain idempotent');

const entry = fs.readFileSync('src/entry.js', 'utf8');
assert.match(entry, /applyReferenceDrivenHq/);
assert.match(entry, /applyReferenceDrivenHq\(await applyPremiumMasterdashboard\(enhancedOperatorResponse\)\)/);

console.log(JSON.stringify({
  ok: true,
  suite: 'project-ferrari-reference-hq-v1-smoke',
  reference: manifest.reference,
  reference_dimensions: manifest.reference_dimensions,
  presentation_only: true,
  runtime_truth_reused: true,
  project_identity_reused: true,
  operator_ai_reused: true,
  preview_contract_reused: true,
  repository_only_detail_guard: true,
  fake_progress_forbidden: true,
  production_deploy: false,
  external_writes: false
}, null, 2));
