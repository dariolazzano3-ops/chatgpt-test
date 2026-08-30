import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildWebsiteProject,
  deriveFramerProviderStatus,
  evaluateVisualFidelity,
  framerFreeActivationChecklist,
  interpretVisualDesign,
  reconstructPremiumWebsite,
  runScreenshotComparison,
  runVisualRepairLoop,
  selectWebBuildRoute,
  validateAssetRights,
  validateVisualDesignContract,
  webFactoryProviderManifest,
  webProviderRoleModel
} from '../src/web-factory/index.js';

const fixture = JSON.parse(await readFile(new URL('../fixtures/web-factory/premium-architecture-studio.json', import.meta.url), 'utf8'));
const bakery = JSON.parse(await readFile(new URL('../fixtures/web-factory/bakery-muller.json', import.meta.url), 'utf8'));

const roles = webProviderRoleModel();
const byProvider = new Map(roles.providers.map((provider) => [provider.provider_id, provider]));
assert.equal(byProvider.get('riosystems-native-web-builder').role, 'native_builder');
assert.equal(byProvider.get('framer').role, 'visual_specialist');
assert.equal(byProvider.get('webflow').role, 'cms_specialist');
assert.equal(byProvider.get('lovable').role, 'rapid_prototyper');
assert.equal(byProvider.get('cloudflare').role, 'hosting_provider');
assert.equal(roles.rules.framer_default_hosting, false);

const contract = validateVisualDesignContract(fixture.design_contract);
assert.equal(contract.ok, true);
assert.equal(contract.asset_rights.status, 'PASS');

const blockedRights = validateAssetRights([{
  asset_id: 'mystery-template',
  source: 'unknown',
  license_status: 'unknown',
  ownership: 'unknown',
  allowed_for_reimplementation: false,
  replacement_required: false
}]);
assert.equal(blockedRights.status, 'BLOCKED');
assert.equal(blockedRights.fail_closed, true);

const interpreted = interpretVisualDesign(fixture.design_contract);
assert.equal(interpreted.ok, true);
assert.equal(interpreted.structured_spec.constraints.raw_provider_html_allowed, false);
assert.equal(interpreted.structured_spec.constraints.proprietary_code_extraction_allowed, false);
assert.ok(interpreted.structured_spec.interactions.deviations.some((item) => item.type === 'scroll_reveal'));

const route = selectWebBuildRoute(fixture.routing_context);
assert.equal(route.selected.route_id, 'framer-design-native-cloudflare');
assert.equal(route.selected.design_provider, 'framer');
assert.equal(route.selected.build_provider, 'riosystems-native-web-builder');
assert.equal(route.selected.hosting_provider, 'cloudflare');
assert.equal(route.selected.constraints.framer_hosting_default, false);
assert.equal(route.selected.cost_metadata.estimated_build_cost, 0);
assert.equal(route.selected.cost_metadata.estimated_monthly_provider_cost, 0);

const premium = reconstructPremiumWebsite(fixture, {
  now: '2026-08-30T12:00:00.000Z',
  fidelity_level: 'PREMIUM',
  max_visual_repair_attempts: 3
});
if (!premium.ok) {
  console.error(JSON.stringify({
    diagnostic: 'premium_reconstruction_failed',
    status: premium.status,
    base_status: premium.base_build?.status || null,
    website_qa: premium.website_qa || null,
    visual_fidelity: premium.visual_fidelity || null,
    asset_rights: premium.asset_rights || null
  }, null, 2));
}
assert.equal(premium.ok, true);
assert.equal(premium.status, 'VERIFIED_PREMIUM_WEB_DELIVERABLE');
assert.equal(premium.website_qa.status, 'PASS');
assert.equal(premium.visual_fidelity.status, 'PASS');
assert.ok(premium.visual_fidelity.visual_fidelity_score >= 93);
assert.equal(premium.visual_fidelity.pixel_comparison_executed, false);
assert.equal(premium.visual_fidelity.no_fake_score, true);
assert.ok(premium.visual_fidelity.unverified_properties.includes('pixel_similarity'));
assert.equal(premium.delivery_manifest.visual_design.provider_runtime_dependency, false);
assert.equal(premium.delivery_manifest.hosting_policy.preferred, 'cloudflare');
assert.equal(premium.delivery_manifest.hosting_policy.framer_hosting_default, false);
assert.equal(premium.delivery_manifest.production_deploy, false);
assert.equal(premium.variable_cost_eur, 0);
assert.equal(premium.asset_rights.status, 'PASS');
assert.ok(premium.delivery_manifest.design_deviations.some((item) => item.type === 'scroll_reveal'));
assert.ok(premium.artifact.files[`${premium.artifact.project_root}/structured-design-spec.json`]);
assert.ok(premium.artifact.files[`${premium.artifact.project_root}/visual-fidelity-report.json`]);
assert.ok(premium.artifact.files[`${premium.artifact.project_root}/screenshot-comparison-job.json`]);
assert.ok(premium.artifact.files[`${premium.artifact.project_root}/provider-route.json`]);

