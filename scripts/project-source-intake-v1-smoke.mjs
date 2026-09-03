import assert from 'node:assert/strict';
import {
  createProjectSourceIntakeState,
  registerProjectSource,
  deleteProjectSource,
  upsertProjectFact,
  reviewProjectFact,
  confirmTrustedBaseline,
  registerProjectAsset,
  createContentPack,
  createVisualPack,
  evaluateContentReadiness,
  recordContentReadiness,
  buildProjectMissionContext,
  projectSourceIntakeManifest
} from '../src/project-source-intake-v1.js';

const project = {
  operator_id: 'operator-1',
  customer_id: 'gelato-donatello',
  project_id: 'gelato-donatello-website-v1',
  scope_key: 'gelato-donatello:gelato-donatello-website-v1',
  at: '2026-09-03T15:00:00.000Z'
};

let created = createProjectSourceIntakeState(project);
assert.equal(created.ok, true);
let state = created.state;
assert.equal(state.knowledge_revision, 1);
assert.equal(state.safety.variable_cost_eur, 0);

const crossScope = registerProjectSource(state, {
  customer_id: 'other', project_id: 'project', scope_key: 'other:project', source_type: 'MANUAL_INPUT'
});
assert.equal(crossScope.ok, false);
assert.equal(crossScope.error, 'PROJECT_SOURCE_CROSS_SCOPE_REJECTED');

let result = registerProjectSource(state, {
  source_id: 'src-owned',
  source_type: 'OWNED_WEBSITE',
  locator: 'https://gelato.example/',
  display_name: 'Gelato website',
  ownership_status: 'OWNED_CONFIRMED',
  content_hash: 'html-v1',
  ingestion_status: 'IMPORTED'
}, { at: '2026-09-03T15:01:00.000Z' });
assert.equal(result.ok, true);
state = result.state;
assert.equal(result.source.version, 1);

const duplicate = registerProjectSource(state, {
  source_type: 'OWNED_WEBSITE', locator: 'https://gelato.example/', content_hash: 'html-v1'
});
assert.equal(duplicate.changed, false);
assert.equal(duplicate.duplicate, true);

result = registerProjectSource(state, {
  source_type: 'OWNED_WEBSITE', locator: 'https://gelato.example/', content_hash: 'html-v2', ownership_status: 'OWNED_CONFIRMED'
}, { at: '2026-09-03T15:02:00.000Z' });
assert.equal(result.source.version, 2);
state = result.state;

result = registerProjectSource(state, {
  source_id: 'src-reference', source_type: 'REFERENCE_WEBSITE', locator: 'https://reference.example/', ownership_status: 'OWNED_CONFIRMED'
}, { at: '2026-09-03T15:03:00.000Z' });
state = result.state;
assert.equal(result.source.ownership_status, 'PUBLIC_REFERENCE_ONLY');

const addFact = (input, at) => {
  const added = upsertProjectFact(state, input, { at });
  assert.equal(added.ok, true);
  state = added.state;
  return added.fact;
};

let businessName = addFact({ fact_id: 'fact-name', field_path: 'business.name', value: 'Gelato Donatello', origin: 'MANUAL', verification_status: 'OPERATOR_CONFIRMED', source_refs: ['src-owned'] }, '2026-09-03T15:04:00.000Z');
addFact({ fact_id: 'fact-offerings', field_path: 'business.offerings', value: ['Eis', 'Eistorten'], origin: 'MANUAL', verification_status: 'OPERATOR_CONFIRMED', source_refs: ['src-owned'] }, '2026-09-03T15:05:00.000Z');
addFact({ fact_id: 'fact-goal', field_path: 'website.primary_goal', value: 'Besuche und Anfragen', origin: 'MANUAL', verification_status: 'OPERATOR_CONFIRMED', source_refs: ['src-owned'] }, '2026-09-03T15:06:00.000Z');
addFact({ fact_id: 'fact-summary', field_path: 'content.summary', value: 'Lokales Eiscafé mit handwerklichem Sortiment.', origin: 'MANUAL', verification_status: 'OPERATOR_CONFIRMED', source_refs: ['src-owned'] }, '2026-09-03T15:07:00.000Z');

