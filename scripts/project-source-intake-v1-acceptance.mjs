import assert from 'node:assert/strict';
import {
  openProjectSourceWorkspace,
  intakeManualSource,
  intakeFileSource,
  intakeImageSource,
  buildWorkspacePacksAndReadiness
} from '../src/project-source-workspace-intake-v1.js';
import { importProjectWebsiteSource } from '../src/project-source-website-import-v1.js';
import { compileProjectMissionContext } from '../src/project-mission-context-v1.js';
import { compileMissionPackage } from '../src/mission-compiler.js';
import { evaluateMissionActivation } from '../src/mission-activation-gate.js';
import { executeWebFactoryTask } from '../src/web-factory/adapter.js';
import { runWebsiteQa } from '../src/web-factory/qa.js';

function response(status, body = '', headers = {}) {
  const normalized = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), String(value)]));
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (key) => normalized[String(key).toLowerCase()] ?? null },
    text: async () => String(body),
    json: async () => JSON.parse(String(body))
  };
}

const publicResolver = async () => ['93.184.216.34'];
const html = `<!doctype html><html><head><title>Gelato Donatello</title><meta name="description" content="Gelato Donatello in Saarbrücken mit handwerklichem Eis und Eistorten."><meta name="viewport" content="width=device-width"></head><body><h1>Gelato Donatello</h1><h2>Eis und Eistorten</h2><p>${'Handwerkliches Eis für Gäste aus Saarbrücken. '.repeat(12)}</p></body></html>`;

// Security: robots must be checked before the root page, with bounded same-origin reads.
{
  const calls = [];
  const fetcher = async (input) => {
    const url = new URL(String(input));
    calls.push(url.toString());
    if (url.pathname === '/robots.txt') return response(200, 'User-agent: *\nDisallow:\n', { 'content-type': 'text/plain' });
    if (url.pathname === '/') return response(200, html, { 'content-type': 'text/html' });
    return response(404, '');
  };
  const imported = await importProjectWebsiteSource({ source_url: 'https://gelato.example/', max_pages: 1 }, { fetcher, resolveHostname: publicResolver });
  assert.equal(imported.ok, true);
  assert.equal(calls[0], 'https://gelato.example/robots.txt');
  assert.equal(imported.pages_analyzed, 1);
  assert.equal(imported.variable_cost_eur, 0);
  assert.equal(imported.paid_provider_calls, 0);
  assert.equal(imported.production_deploy, false);
}

// Security: robots disallow blocks before the root request.
{
  const calls = [];
  const fetcher = async (input) => { calls.push(String(input)); return response(200, 'User-agent: *\nDisallow: /\n', { 'content-type': 'text/plain' }); };
  const imported = await importProjectWebsiteSource({ source_url: 'https://blocked.example/' }, { fetcher, resolveHostname: publicResolver });
  assert.equal(imported.ok, false);
  assert.equal(imported.error, 'ROBOTS_DISALLOWS_IMPORT');
  assert.deepEqual(calls, ['https://blocked.example/robots.txt']);
}

// Security: literal metadata/private targets and DNS rebinding-to-private are blocked before site fetch.
{
  let called = false;
  const fetcher = async () => { called = true; return response(500); };
  const literal = await importProjectWebsiteSource({ source_url: 'http://169.254.169.254/latest/meta-data' }, { fetcher, resolveHostname: publicResolver });
  assert.equal(literal.ok, false);
  assert.equal(called, false);
  const dnsPrivate = await importProjectWebsiteSource({ source_url: 'https://private.example/' }, { fetcher, resolveHostname: async () => ['10.0.0.7'] });
  assert.equal(dnsPrivate.ok, false);
  assert.equal(dnsPrivate.error, 'DNS_PRIVATE_TARGET_BLOCKED');
  assert.equal(called, false);
}

// Security: a cross-origin redirect target is validated but never handed to the underlying site fetcher.
{
  const calls = [];
  const fetcher = async (input) => {
    const url = new URL(String(input)); calls.push(url.toString());
    if (url.pathname === '/robots.txt') return response(404, '');
    if (url.hostname === 'source.example') return response(302, '', { location: 'https://redirected.example/private' });
    throw new Error('cross-origin target must not reach underlying fetcher');
  };
  const imported = await importProjectWebsiteSource({ source_url: 'https://source.example/' }, { fetcher, resolveHostname: publicResolver });
  assert.equal(imported.ok, false);
  assert.equal(calls.some((url) => url.startsWith('https://redirected.example/')), false);
}

// GELATO FIRST RUN: realistic project Source Intake only, no Website Mission and 0 EUR.
let gelato = openProjectSourceWorkspace({
  operator_id: 'operator-dario',
  customer_id: 'gelato-donatello',
  project_id: 'source-intake-v1',
  scope_key: 'gelato-donatello:source-intake-v1',
  at: '2026-09-03T16:00:00.000Z'
});
assert.equal(gelato.ok, true);
let gelatoState = gelato.state;

