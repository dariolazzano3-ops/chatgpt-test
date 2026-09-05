import assert from 'node:assert/strict';
import {
  createProjectSourceIntakeState,
  registerProjectSource,
  registerProjectAsset,
  upsertProjectFact,
  createContentPack,
  createVisualPack
} from '../src/project-source-intake-v1.js';
import { intakeFileSource } from '../src/project-source-workspace-intake-v1.js';
import { buildProjectSourceIntakeWorkspaceSections } from '../src/operator-project-source-intake-workspace-v1.js';
import {
  knowledgeUseGate,
  buildProjectKnowledgeReviewView,
  projectKnowledgeReviewManifest
} from '../src/project-source-knowledge-review-v1.js';
import { organizeProjectKnowledgeWithAi, projectKnowledgeOrganizerManifest } from '../src/project-source-knowledge-organizer-v1.js';
import {
  handleProjectKnowledgeReviewApi,
  applyProjectKnowledgeReviewUi,
  projectKnowledgeReviewUiManifest
} from '../src/operator-project-source-intake-knowledge-review-v1.js';

const scope = 'gelato-donatello:gelato-donatello-website-v1';
const created = createProjectSourceIntakeState({
  operator_id: 'operator:ferrari@example.test',
  customer_id: 'gelato-donatello',
  project_id: 'gelato-donatello-website-v1',
  scope_key: scope,
  at: '2026-09-05T18:00:00.000Z'
});
assert.equal(created.ok, true);
let state = created.state;

let source = registerProjectSource(state, {
  source_id: 'src-owned-website',
  source_type: 'OWNED_WEBSITE',
  locator: 'https://gelato.example.test',
  display_name: 'Gelato Website',
  ownership_status: 'OWNED_CONFIRMED',
  website_usage: { content: true, structure_reference: true, design_reference: true }
}, { at: '2026-09-05T18:00:01.000Z' });
assert.equal(source.ok, true);
state = source.state;

source = registerProjectSource(state, {
  source_id: 'src-image',
  source_type: 'IMAGE_VISUAL',
  storage_ref: 'private://gelato/hero.jpg',
  display_name: 'Gelato Produktfoto',
  mime_type: 'image/jpeg',
  ownership_status: 'OWNED_CONFIRMED'
}, { at: '2026-09-05T18:00:02.000Z' });
assert.equal(source.ok, true);
state = source.state;

let asset = registerProjectAsset(state, {
  asset_id: 'asset-hero',
  source_id: 'src-image',
  storage_ref: 'private://gelato/hero.jpg',
  mime_type: 'image/jpeg',
  usage_role: 'HERO',
  rights_status: 'OWNED_CONFIRMED',
  publishable: true
}, { at: '2026-09-05T18:00:03.000Z' });
assert.equal(asset.ok, true);
state = asset.state;

const textIntake = intakeFileSource(state, {
  source_id: 'src-pricelist',
  storage_ref: 'private://gelato/preisliste.txt',
  filename: 'preisliste.txt',
  display_name: 'Preisliste',
  mime_type: 'text/plain',
  ownership_status: 'CUSTOMER_ASSERTED',
  extracted_text: 'Kugel Eis 1,60 EUR\nSahne 1,20 EUR\nEistorte 18 cm 65 EUR'
}, { at: '2026-09-05T18:00:04.000Z' });
assert.equal(textIntake.ok, true);
assert.equal(textIntake.source.source_metadata.text_extraction, 'DETERMINISTIC_TEXT_NATIVE_V1');
assert.match(textIntake.source.source_metadata.text_content, /Kugel Eis/);
state = textIntake.state;

const factRows = [
  ['fact-name', 'business.name', 'Gelato Donatello'],
  ['fact-products', 'business.products', ['Eis', 'Eistorten', 'Shakes']],
  ['fact-goal', 'website.primary_goal', 'Besuch im Geschäft'],
  ['fact-summary', 'content.summary', 'Italienische Eisdiele mit klassischem und modernem Sortiment.'],
  ['fact-price', 'business.pricing', ['Kugel Eis 1,60 €', 'Sahne 1,20 €']]
];
for (const [fact_id, field_path, value] of factRows) {
  const added = upsertProjectFact(state, {
    fact_id,
    field_path,
    value,
    origin: 'EXTRACTED',
    verification_status: 'UNVERIFIED',
    source_refs: field_path === 'business.pricing' ? ['src-pricelist'] : ['src-owned-website']
  }, { at: '2026-09-05T18:01:00.000Z' });
  assert.equal(added.ok, true);
  state = added.state;
}

assert.equal(knowledgeUseGate(state).allowed, true);
assert.equal(buildProjectKnowledgeReviewView(state).status, 'NOT_STARTED');

