import assert from 'node:assert/strict';

import {
  createProjectSourceIntakeState,
  registerProjectSource,
  reviewProjectFact,
  createContentPack
} from '../src/project-source-intake-v1.js';
import {
  buildDeterministicProjectKnowledgeStructure,
  prepareProjectKnowledgeReview,
  stageProjectKnowledgeReview,
  approveProjectKnowledgeReview,
  buildProjectKnowledgeReviewView,
  knowledgeUseGate
} from '../src/project-source-knowledge-review-v1.js';
import {
  buildProjectKnowledgeCatchNet,
  projectKnowledgeCatchNetManifest
} from '../src/project-source-knowledge-catch-net-v1.js';
import {
  extractProjectTextKnowledgeWithAi,
  projectTextKnowledgeExtractionManifest
} from '../src/project-source-text-knowledge-extraction-v1.js';

const identity = {
  operator_id: 'operator:ferrari-catch-net@example.test',
  customer_id: 'gelato-donatello',
  project_id: 'gelato-donatello-website-v1',
  scope_key: 'gelato-donatello:gelato-donatello-website-v1'
};

let state = createProjectSourceIntakeState({
  ...identity,
  at: '2026-09-05T22:00:00.000Z'
}).state;

let source = registerProjectSource(state, {
  source_id: 'src-owned-text',
  source_type: 'FILE_DOCUMENT',
  locator: 'private://gelato/projektinformationen.txt',
  display_name: 'Projektinformationen.txt',
  mime_type: 'text/plain',
  ownership_status: 'CUSTOMER_ASSERTED',
  content_hash: 'sha256:text-v1',
  source_metadata: {
    text_content: [
      'Gelato Donatello ist eine Eisdiele.',
      'Kugel Eis 1,60 €.',
      'Wir verkaufen Eis, Eistorten und Shakes.',
      'Unsere Zielgruppe sind Familien und lokale Stammkunden.',
      'Primäres Ziel ist der Vor-Ort-Besuch.',
      'Verantwortlich: Herr Fabrizio Lazzano.'
    ].join('\n')
  }
}, { at: '2026-09-05T22:00:01.000Z' });
assert.equal(source.ok, true);
state = source.state;