let intake = intakeManualSource(gelatoState, {
  source_id: 'gelato-manual-approved',
  display_name: 'Gelato Donatello approved project facts',
  ownership_status: 'CUSTOMER_ASSERTED',
  facts: [
    { fact_id: 'gelato-name', field_path: 'business.name', value: 'Gelato Donatello', verification_status: 'OPERATOR_CONFIRMED' },
    { fact_id: 'gelato-offerings', field_path: 'business.offerings', value: ['Handwerkliches Eis', 'Eistorten', 'Eisvitrine Vermietung'], verification_status: 'OPERATOR_CONFIRMED' },
    { fact_id: 'gelato-goal', field_path: 'website.primary_goal', value: 'Sortiment verständlich präsentieren und qualifizierte Anfragen ermöglichen', verification_status: 'OPERATOR_CONFIRMED' },
    { fact_id: 'gelato-summary', field_path: 'content.summary', value: 'Gelato Donatello ist ein lokales Eisprojekt mit Eis, Eistorten und Vermietangebot.', verification_status: 'OPERATOR_CONFIRMED', critical: false },
    { fact_id: 'gelato-tone', field_path: 'brand.tone', value: 'hochwertig, warm, klar', verification_status: 'OPERATOR_CONFIRMED', critical: false }
  ]
}, { at: '2026-09-03T16:01:00.000Z' });
assert.equal(intake.ok, true); gelatoState = intake.state;

intake = intakeFileSource(gelatoState, {
  source_id: 'gelato-menu-pdf',
  filename: 'gelato-sortiment.pdf',
  storage_ref: 'operator-private://gelato-donatello/source-intake-v1/gelato-sortiment.pdf',
  mime_type: 'application/pdf',
  ownership_status: 'CUSTOMER_ASSERTED',
  content_hash: 'sha256:gelato-pdf-fixture'
}, { at: '2026-09-03T16:02:00.000Z' });
assert.equal(intake.ok, true);
assert.equal(intake.parser_status, 'PARSER_DEFERRED_V1');
assert.equal(intake.binary_in_runtime_json, false); gelatoState = intake.state;

intake = intakeImageSource(gelatoState, {
  source_id: 'gelato-logo-source',
  asset_id: 'gelato-logo',
  filename: 'gelato-logo.png',
  storage_ref: 'operator-private://gelato-donatello/source-intake-v1/gelato-logo.png',
  mime_type: 'image/png',
  ownership_status: 'OWNED_CONFIRMED',
  rights_status: 'OWNED_CONFIRMED',
  usage_role: 'LOGO',
  publishable: true,
  content_hash: 'sha256:gelato-logo-fixture'
}, { at: '2026-09-03T16:03:00.000Z' });
assert.equal(intake.ok, true);
assert.equal(intake.asset.publishable, true); gelatoState = intake.state;

const gelatoPacks = buildWorkspacePacksAndReadiness(gelatoState, {
  requires_assets: true,
  intended_asset_ids: ['gelato-logo']
}, {
  content_pack_id: 'gelato-content-pack-v1',
  visual_pack_id: 'gelato-visual-pack-v1',
  readiness_id: 'gelato-readiness-v1',
  at: '2026-09-03T16:04:00.000Z'
});
assert.equal(gelatoPacks.ok, true);
assert.notEqual(gelatoPacks.readiness.status, 'BLOCKED');
assert.equal(gelatoPacks.variable_cost_eur, 0);
assert.equal(gelatoPacks.paid_provider_calls, 0);
assert.equal(gelatoPacks.production_deploy, false);
const gelatoContext = compileProjectMissionContext(gelatoPacks.state, {
  content_pack: gelatoPacks.content_pack,
  visual_pack: gelatoPacks.visual_pack,
  readiness: gelatoPacks.readiness
});
assert.equal(gelatoContext.ok, true);
assert.equal(gelatoContext.context.content_provenance.every((item) => item.source_refs.length > 0), true);
assert.equal('website_mission' in gelatoPacks, false);

// Integration fixture: context survives compiler -> riosystems.web-mission.v1 -> existing Web Factory -> central runWebsiteQa.
let fixture = openProjectSourceWorkspace({ operator_id: 'operator-test', customer_id: 'integration-fixture', project_id: 'web-context-v1', scope_key: 'integration-fixture:web-context-v1' });
let fixtureState = fixture.state;
intake = intakeManualSource(fixtureState, {
  source_id: 'fixture-approved',
  facts: [
    { fact_id: 'fixture-name', field_path: 'business.name', value: 'Project Context Fixture', verification_status: 'OPERATOR_CONFIRMED' },
    { fact_id: 'fixture-services', field_path: 'business.services', value: ['Beratung', 'Umsetzung'], verification_status: 'OPERATOR_CONFIRMED' },
    { fact_id: 'fixture-goal', field_path: 'website.primary_goal', value: 'Qualifizierte Anfragen', verification_status: 'OPERATOR_CONFIRMED' },
    { fact_id: 'fixture-summary', field_path: 'content.summary', value: 'Eine kontrollierte Integration des freigegebenen Project Content Packs.', verification_status: 'OPERATOR_CONFIRMED', critical: false },
    { fact_id: 'fixture-headline', field_path: 'content.headline', value: 'Project Context Fixture: Qualifizierte Anfragen', verification_status: 'OPERATOR_CONFIRMED', critical: false }
  ]
});
fixtureState = intake.state;
const fixturePacks = buildWorkspacePacksAndReadiness(fixtureState, {}, { content_pack_id: 'fixture-content-v1', visual_pack_id: 'fixture-visual-v1', readiness_id: 'fixture-ready-v1' });
assert.equal(fixturePacks.ok, true);
const fixtureContextResult = compileProjectMissionContext(fixturePacks.state, { content_pack: fixturePacks.content_pack, visual_pack: fixturePacks.visual_pack, readiness: fixturePacks.readiness });
assert.equal(fixtureContextResult.ok, true);
const fixtureContext = fixtureContextResult.context;