let runtimeRevision = 7;
const identity = {
  operator_id: 'operator:ferrari@example.test',
  customer_id: 'gelato-donatello',
  project_id: 'gelato-donatello-website-v1',
  scope_key: scope
};
const service = {
  async getProjectSourceIntake({ scope_key }) {
    assert.equal(scope_key, scope);
    return {
      ok: true,
      status: 200,
      body: {
        state,
        identity,
        project: { ...identity, name: 'Gelato Donatello' },
        runtime_revision: runtimeRevision,
        persisted: true
      }
    };
  },
  async saveProjectSourceIntake(input) {
    assert.equal(input.expected_revision, runtimeRevision);
    state = structuredClone(input.state);
    runtimeRevision += 1;
    return { ok: true, status: 200, body: { runtime_revision: runtimeRevision } };
  }
};

const authorize = async () => ({
  ok: true,
  status: 200,
  operator_id: 'operator:ferrari@example.test',
  email: 'ferrari@example.test'
});
const organizer = async (current) => ({
  ok: true,
  status: 'AI_ORGANIZED_TEST',
  ai_used: true,
  provider: 'openai-api',
  model: 'test-model',
  paid_provider_calls: 0,
  estimated_cost_usd: 0,
  structure: {
    ai_used: true,
    provider: 'openai-api',
    model: 'test-model',
    notes: ['Preisliste wurde als Preisquelle erkannt.'],
    sections: [
      {
        id: 'PRICING',
        summary: 'Bestätigungsbedürftige Preise',
        item_refs: [
          { type: 'FACT', id: 'fact-price' },
          { type: 'SOURCE', id: 'src-pricelist' }
        ]
      },
      {
        id: 'VISUALS',
        summary: 'Vorhandene Bildquellen',
        item_refs: [
          { type: 'SOURCE', id: 'src-image' },
          { type: 'ASSET', id: 'asset-hero' }
        ]
      }
    ]
  }
});
const options = { runtime_service: service, authorize, knowledge_organizer: organizer };

let response = await handleProjectKnowledgeReviewApi(new Request('https://operator.example/operator/api/project-source-intake/review/prepare', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ scope_key: scope, context_scope_key: scope, allow_ai: true })
}), {}, {}, options);
assert.equal(response.status, 201);
let body = await response.json();
assert.equal(body.ok, true);
assert.equal(body.review.status, 'IN_REVIEW');
assert.equal(body.review.gate.allowed, false);
assert.equal(body.organizer.ai_used, true);
assert.equal(state.knowledge_review.organization_source, 'AI');
assert.equal(knowledgeUseGate(state).error, 'PROJECT_KNOWLEDGE_APPROVAL_REQUIRED');

let content = createContentPack(state);
assert.equal(content.ok, false);
assert.equal(content.error, 'PROJECT_KNOWLEDGE_APPROVAL_REQUIRED');
let visual = createVisualPack(state);
assert.equal(visual.ok, false);
assert.equal(visual.error, 'PROJECT_KNOWLEDGE_APPROVAL_REQUIRED');

const workspace = buildProjectSourceIntakeWorkspaceSections(state);
assert.equal(workspace.knowledge_review.status, 'IN_REVIEW');
assert.equal(workspace.knowledge_review.sections.some((section) => section.id === 'PRICING'), true);

response = await handleProjectKnowledgeReviewApi(new Request('https://operator.example/operator/api/project-source-intake/review/item', {
  method: 'PATCH',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    scope_key: scope,
    context_scope_key: scope,
    item_type: 'FACT',
    item_id: 'fact-summary',
    value: 'Gelato Donatello ist eine Eisdiele mit Eis, Eistorten, Shakes und Vermietung.'
  })
}), {}, {}, options);
assert.equal(response.status, 200);
body = await response.json();
assert.equal(body.review.status, 'IN_REVIEW');
assert.equal(state.facts.find((fact) => fact.fact_id === 'fact-summary').value.includes('Vermietung'), true);

response = await handleProjectKnowledgeReviewApi(new Request('https://operator.example/operator/api/project-source-intake/review/approve', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ scope_key: scope, context_scope_key: scope, review_seen: true, approval_confirmed: false })
}), {}, {}, options);
assert.equal(response.status, 400);
body = await response.json();
assert.equal(body.error, 'PROJECT_KNOWLEDGE_EXPLICIT_APPROVAL_REQUIRED');

response = await handleProjectKnowledgeReviewApi(new Request('https://operator.example/operator/api/project-source-intake/review/approve', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ scope_key: scope, context_scope_key: scope, review_seen: true, approval_confirmed: true })
}), {}, {}, options);
assert.equal(response.status, 200);
body = await response.json();
assert.equal(body.factories_may_use_approved_knowledge, true);
assert.equal(body.gate_active, false);
assert.equal(state.knowledge_review.status, 'APPROVED');
assert.equal(knowledgeUseGate(state).allowed, true);
assert.equal(state.facts.filter((fact) => !['REJECTED', 'OUTDATED'].includes(fact.verification_status)).every((fact) => ['OPERATOR_CONFIRMED', 'CUSTOMER_CONFIRMED', 'VERIFIED'].includes(fact.verification_status)), true);
assert.equal(state.assets.find((item) => item.asset_id === 'asset-hero').knowledge_approved, true);

