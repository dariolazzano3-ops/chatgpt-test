import assert from 'node:assert/strict';

import {
  createProjectSourceIntakeState,
  createContentPack,
  updateProjectImagePurpose
} from '../src/project-source-intake-v1.js';
import { intakeImageSource } from '../src/project-source-workspace-intake-v1.js';
import {
  extractProjectImageKnowledgeWithVision,
  projectImageVisionExtractionManifest
} from '../src/project-source-image-vision-extraction-v1.js';

const identity = {
  operator_id: 'operator:vision@example.test',
  customer_id: 'gelato-donatello',
  project_id: 'gelato-donatello-website-v1',
  scope_key: 'gelato-donatello:gelato-donatello-website-v1'
};

let state = createProjectSourceIntakeState({ ...identity, at: '2026-09-05T21:20:00.000Z' }).state;

let image = intakeImageSource(state, {
  source_id: 'src-menu-photo',
  asset_id: 'asset-menu-photo',
  storage_ref: 'supabase://project-source-intake-private/operator-x/customer-x/project-x/scope-x/src-menu-photo/v1/preisliste.jpg',
  filename: 'preisliste.jpg',
  display_name: 'Preisliste.jpg',
  mime_type: 'image/jpeg',
  ownership_status: 'CUSTOMER_ASSERTED',
  rights_status: 'CUSTOMER_ASSERTED',
  usage_role: 'PROJECT_VISUAL',
  image_purpose: 'INFORMATION_EXTRACTION',
  content_hash: 'sha256:menu-v1',
  publishable: true
}, { at: '2026-09-05T21:20:01.000Z' });
assert.equal(image.ok, true);
state = image.state;

image = intakeImageSource(state, {
  source_id: 'src-product-photo',
  asset_id: 'asset-product-photo',
  storage_ref: 'supabase://project-source-intake-private/operator-x/customer-x/project-x/scope-x/src-product-photo/v1/eis.jpg',
  filename: 'eis.jpg',
  display_name: 'Eis Produktfoto.jpg',
  mime_type: 'image/jpeg',
  ownership_status: 'CUSTOMER_ASSERTED',
  rights_status: 'CUSTOMER_ASSERTED',
  usage_role: 'PROJECT_VISUAL',
  image_purpose: 'VISUAL_USAGE',
  content_hash: 'sha256:visual-v1',
  publishable: true
}, { at: '2026-09-05T21:20:02.000Z' });
assert.equal(image.ok, true);
state = image.state;

let storageReads = 0;
const storageClient = {
  async download(storageRef) {
    storageReads += 1;
    assert.match(storageRef, /preisliste\.jpg$/);
    return {
      ok: true,
      response: new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), {
        headers: { 'content-type': 'image/jpeg' }
      }),
      content_type: 'image/jpeg'
    };
  }
};