const compiled = compileMissionPackage({
  prompt: 'Erstelle eine Website für das Projekt.',
  project_context: fixtureContext,
  customer_id: 'integration-fixture',
  project_id: 'web-context-v1',
  scope_key: 'integration-fixture:web-context-v1'
});
assert.equal(compiled.ok, true);
assert.equal(compiled.package.source_of_truth !== compiled.package.project_context, true);
assert.equal(compiled.package.project_context.project.scope_key, fixtureContext.project.scope_key);

const staleActivation = evaluateMissionActivation(compiled.package, {
  project_knowledge_revision: fixtureContext.knowledge_revision + 1,
  scope_key: fixtureContext.project.scope_key,
  adapter_approvals: Object.fromEntries((compiled.package.approvals.required_engines || []).map((engine) => [engine, { authorized: true }]))
});
assert.equal(staleActivation.blockers.some((item) => item.code === 'PROJECT_CONTENT_BINDING_STALE'), true);
assert.equal(staleActivation.ready_for_supervised_execution, false);

const web = executeWebFactoryTask({
  capability: 'web.build',
  project_context: fixtureContext,
  website_mission: { synthetic_test_data_only: true },
  routing_context: { environment: 'staging', synthetic_test_data_only: true }
}, { now: '2026-09-03T16:10:00.000Z' });
assert.equal(web.ok, true, JSON.stringify(web.qa_result?.blocking_issues || web));
assert.equal(web.validation.mission.schema, 'riosystems.web-mission.v1');
assert.equal(web.validation.mission.project_mission_context.project.scope_key, fixtureContext.project.scope_key);
assert.equal(web.artifact.project_scope_key, fixtureContext.project.scope_key);
assert.equal(web.artifact.project_mission_context.content_pack_ref.pack_id, fixtureContext.content_pack_ref.pack_id);
assert.equal(web.qa_result.status, 'PASS');
assert.equal(web.qa_result.project_content_rights.status, 'PASS');
assert.equal(web.variable_cost_eur, 0);
assert.equal(web.production_deploy, false);

const inventedCritical = structuredClone(web.artifact);
const homeFile = `${inventedCritical.project_root}/index.html`;
inventedCritical.files[homeFile] = inventedCritical.files[homeFile].replace('</main>', '<p>999 EUR</p></main>');
const inventedQa = runWebsiteQa(inventedCritical);
assert.equal(inventedQa.status, 'FAIL');
assert.equal(inventedQa.blocking_issues.some((item) => item.code === 'RENDERED_PRICE_WITHOUT_APPROVED_FACT'), true);

const invalidAsset = structuredClone(web.artifact);
invalidAsset.used_project_asset_ids = ['asset-not-approved'];
const rightsQa = runWebsiteQa(invalidAsset);
assert.equal(rightsQa.status, 'FAIL');
assert.equal(rightsQa.blocking_issues.some((item) => item.code === 'USED_PROJECT_ASSET_NOT_IN_APPROVED_PACK'), true);

const staleArtifact = structuredClone(web.artifact);
staleArtifact.project_mission_context.knowledge_revision += 1;
const staleQa = runWebsiteQa(staleArtifact);
assert.equal(staleQa.status, 'FAIL');
assert.equal(staleQa.blocking_issues.some((item) => item.code === 'PROJECT_PACK_BINDING_STALE'), true);

const escapedArtifact = structuredClone(web.artifact);
escapedArtifact.files['outside-project.txt'] = 'escape';
const isolationQa = runWebsiteQa(escapedArtifact);
assert.equal(isolationQa.status, 'FAIL');
assert.equal(isolationQa.blocking_issues.some((item) => item.code === 'PROJECT_FILE_ESCAPE'), true);

console.log(JSON.stringify({
  ok: true,
  schema: 'aurentara.project-source-intake-acceptance.v1',
  security: 'PASS',
  provenance: 'PASS',
  conflict_and_stale_binding: 'PASS',
  rights: 'PASS',
  project_isolation: 'PASS',
  mission_compiler_integration: 'PASS',
  web_factory_central_qa: 'PASS',
  gelato_first_run: 'PASS_SOURCE_INTAKE_ONLY',
  quick_intake_cost_eur: 0,
  gelato_budget_consumed_eur: 0,
  paid_provider_calls: 0,
  production_deploy: false,
  external_customer_writes: 0
}, null, 2));
