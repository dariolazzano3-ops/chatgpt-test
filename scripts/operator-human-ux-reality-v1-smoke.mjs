import assert from 'node:assert/strict';
import fs from 'node:fs';
import { operatorHumanUxSealManifest } from '../src/operator-human-ux-seal-v1.js';
import { operatorHumanUxFinalManifest } from '../src/operator-human-ux-final-v1.js';

const seal = operatorHumanUxSealManifest();
const final = operatorHumanUxFinalManifest();
const source = fs.readFileSync(new URL('../src/operator-human-ux-seal-v1.js', import.meta.url), 'utf8');
const finalSource = fs.readFileSync(new URL('../src/operator-human-ux-final-v1.js', import.meta.url), 'utf8');
const entry = fs.readFileSync(new URL('../src/entry.js', import.meta.url), 'utf8');

assert.equal(seal.presentation_only, true);
assert.equal(seal.same_control_plane, true);
assert.equal(seal.core_logic_changed, false);
assert.equal(seal.api_contract_changed, false);
assert.equal(seal.human_summary_first, true);
assert.equal(seal.raw_evidence_preserved_secondary, true);
assert.equal(seal.canonical_human_language, 'de');
assert.equal(seal.project_creation_secondary, true);
assert.equal(seal.human_event_titles_first, true);
assert.equal(seal.provider_truth_fail_closed, true);
assert.equal(seal.factory_truth_fail_closed, true);
assert.equal(seal.health_dimensions_separated, true);
assert.equal(seal.settings_presented_as_read_only_policies, true);
assert.equal(final.direct_project_render_path_sealed, true);
assert.equal(final.direct_project_detail_render_path_sealed, true);
assert.equal(final.direct_audit_render_path_sealed, true);
assert.equal(final.project_delivery_human_summary_first, true);
assert.equal(final.raw_evidence_preserved, true);

for (const value of [seal, final]) {
  assert.equal(value.production_deploy, false);
  assert.equal(value.external_writes, false);
  assert.equal(value.real_customer_data, false);
  assert.equal(value.additional_variable_cost_eur, 0);
}

for (const marker of [
  'Human Summary zuerst',
  'Technische Details / Raw Evidence',
  'Neues Projekt anlegen',
  'Keine Freigaben erforderlich',
  'Missionsplan gespeichert',
  'Synthetische Mission abgeschlossen',
  "settings:['Richtlinien'",
  "costs:['Kosten'",
  "providers:['Provider'",
  "health:['Systemstatus'",
  'Runtime Health',
  'Staging Verification',
  'Activation Readiness',
  "kv('Production State','DISABLED')",
  'CREDENTIAL REQUIRED',
  'BUDGET GATE',
  'PERMISSION GATE',
  'STAGING VERIFIED',
  'Noch kein verifizierter Run',
  'Noch keine Provider-Evidence',
  'Qualität noch nicht gemessen'
]) assert.match(source, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

assert.ok(source.indexOf('Human Summary zuerst') < source.indexOf('Technische Details / Raw Evidence'));
assert.match(finalSource, /Projekt auf einen Blick/);
assert.match(finalSource, /Unified Delivery Summary/);
assert.match(finalSource, /Technische Details \/ Raw Evidence/);
assert.ok(finalSource.indexOf('Unified Delivery Summary') < finalSource.indexOf('Technische Details / Raw Evidence'));
assert.match(entry, /operator-human-ux-final-v1\.js/);
assert.doesNotMatch(source, /\bMake\b|Activepieces/i);
assert.doesNotMatch(finalSource, /\bMake\b|Activepieces/i);

console.log(JSON.stringify({
  ok: true,
  suite: 'operator-human-ux-reality-v1',
  human_summary_first: true,
  raw_evidence_secondary: true,
  project_create_secondary: true,
  human_event_titles: true,
  german_human_ui: true,
  provider_truth_fail_closed: true,
  factory_truth_fail_closed: true,
  health_dimensions_separated: true,
  production_deploy: false,
  external_writes: false,
  real_customer_data: false,
  additional_variable_cost_eur: 0
}, null, 2));