const tamperedImplementation = structuredClone(premium.artifact.visual_implementation);
tamperedImplementation.layout.container_width = '110rem';
tamperedImplementation.spacing.section = '1rem';
const tamperedArtifact = { ...premium.artifact, files: { ...premium.artifact.files } };
const repair = runVisualRepairLoop(
  { artifact: tamperedArtifact, implementation: tamperedImplementation },
  interpreted.structured_spec,
  { level: 'PREMIUM', max_attempts: 3 }
);
assert.equal(repair.fidelity_report.status, 'PASS');
assert.ok(repair.repair_history.length >= 1);
assert.equal(repair.implementation.layout.container_width, interpreted.structured_spec.layout.container_width);
assert.match(repair.artifact.files[`${premium.artifact.project_root}/assets/styles.css`], /--container:80rem/);

const highFidelityWithoutPixels = evaluateVisualFidelity(
  interpreted.structured_spec,
  premium.artifact.visual_implementation,
  { level: 'HIGH_FIDELITY' }
);
assert.equal(highFidelityWithoutPixels.status, 'FAIL');
assert.ok(highFidelityWithoutPixels.blocking_differences.some((item) => item.code === 'SCREENSHOT_EVIDENCE_REQUIRED_FOR_HIGH_FIDELITY'));

const screenshot = await runScreenshotComparison(premium.screenshot_comparison.job);
assert.equal(screenshot.status, 'NOT_EXECUTED_RUNTIME_UNAVAILABLE');
assert.equal(screenshot.executed, false);
assert.equal(screenshot.pixel_comparison_claimed, false);

assert.equal(deriveFramerProviderStatus({}).status, 'not_configured');
assert.equal(deriveFramerProviderStatus({ free_plan_ready: true }).status, 'free_ready');
assert.equal(deriveFramerProviderStatus({ connection_verified: true }).status, 'connected');
assert.equal(deriveFramerProviderStatus({ design_verified: true }).status, 'design_verified');
assert.equal(deriveFramerProviderStatus({ paid_required: true }).status, 'paid_required');
const checklist = framerFreeActivationChecklist({});
assert.equal(checklist.target_plan, 'free');
assert.equal(checklist.paid_activation_allowed, false);
assert.equal(checklist.repository_credentials_allowed, false);

const bakeryBuild = buildWebsiteProject(bakery, { now: '2026-08-30T12:00:00.000Z' });
assert.equal(bakeryBuild.ok, true);
assert.equal(bakeryBuild.qa_result.status, 'PASS');
assert.equal(bakeryBuild.production_deploy, false);
assert.equal(bakeryBuild.variable_cost_eur, 0);

const manifest = webFactoryProviderManifest();
assert.equal(manifest.roles.framer, 'visual_specialist');
assert.deepEqual(manifest.premium_visual_path, ['framer', 'riosystems-native-web-builder', 'cloudflare']);
assert.equal(manifest.framer_hosting_default, false);

console.log(JSON.stringify({
  ok: true,
  suite: 'web-factory-framer-visual-fidelity-v1',
  premium_reference: fixture.mission.business_name,
  premium_pages: premium.artifact.pages.length,
  website_qa: premium.website_qa.status,
  structured_visual_fidelity: premium.visual_fidelity.visual_fidelity_score,
  pixel_comparison_executed: premium.visual_fidelity.pixel_comparison_executed,
  visual_repair_attempts_verified: repair.repair_history.length,
  framer_provider_status_without_connection: deriveFramerProviderStatus({}).status,
  bakery_regression: bakeryBuild.qa_result.status,
  variable_cost_eur: premium.variable_cost_eur,
  production_deploy: premium.production_deploy
}, null, 2));