let calls = 0;
const fetchImpl = async (url, init = {}) => {
  calls += 1;
  assert.equal(url, 'https://api.openai.com/v1/responses');
  const request = JSON.parse(init.body);
  assert.equal(request.model, 'gpt-5.6-luna');
  const supplied = JSON.parse(request.input);
  assert.equal(supplied.source_id, 'src-owned-text');
  assert.match(supplied.source_text, /Kugel Eis 1,60/);

  return new Response(JSON.stringify({
    output_text: JSON.stringify({
      summary: 'Unternehmens-, Angebots-, Preis-, Zielgruppen- und Conversion-Angaben erkannt.',
      claims: [
        {
          field_kind: 'COMPANY_NAME',
          section_id: 'COMPANY',
          item_key: 'name',
          label: 'Unternehmensname',
          value: 'Gelato Donatello',
          confidence: 0.99,
          category_confidence: 0.99,
          evidence_excerpt: 'Gelato Donatello ist eine Eisdiele.'
        },
        {
          field_kind: 'PRODUCT',
          section_id: 'OFFERINGS',
          item_key: 'eis',
          label: 'Produkt',
          value: 'Eis',
          confidence: 0.98,
          category_confidence: 0.98,
          evidence_excerpt: 'Wir verkaufen Eis, Eistorten und Shakes.'
        },
        {
          field_kind: 'PRODUCT',
          section_id: 'OFFERINGS',
          item_key: 'eistorten',
          label: 'Produkt',
          value: 'Eistorten',
          confidence: 0.98,
          category_confidence: 0.98,
          evidence_excerpt: 'Wir verkaufen Eis, Eistorten und Shakes.'
        },
        {
          field_kind: 'PRICE',
          section_id: 'PRICING',
          item_key: 'kugel_eis',
          label: 'Kugel Eis',
          value: '1,60 €',
          confidence: 0.99,
          category_confidence: 0.99,
          evidence_excerpt: 'Kugel Eis 1,60 €.'
        },
        {
          field_kind: 'TARGET_CUSTOMER',
          section_id: 'TARGET_CUSTOMERS',
          item_key: 'familien_und_stammkunden',
          label: 'Zielgruppe',
          value: 'Familien und lokale Stammkunden',
          confidence: 0.97,
          category_confidence: 0.97,
          evidence_excerpt: 'Unsere Zielgruppe sind Familien und lokale Stammkunden.'
        },
        {
          field_kind: 'PRIMARY_CONVERSION',
          section_id: 'SALES_CONVERSION',
          item_key: 'vor_ort_besuch',
          label: 'Primäre Conversion',
          value: 'Vor-Ort-Besuch',
          confidence: 0.96,
          category_confidence: 0.96,
          evidence_excerpt: 'Primäres Ziel ist der Vor-Ort-Besuch.'
        },
        {
          field_kind: 'LEGAL_RESPONSIBLE_PERSON',
          section_id: 'LEGAL',
          item_key: 'verantwortliche_person',
          label: 'Verantwortliche Person',
          value: 'Herr Fabrizio Lazzano',
          confidence: 0.98,
          category_confidence: 0.98,
          evidence_excerpt: 'Verantwortlich: Herr Fabrizio Lazzano.'
        },
        {
          field_kind: 'OTHER',
          section_id: 'OTHER',
          item_key: 'unklare_notiz',
          label: 'Unklare Notiz',
          value: 'Saisonhinweis ohne klare Bedeutung',
          confidence: 0.62,
          category_confidence: 0.55,
          evidence_excerpt: 'Saisonhinweis'
        }
      ]
    }),
    usage: {
      input_tokens: 1200,
      output_tokens: 430,
      total_tokens: 1630
    }
  }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
};

const env = {
  RIOSYSTEMS_ENVIRONMENT: 'staging',
  RIOSYSTEMS_PRODUCTION_DEPLOY: 'false',
  RIOSYSTEMS_EXTERNAL_WRITES: 'false',
  AURENTARA_OPERATOR_AI_REAL_INFERENCE_ENABLED: 'true',
  OPENAI_API_KEY: 'test-openai-key'
};

let extraction = await extractProjectTextKnowledgeWithAi(state, env, {
  allow_paid_inference: true,
  fetch_impl: fetchImpl,
  at: '2026-09-05T22:01:00.000Z'
});
assert.equal(extraction.ok, true);
assert.equal(extraction.requested_source_count, 1);
assert.equal(extraction.extracted_source_count, 1);
assert.equal(extraction.extracted_fact_count, 8);
assert.equal(extraction.paid_provider_calls, 1);
assert.equal(calls, 1);
state = extraction.state;

const byPath = (path) => state.facts.find((fact) => fact.field_path === path);
assert.equal(byPath('business.name')?.value, 'Gelato Donatello');
assert.equal(byPath('business.products.item.eis')?.value, 'Eis');
assert.equal(byPath('business.products.item.eistorten')?.value, 'Eistorten');
assert.equal(byPath('business.pricing.item.kugel_eis')?.value, '1,60 €');
assert.equal(byPath('target.customers.item.familien_und_stammkunden')?.value, 'Familien und lokale Stammkunden');
assert.equal(byPath('website.primary_conversion')?.value, 'Vor-Ort-Besuch');
assert.equal(byPath('legal.responsible_person')?.value, 'Herr Fabrizio Lazzano');

const price = byPath('business.pricing.item.kugel_eis');
assert.equal(price.verification_status, 'UNVERIFIED');
assert.deepEqual(price.source_refs, ['src-owned-text']);
assert.equal(price.provenance[0].extraction_method, 'OPENAI_TEXT_KNOWLEDGE');
assert.equal(price.provenance[0].normalized_section_id, 'PRICING');
assert.match(price.provenance[0].evidence_excerpt, /Kugel Eis/);

// Same source version does not create another paid extraction.
extraction = await extractProjectTextKnowledgeWithAi(state, env, {
  allow_paid_inference: true,
  fetch_impl: fetchImpl,
  at: '2026-09-05T22:02:00.000Z'
});
assert.equal(extraction.ok, true);
assert.equal(extraction.extracted_source_count, 0);
assert.equal(extraction.skipped_source_count, 1);
assert.equal(extraction.paid_provider_calls, 0);
assert.equal(calls, 1);

// The catch net catches ambiguous or low-confidence information instead of silently accepting it.
let catchNet = buildProjectKnowledgeCatchNet(state);
assert.equal(catchNet.clear, false);
assert.equal(catchNet.unresolved_count, 1);
assert.equal(catchNet.counts.low_confidence, 1);
assert.equal(catchNet.counts.uncategorized, 1);
assert.equal(catchNet.counts.category_uncertain, 1);

const structure = buildDeterministicProjectKnowledgeStructure(state);
assert.equal(structure.ok, true);
assert.equal(structure.sections.some((section) => section.id === 'TARGET_CUSTOMERS'), true);
assert.equal(structure.sections.some((section) => section.id === 'SALES_CONVERSION'), true);
assert.equal(structure.sections.some((section) => section.id === 'PRICING'), true);

let prepared = prepareProjectKnowledgeReview(state, structure, {
  actor_id: identity.operator_id,
  at: '2026-09-05T22:03:00.000Z'
});
assert.equal(prepared.ok, true);
state = prepared.state;
let view = buildProjectKnowledgeReviewView(state);
assert.equal(view.status, 'IN_REVIEW');
assert.equal(view.catch_net.clear, false);
assert.equal(knowledgeUseGate(state).allowed, false);

let staged = stageProjectKnowledgeReview(state, {
  review_seen: true,
  stage_confirmed: true
}, {
  actor_id: identity.operator_id,
  at: '2026-09-05T22:04:00.000Z'
});
assert.equal(staged.ok, false);
assert.equal(staged.error, 'PROJECT_KNOWLEDGE_CATCH_NET_REVIEW_REQUIRED');

// Human decides the caught item. Only then can the safe set enter the project-knowledge draft.
const ambiguous = state.facts.find((fact) => fact.field_path === 'other.item.unklare_notiz');
assert.ok(ambiguous);
const ignored = reviewProjectFact(state, ambiguous.fact_id, {
  verification_status: 'REJECTED',
  verified_by: identity.operator_id
}, { at: '2026-09-05T22:04:30.000Z' });
assert.equal(ignored.ok, true);
state = ignored.state;
catchNet = buildProjectKnowledgeCatchNet(state);
assert.equal(catchNet.clear, true);

staged = stageProjectKnowledgeReview(state, {
  review_seen: true,
  stage_confirmed: true
}, {
  actor_id: identity.operator_id,
  at: '2026-09-05T22:05:00.000Z'
});
assert.equal(staged.ok, true);
state = staged.state;
view = buildProjectKnowledgeReviewView(state);
assert.equal(view.status, 'STAGED');
assert.equal(view.project_knowledge_staged, true);
assert.equal(view.project_knowledge_ready, false);
assert.equal(knowledgeUseGate(state).allowed, false);
assert.equal(createContentPack(state).error, 'PROJECT_KNOWLEDGE_APPROVAL_REQUIRED');

// "Project knowledge staged" is deliberately inert. A second explicit approval activates it.
let approved = approveProjectKnowledgeReview(state, {
  review_seen: true,
  approval_confirmed: false
}, { actor_id: identity.operator_id });
assert.equal(approved.ok, false);
assert.equal(approved.error, 'PROJECT_KNOWLEDGE_EXPLICIT_APPROVAL_REQUIRED');

approved = approveProjectKnowledgeReview(state, {
  review_seen: true,
  approval_confirmed: true
}, {
  actor_id: identity.operator_id,
  at: '2026-09-05T22:06:00.000Z'
});
assert.equal(approved.ok, true);
state = approved.state;
assert.equal(state.knowledge_review.status, 'APPROVED');
assert.equal(knowledgeUseGate(state).allowed, true);
assert.equal(createContentPack(state, { at: '2026-09-05T22:06:01.000Z' }).ok, true);

// Production/external-write safety remains closed.
const unsafe = await extractProjectTextKnowledgeWithAi(
  registerProjectSource(createProjectSourceIntakeState({
    ...identity,
    project_id: 'unsafe-project',
    scope_key: 'gelato-donatello:unsafe-project'
  }).state, {
    source_id: 'src-unsafe-text',
    source_type: 'FILE_DOCUMENT',
    locator: 'private://unsafe/text.txt',
    display_name: 'unsafe.txt',
    mime_type: 'text/plain',
    ownership_status: 'CUSTOMER_ASSERTED',
    source_metadata: { text_content: 'Testinformation' }
  }).state,
  { ...env, RIOSYSTEMS_PRODUCTION_DEPLOY: 'true' },
  { allow_paid_inference: true, fetch_impl: fetchImpl }
);
assert.equal(unsafe.ok, false);
assert.equal(unsafe.error, 'PROJECT_TEXT_EXTRACTION_STAGING_SAFETY_CONTRACT_NOT_MET');
assert.equal(calls, 1);

const catchManifest = projectKnowledgeCatchNetManifest();
assert.equal(catchManifest.automatic_fact_approval, false);
assert.equal(catchManifest.human_override_requires_explicit_confirmation, true);
assert.equal(catchManifest.production_deploy, false);

const extractionManifest = projectTextKnowledgeExtractionManifest();
assert.equal(extractionManifest.atomic_claims, true);
assert.equal(extractionManifest.category_confidence_recorded, true);
assert.equal(extractionManifest.human_review_required, true);
assert.equal(extractionManifest.existing_openai_provider_reused, true);
assert.equal(extractionManifest.production_deploy, false);
assert.equal(extractionManifest.external_writes, false);

console.log(JSON.stringify({
  ok: true,
  suite: 'project-ferrari-knowledge-capture-funnel-v1',
  atomic_text_extraction: 'PASS',
  semantic_classification: 'PASS',
  source_provenance: 'PASS',
  catch_net: 'PASS',
  human_decision_gate: 'PASS',
  project_knowledge_staging: 'PASS',
  staged_knowledge_inert: 'PASS',
  explicit_project_knowledge_ready: 'PASS',
  factory_gate: 'PASS',
  repeat_extraction_deduplicated: 'PASS',
  production_deploy: false,
  external_writes: false
}, null, 2));