const evidenceMerge = upsertProjectFact(state, { field_path: 'business.name', value: '  GELATO   DONATELLO ', origin: 'EXTRACTED', source_refs: ['src-reference'] }, { at: '2026-09-03T15:08:00.000Z' });
assert.equal(evidenceMerge.duplicate, true);
assert.deepEqual(evidenceMerge.fact.source_refs.sort(), ['src-owned', 'src-reference']);
state = evidenceMerge.state;

let priceA = addFact({ fact_id: 'fact-price-a', field_path: 'business.pricing', value: '1.50 EUR', origin: 'EXTRACTED', source_refs: ['src-owned'] }, '2026-09-03T15:09:00.000Z');
let priceB = addFact({ fact_id: 'fact-price-b', field_path: 'business.pricing', value: '1.60 EUR', origin: 'EXTRACTED', source_refs: ['src-reference'] }, '2026-09-03T15:10:00.000Z');
assert.equal(priceB.verification_status, 'SOURCE_CONFLICT');
assert.equal(state.facts.find((fact) => fact.fact_id === priceA.fact_id).verification_status, 'SOURCE_CONFLICT');

let readiness = evaluateContentReadiness(state, { will_show_pricing: true, production_locked: true, at: '2026-09-03T15:11:00.000Z' });
assert.equal(readiness.ok, true);
assert.equal(readiness.snapshot.status, 'BLOCKED');
assert.equal(readiness.snapshot.blockers.some((item) => item.code === 'CRITICAL_CONTENT_CONFLICT'), true);

const resolved = reviewProjectFact(state, 'fact-price-b', { verification_status: 'OPERATOR_CONFIRMED', verified_by: 'operator-1' }, { at: '2026-09-03T15:12:00.000Z' });
assert.equal(resolved.ok, true);
state = resolved.state;
assert.equal(state.facts.find((fact) => fact.fact_id === 'fact-price-a').verification_status, 'REJECTED');

const baselineFact = addFact({ fact_id: 'fact-brand', field_path: 'brand.tone', value: 'warm', origin: 'EXTRACTED', source_refs: ['src-owned'], critical: false }, '2026-09-03T15:13:00.000Z');
assert.equal(baselineFact.verification_status, 'UNVERIFIED');
const baseline = confirmTrustedBaseline(state, { at: '2026-09-03T15:14:00.000Z' });
assert.equal(baseline.confirmed_count, 1);
state = baseline.state;

let asset = registerProjectAsset(state, { asset_id: 'asset-owned', source_id: 'src-owned', original_url: 'https://gelato.example/logo.png', mime_type: 'image/png', usage_role: 'LOGO' }, { at: '2026-09-03T15:15:00.000Z' });
assert.equal(asset.asset.rights_status, 'OWNED_CONFIRMED');
assert.equal(asset.asset.publishable, true);
state = asset.state;

asset = registerProjectAsset(state, { asset_id: 'asset-reference', source_id: 'src-reference', original_url: 'https://reference.example/hero.jpg', mime_type: 'image/jpeg', usage_role: 'VISUAL_REFERENCE' }, { at: '2026-09-03T15:16:00.000Z' });
assert.equal(asset.asset.rights_status, 'PUBLIC_REFERENCE_ONLY');
assert.equal(asset.asset.publishable, false);
state = asset.state;

asset = registerProjectAsset(state, { asset_id: 'asset-unknown', original_url: 'https://unknown.example/image.jpg', rights_status: 'UNKNOWN', publishable: true }, { at: '2026-09-03T15:17:00.000Z' });
assert.equal(asset.asset.publishable, false);
state = asset.state;

asset = registerProjectAsset(state, { asset_id: 'asset-derived', parent_asset_id: 'asset-reference', rights_status: 'OWNED_CONFIRMED', publishable: true, transformation: { type: 'crop' } }, { at: '2026-09-03T15:18:00.000Z' });
assert.equal(asset.asset.publishable, false);
state = asset.state;

