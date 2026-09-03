import assert from 'node:assert/strict';
import {
  createProjectSourceIntakeState,
  registerProjectSource,
  updateProjectSourceWebsiteUsage,
  projectWebsiteUsage,
  effectiveProjectWebsiteUsage,
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
import { adaptProjectContextToWebMission } from '../src/web-factory/project-context-adapter-v1.js';
import { evaluateReferenceOriginality, screenshotToDesignSpecManifest } from '../src/web-factory/reference-intelligence.js';

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
assert.equal(state.safety.external_writes, false);
assert.equal(state.safety.production_deploy, false);

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
assert.deepEqual(projectWebsiteUsage(result.source).usage, { content: true, structure_reference: false, design_reference: false });
assert.equal(projectWebsiteUsage(result.source).usage_state, 'LEGACY_OWNED_CONTENT_DEFAULT');
assert.deepEqual(effectiveProjectWebsiteUsage(result.source).effective_usage, { content: true, structure_reference: false, design_reference: false });

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
assert.deepEqual(projectWebsiteUsage(result.source).usage, { content: false, structure_reference: false, design_reference: false });
assert.equal(projectWebsiteUsage(result.source).usage_state, 'LEGACY_USAGE_UNSPECIFIED');

const refBeforeEdit = structuredClone(result.source);
const revisionBeforeUsageEdit = { knowledge: state.knowledge_revision, record: state.record_revision };
const usageEdited = updateProjectSourceWebsiteUsage(state, 'src-reference', {
  scope_key: project.scope_key,
  website_usage: { content: true, structure_reference: true, design_reference: true }
}, { at: '2026-09-03T15:03:30.000Z' });
assert.equal(usageEdited.ok, true);
assert.equal(usageEdited.changed, true);
state = usageEdited.state;
assert.equal(state.knowledge_revision, revisionBeforeUsageEdit.knowledge + 1);
assert.equal(state.record_revision, revisionBeforeUsageEdit.record + 1);
assert.equal(usageEdited.source.source_id, refBeforeEdit.source_id);
assert.equal(usageEdited.source.locator, refBeforeEdit.locator);
assert.equal(usageEdited.source.storage_ref, refBeforeEdit.storage_ref);
assert.equal(usageEdited.source.content_hash, refBeforeEdit.content_hash);
assert.equal(usageEdited.source.version, refBeforeEdit.version);
assert.deepEqual(usageEdited.source.website_usage, { content: true, structure_reference: true, design_reference: true });
assert.deepEqual(usageEdited.source.effective_usage, { content: false, structure_reference: true, design_reference: true });
assert.equal(state.audit.at(-1).event, 'PROJECT_SOURCE_WEBSITE_USAGE_UPDATED');
const crossScopeUsage = updateProjectSourceWebsiteUsage(state, 'src-reference', { scope_key: 'other:project', website_usage: { design_reference: false } });
assert.equal(crossScopeUsage.ok, false);
assert.equal(crossScopeUsage.error, 'PROJECT_SOURCE_CROSS_SCOPE_REJECTED');

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
addFact({ fact_id: 'fact-reference-copy', field_path: 'content.reference_only_copy', value: 'Do not use as publishable copy', origin: 'EXTRACTED', verification_status: 'OPERATOR_CONFIRMED', source_refs: ['src-reference'], critical: false }, '2026-09-03T15:07:30.000Z');

const evidenceMerge = upsertProjectFact(state, { field_path: 'business.name', value: '  GELATO   DONATELLO ', origin: 'EXTRACTED', source_refs: ['src-reference'] }, { at: '2026-09-03T15:08:00.000Z' });
assert.equal(evidenceMerge.duplicate, true);
assert.deepEqual(evidenceMerge.fact.source_refs.sort(), ['src-owned', 'src-reference']);
state = evidenceMerge.state;

let priceA = addFact({ fact_id: 'fact-price-a', field_path: 'business.pricing', value: '1.50 EUR', origin: 'EXTRACTED', source_refs: ['src-owned'] }, '2026-09-03T15:09:00.000Z');
let priceB = addFact({ fact_id: 'fact-price-b', field_path: 'business.pricing', value: '1.60 EUR', origin: 'EXTRACTED', source_refs: ['src-reference'] }, '2026-09-03T15:10:00.000Z');
assert.notEqual(priceB.verification_status, 'SOURCE_CONFLICT');
let priceC = addFact({ fact_id: 'fact-price-c', field_path: 'business.pricing', value: '1.70 EUR', origin: 'EXTRACTED', source_refs: ['src-owned'] }, '2026-09-03T15:10:30.000Z');
assert.equal(priceC.verification_status, 'SOURCE_CONFLICT');
assert.equal(state.facts.find((fact) => fact.fact_id === priceA.fact_id).verification_status, 'SOURCE_CONFLICT');

let readiness = evaluateContentReadiness(state, { will_show_pricing: true, production_locked: true, at: '2026-09-03T15:11:00.000Z' });
assert.equal(readiness.ok, true);
assert.equal(readiness.snapshot.status, 'BLOCKED');
assert.equal(readiness.snapshot.blockers.some((item) => item.code === 'CRITICAL_CONTENT_CONFLICT'), true);

const resolved = reviewProjectFact(state, 'fact-price-c', { verification_status: 'OPERATOR_CONFIRMED', verified_by: 'operator-1' }, { at: '2026-09-03T15:12:00.000Z' });
assert.equal(resolved.ok, true);
state = resolved.state;
assert.equal(state.facts.find((fact) => fact.fact_id === 'fact-price-a').verification_status, 'REJECTED');
assert.equal(state.facts.find((fact) => fact.fact_id === 'fact-price-b').verification_status, 'UNVERIFIED');

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

result = registerProjectSource(state, { source_id: 'src-image', source_type: 'IMAGE_VISUAL', locator: 'private://gelato/image', ownership_status: 'OWNED_CONFIRMED' }, { at: '2026-09-03T15:16:30.000Z' });
assert.equal(result.ok, true);
state = result.state;
asset = registerProjectAsset(state, { asset_id: 'asset-project-image', source_id: 'src-image', original_url: 'https://gelato.example/project-image.jpg', mime_type: 'image/jpeg', usage_role: 'GALLERY' }, { at: '2026-09-03T15:16:45.000Z' });
assert.equal(asset.asset.publishable, true);
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
assert.equal(contentPack.canonical_values['business.pricing'], '1.70 EUR');
assert.equal(contentPack.canonical_values['content.reference_only_copy'], undefined);
assert.equal(Object.isFrozen(contentPack), false);
const immutableSnapshot = JSON.stringify(contentPack);

const visualPackResult = createVisualPack(state, { pack_id: 'visual-pack-v1', visual_constraints: ['reference-only assets never publish'], at: '2026-09-03T15:20:00.000Z' });
assert.equal(visualPackResult.ok, true);
const visualPack = visualPackResult.pack;
state = visualPackResult.state;
assert.deepEqual(visualPack.approved_assets.map((item) => item.asset_id), ['asset-project-image']);
assert.equal(visualPack.approved_assets.some((item) => item.asset_id === 'asset-owned'), false);
assert.equal(visualPack.brand_information['brand.tone'], undefined);
assert.equal(visualPack.visual_references.some((item) => item.asset_id === 'asset-reference' && item.publishable === false), true);

readiness = recordContentReadiness(state, { will_show_pricing: true, requires_assets: true, intended_asset_ids: ['asset-project-image'], production_locked: true, readiness_id: 'readiness-v1', at: '2026-09-03T15:21:00.000Z' });
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
const ownedWebsiteContext = context.context.website_sources.find((source) => source.source_id === 'src-owned');
const referenceWebsiteContext = context.context.website_sources.find((source) => source.source_id === 'src-reference');
assert.deepEqual(ownedWebsiteContext.effective_usage, { content: true, structure_reference: false, design_reference: false });
assert.deepEqual(referenceWebsiteContext.effective_usage, { content: false, structure_reference: true, design_reference: true });
const webMission = adaptProjectContextToWebMission(context.context, {});
assert.equal(webMission.ok, true);
assert.equal(webMission.mission.reference_sites.includes('https://reference.example/'), true);
assert.equal(webMission.mission.reference_sites.includes('https://gelato.example/'), false);
assert.equal(webMission.mission.structure_reference_sites.includes('https://reference.example/'), true);
assert.equal(webMission.mission.structure_reference_sites.includes('https://gelato.example/'), false);
assert.equal(webMission.mission.approved_project_assets.some((item) => item.source_id === 'src-reference'), false);
assert.equal(webMission.mission.website_reference_policy.content_copy_allowed, false);
assert.equal(webMission.mission.website_reference_policy.publishable_reference_assets, false);
assert.equal(webMission.mission.website_reference_policy.logo_clone_allowed, false);
assert.equal(webMission.mission.website_reference_policy.pixel_clone_allowed, false);
assert.equal(screenshotToDesignSpecManifest().pixel_clone_allowed, false);
const originality = evaluateReferenceOriginality([{
  reference_id: 'premium-reference',
  elements: [
    { element_id: 'foreign-logo', element_type: 'logo', rights_status: 'public_reference_only', allowed_for_reimplementation: false },
    { element_id: 'foreign-copy', element_type: 'copy', rights_status: 'public_reference_only', allowed_for_reimplementation: false },
    { element_id: 'layout-principle', element_type: 'generic_design_principle', rights_status: 'public_reference_only', allowed_for_reimplementation: false }
  ]
}]);
assert.equal(originality.blind_pixel_clone, false);
assert.equal(originality.high_fidelity_overrides_rights, false);
assert.equal(originality.replacement_required.some((item) => item.element_type === 'logo'), true);
assert.equal(originality.replacement_required.some((item) => item.element_type === 'copy'), true);
assert.equal(originality.replacement_required.some((item) => item.element_type === 'generic_design_principle'), false);

const changedAfterPack = upsertProjectFact(state, { fact_id: 'fact-story', field_path: 'company.story', value: 'Neue Geschichte', origin: 'MANUAL', verification_status: 'OPERATOR_CONFIRMED', source_refs: ['src-owned'], critical: false }, { at: '2026-09-03T15:22:00.000Z' });
assert.equal(changedAfterPack.ok, true);
state = changedAfterPack.state;
assert.equal(JSON.stringify(contentPack), immutableSnapshot);
assert.notEqual(state.knowledge_revision, contentPack.knowledge_revision);

const ownedWebsiteDesignBlocked = evaluateContentReadiness(state, { requires_assets: true, intended_asset_ids: ['asset-owned'], production_locked: true });
assert.equal(ownedWebsiteDesignBlocked.snapshot.blockers.some((item) => item.code === 'ASSET_USAGE_BLOCKED'), true);

const badRightsReadiness = evaluateContentReadiness(state, { requires_assets: true, intended_asset_ids: ['asset-unknown'], production_locked: true });
assert.equal(badRightsReadiness.snapshot.status, 'BLOCKED');
assert.equal(badRightsReadiness.snapshot.blockers.some((item) => item.code === 'ASSET_RIGHTS_BLOCKED'), true);

let referenceOnlyState = createProjectSourceIntakeState({
  operator_id: 'operator-1',
  customer_id: 'reference-only',
  project_id: 'reference-only-v1',
  scope_key: 'reference-only:reference-only-v1',
  at: '2026-09-03T15:22:30.000Z'
}).state;
let referenceOnlySource = registerProjectSource(referenceOnlyState, {
  source_id: 'reference-design-source',
  source_type: 'REFERENCE_WEBSITE',
  locator: 'https://premium-reference.example/',
  website_usage: { content: false, structure_reference: true, design_reference: true }
});
referenceOnlyState = referenceOnlySource.state;
for (const [fact_id, field_path, value] of [
  ['ref-name', 'business.name', 'Reference Name'],
  ['ref-offer', 'business.offerings', ['Reference Offer']],
  ['ref-goal', 'website.primary_goal', 'Reference Goal'],
  ['ref-summary', 'content.summary', 'Reference summary']
]) {
  const added = upsertProjectFact(referenceOnlyState, { fact_id, field_path, value, origin: 'EXTRACTED', verification_status: 'OPERATOR_CONFIRMED', source_refs: ['reference-design-source'] });
  referenceOnlyState = added.state;
}
const referenceOnlyReadiness = evaluateContentReadiness(referenceOnlyState, { production_locked: true });
assert.equal(referenceOnlyReadiness.snapshot.status, 'BLOCKED');
assert.equal(referenceOnlyReadiness.snapshot.blockers.some((item) => item.code === 'BUSINESS_IDENTITY_REQUIRED'), true);

const sourceDelete = deleteProjectSource(state, 'src-reference', { at: '2026-09-03T15:23:00.000Z' });
assert.equal(sourceDelete.ok, true);
assert.equal(sourceDelete.state.sources.find((item) => item.source_id === 'src-reference').deleted_at !== null, true);

const manifest = projectSourceIntakeManifest();
assert.equal(manifest.project_scope_enforced, true);
assert.equal(manifest.critical_conflicts_auto_resolved, false);
assert.equal(manifest.website_usage_effective_rights_matrix, true);
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
  website_purpose_matrix: 'PASS',
  content_usage_filtering: 'PASS',
  visual_usage_filtering: 'PASS',
  structure_design_reference_separation: 'PASS',
  pack_immutability: 'PASS',
  variable_cost_eur: 0,
  production_deploy: false
}, null, 2));