let visionCalls = 0;
const fetchImpl = async (url, init = {}) => {
  visionCalls += 1;
  assert.equal(url, 'https://api.openai.com/v1/responses');
  const request = JSON.parse(init.body);
  assert.equal(request.model, 'gpt-5.6-luna');
  const imageInput = request.input?.[0]?.content?.find((item) => item.type === 'input_image');
  assert.ok(imageInput);
  assert.match(imageInput.image_url, /^data:image\/jpeg;base64,/);
  assert.equal(imageInput.detail, 'high');
  return new Response(JSON.stringify({
    output_text: JSON.stringify({
      summary: 'Preisliste mit Eispreisen und Sorten.',
      facts: [
        {
          field_path: 'business.pricing',
          value: 'Kugel Eis 1,60 €; Sahne 1,20 €; Soße 1,00 €',
          confidence: 0.99
        },
        {
          field_path: 'business.products',
          value: 'Vanille; Schokolade; Stracciatella; Pistazie',
          confidence: 0.97
        }
      ]
    }),
    usage: {
      input_tokens: 1200,
      output_tokens: 120,
      total_tokens: 1320
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

let extracted = await extractProjectImageKnowledgeWithVision(state, env, {
  allow_paid_inference: true,
  storage_client: storageClient,
  fetch_impl: fetchImpl,
  at: '2026-09-05T21:21:00.000Z'
});
assert.equal(extracted.ok, true);
assert.equal(extracted.requested_image_count, 1);
assert.equal(extracted.extracted_image_count, 1);
assert.equal(extracted.extracted_fact_count, 2);
assert.equal(extracted.paid_provider_calls, 1);
assert.equal(storageReads, 1);
assert.equal(visionCalls, 1);

state = extracted.state;
const priceFact = state.facts.find((fact) => fact.field_path === 'business.pricing');
const productFact = state.facts.find((fact) => fact.field_path === 'business.products');
assert.ok(priceFact);
assert.ok(productFact);
assert.equal(priceFact.verification_status, 'UNVERIFIED');
assert.deepEqual(priceFact.source_refs, ['src-menu-photo']);
assert.equal(priceFact.evidence_classification, 'IMAGE_VISION');
assert.equal(priceFact.provenance[0].extraction_method, 'OPENAI_VISION');
assert.equal(priceFact.provenance[0].source_content_hash, 'sha256:menu-v1');
assert.equal(priceFact.provenance[0].model, 'gpt-5.6-luna');

// Same image version is not paid-extracted again.
extracted = await extractProjectImageKnowledgeWithVision(state, env, {
  allow_paid_inference: true,
  storage_client: storageClient,
  fetch_impl: fetchImpl,
  at: '2026-09-05T21:22:00.000Z'
});
assert.equal(extracted.ok, true);
assert.equal(extracted.extracted_image_count, 0);
assert.equal(extracted.skipped_image_count, 1);
assert.equal(extracted.paid_provider_calls, 0);
assert.equal(storageReads, 1);
assert.equal(visionCalls, 1);

// INFORMATION_EXTRACTION makes image-derived facts content-eligible.
let pack = createContentPack(state, { at: '2026-09-05T21:23:00.000Z' });
assert.equal(pack.ok, true);
assert.equal(pack.pack.fact_refs.some((ref) => ref.fact_id === priceFact.fact_id), true);

// Switching the image to visual-only immediately removes its facts from content use.
const visualOnly = updateProjectImagePurpose(state, 'src-menu-photo', 'VISUAL_USAGE', { at: '2026-09-05T21:24:00.000Z' });
assert.equal(visualOnly.ok, true);
state = visualOnly.state;
pack = createContentPack(state, { at: '2026-09-05T21:24:01.000Z' });
assert.equal(pack.ok, true);
assert.equal(pack.pack.fact_refs.some((ref) => ref.fact_id === priceFact.fact_id), false);

// Safety gate prevents paid vision outside the bounded staging contract.
const unsafeState = updateProjectImagePurpose(state, 'src-menu-photo', 'INFORMATION_EXTRACTION', { at: '2026-09-05T21:25:00.000Z' }).state;
const blocked = await extractProjectImageKnowledgeWithVision(unsafeState, {
  ...env,
  RIOSYSTEMS_PRODUCTION_DEPLOY: 'true'
}, {
  allow_paid_inference: true,
  storage_client: storageClient,
  fetch_impl: fetchImpl
});
assert.equal(blocked.ok, false);
assert.equal(blocked.error, 'PROJECT_IMAGE_VISION_STAGING_SAFETY_CONTRACT_NOT_MET');
assert.equal(storageReads, 1);
assert.equal(visionCalls, 1);

const manifest = projectImageVisionExtractionManifest();
assert.equal(manifest.existing_openai_provider_reused, true);
assert.equal(manifest.existing_private_project_storage_reused, true);
assert.equal(manifest.extracted_fact_state, 'UNVERIFIED');
assert.equal(manifest.human_review_required, true);
assert.equal(manifest.automatic_on_upload, false);
assert.equal(manifest.triggered_by_knowledge_prepare, true);
assert.equal(manifest.production_deploy, false);
assert.equal(manifest.external_writes, false);

console.log(JSON.stringify({
  ok: true,
  suite: 'project-ferrari-image-vision-extraction-v1',
  image_information_extraction: 'PASS',
  source_provenance: 'PASS',
  human_review_state: 'UNVERIFIED',
  repeat_extraction_deduplicated: 'PASS',
  visual_only_content_exclusion: 'PASS',
  staging_safety: 'PASS',
  production_deploy: false,
  external_writes: false
}, null, 2));