const contentPackResult = createContentPack(state, { pack_id: 'content-pack-v1', at: '2026-09-03T15:19:00.000Z' });
assert.equal(contentPackResult.ok, true);
const contentPack = contentPackResult.pack;
state = contentPackResult.state;
assert.equal(contentPack.version, 1);
assert.equal(contentPack.canonical_values['business.pricing'], '1.60 EUR');
assert.equal(Object.isFrozen(contentPack), false);
const immutableSnapshot = JSON.stringify(contentPack);

const visualPackResult = createVisualPack(state, { pack_id: 'visual-pack-v1', visual_constraints: ['reference-only assets never publish'], at: '2026-09-03T15:20:00.000Z' });
assert.equal(visualPackResult.ok, true);
const visualPack = visualPackResult.pack;
state = visualPackResult.state;
assert.deepEqual(visualPack.approved_assets.map((item) => item.asset_id), ['asset-owned']);
assert.equal(visualPack.visual_references.some((item) => item.asset_id === 'asset-reference' && item.publishable === false), true);

readiness = recordContentReadiness(state, { will_show_pricing: true, requires_assets: true, intended_asset_ids: ['asset-owned'], production_locked: true, readiness_id: 'readiness-v1', at: '2026-09-03T15:21:00.000Z' });
assert.equal(readiness.ok, true);
assert.equal(readiness.snapshot.status, 'READY_WITH_WARNINGS');
state = readiness.state;

const context = buildProjectMissionContext(state, { content_pack: contentPack, visual_pack: visualPack, readiness: readiness.snapshot });
assert.equal(context.ok, true);
assert.equal(context.context.schema, 'aurentara.project-mission-context.v1');
assert.equal(context.context.project.scope_key, project.scope_key);
assert.equal(context.context.content_pack_ref.version, 1);
assert.equal(context.context.readiness_ref.status, 'READY_WITH_WARNINGS');
assert.equal(context.context.deployment_policy.production_deploy, false);

const changedAfterPack = upsertProjectFact(state, { fact_id: 'fact-story', field_path: 'company.story', value: 'Neue Geschichte', origin: 'MANUAL', verification_status: 'OPERATOR_CONFIRMED', source_refs: ['src-owned'], critical: false }, { at: '2026-09-03T15:22:00.000Z' });
assert.equal(changedAfterPack.ok, true);
state = changedAfterPack.state;
assert.equal(JSON.stringify(contentPack), immutableSnapshot);
assert.notEqual(state.knowledge_revision, contentPack.knowledge_revision);

const badRightsReadiness = evaluateContentReadiness(state, { requires_assets: true, intended_asset_ids: ['asset-unknown'], production_locked: true });
assert.equal(badRightsReadiness.snapshot.status, 'BLOCKED');
assert.equal(badRightsReadiness.snapshot.blockers.some((item) => item.code === 'ASSET_RIGHTS_BLOCKED'), true);

const sourceDelete = deleteProjectSource(state, 'src-reference', { at: '2026-09-03T15:23:00.000Z' });
assert.equal(sourceDelete.ok, true);
assert.equal(sourceDelete.state.sources.find((item) => item.source_id === 'src-reference').deleted_at !== null, true);

const manifest = projectSourceIntakeManifest();
assert.equal(manifest.project_scope_enforced, true);
assert.equal(manifest.critical_conflicts_auto_resolved, false);
assert.equal(manifest.binary_data_in_runtime_json, false);
assert.equal(manifest.paid_provider_calls, 0);
assert.equal(manifest.variable_cost_eur, 0);
assert.equal(manifest.production_deploy, false);

console.log(JSON.stringify({
  ok: true,
  schema: manifest.schema,
  scope_key: project.scope_key,
  knowledge_revision: state.knowledge_revision,
  content_pack_version: contentPack.version,
  visual_pack_version: visualPack.version,
  readiness: readiness.snapshot.status,
  project_isolation: 'PASS',
  provenance: 'PASS',
  conflict_blocking: 'PASS',
  rights_enforcement: 'PASS',
  pack_immutability: 'PASS',
  variable_cost_eur: 0,
  production_deploy: false
}, null, 2));