content = createContentPack(state, { at: '2026-09-05T18:10:00.000Z' });
assert.equal(content.ok, true);
state = content.state;
visual = createVisualPack(state, { at: '2026-09-05T18:10:01.000Z' });
assert.equal(visual.ok, true);
state = visual.state;

const changed = upsertProjectFact(state, {
  fact_id: 'fact-hours',
  field_path: 'business.opening_hours',
  value: 'Mo-So 12:00-22:00',
  origin: 'MANUAL',
  verification_status: 'UNVERIFIED',
  source_refs: ['src-owned-website']
}, { at: '2026-09-05T18:11:00.000Z' });
assert.equal(changed.ok, true);
state = changed.state;
assert.equal(state.knowledge_review.status, 'CHANGES_PENDING');
assert.equal(state.knowledge_review.gate_active, true);
assert.equal(knowledgeUseGate(state).allowed, false);
content = createContentPack(state);
assert.equal(content.ok, false);
assert.equal(content.error, 'PROJECT_KNOWLEDGE_APPROVAL_REQUIRED');

response = await handleProjectKnowledgeReviewApi(new Request('https://operator.example/operator/api/project-source-intake/review/reopen', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ scope_key: scope, context_scope_key: scope })
}), {}, {}, options);
assert.equal(response.status, 200);
body = await response.json();
assert.equal(body.review.status, 'IN_REVIEW');

const deterministicFallback = await organizeProjectKnowledgeWithAi(state, {}, { allow_paid_inference: false });
assert.equal(deterministicFallback.ok, true);
assert.equal(deterministicFallback.ai_used, false);
assert.equal(deterministicFallback.paid_provider_calls, 0);
assert.equal(deterministicFallback.structure.sections.length > 0, true);

const sourceHtml = '<!doctype html><html><body><div data-project-source-intake data-scope="' + scope + '"><div class="source-upload-grid"></div></div><script id="aurentara-project-source-storage-v1-ui"></script></body></html>';
const enhanced = await applyProjectKnowledgeReviewUi(new Response(sourceHtml, { headers: { 'content-type': 'text/html; charset=utf-8', 'content-length': String(sourceHtml.length) } }));
const html = await enhanced.text();
assert.equal(enhanced.headers.get('x-aurentara-project-knowledge-review-ui'), 'v1');
assert.equal(enhanced.headers.has('content-length'), false);
assert.match(html, /Vom Wäschekorb zur sauberen Projektakte/);
assert.match(html, /Mit KI aufräumen/);
assert.match(html, /Für Nutzung freigeben/);
assert.match(html, /Ferrari darf jetzt mit diesen bestätigten Informationen arbeiten/);
assert.match(html, /Nutzung gesperrt/);
assert.match(html, /review\/prepare/);
assert.match(html, /review\/approve/);

const reviewManifest = projectKnowledgeReviewManifest();
assert.equal(reviewManifest.hard_usage_gate_after_review_starts, true);
assert.equal(reviewManifest.changes_invalidate_approval, true);
assert.equal(reviewManifest.creates_new_factory, false);
assert.equal(reviewManifest.creates_new_provider, false);

const organizerManifest = projectKnowledgeOrganizerManifest();
assert.equal(organizerManifest.existing_provider_adapter_reused, 'createOpenAIAdapter');
assert.equal(organizerManifest.automatic_paid_call, false);
assert.equal(organizerManifest.production_deploy, false);

const uiManifest = projectKnowledgeReviewUiManifest();
assert.equal(uiManifest.raw_source_basket, true);
assert.equal(uiManifest.ai_organization_action, true);
assert.equal(uiManifest.explicit_final_checkbox, true);
assert.equal(uiManifest.factories_locked_during_review, true);
assert.equal(uiManifest.dashboard_redesign, false);

console.log(JSON.stringify({
  ok: true,
  suite: 'project-ferrari-intelligent-project-intake-knowledge-approval-v1',
  raw_source_basket: 'PASS',
  safe_text_file_available_to_organizer: 'PASS',
  ai_structuring_contract: 'PASS',
  human_editable_review: 'PASS',
  explicit_approval_checkbox: 'PASS',
  usage_lock_before_approval: 'PASS',
  factories_unlocked_after_approval: 'PASS',
  later_change_invalidates_approval: 'PASS',
  existing_provider_reused: true,
  new_factory: false,
  new_provider: false,
  production_deploy: false,
  external_writes: false
}, null, 2));
