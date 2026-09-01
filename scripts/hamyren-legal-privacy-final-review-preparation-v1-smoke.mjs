import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  HAMYREN_LEGAL_PRIMARY_SOURCES_V1,
  HAMYREN_PROCESSING_REGISTER_V1,
  HAMYREN_RETENTION_PROPOSALS_V1,
  HAMYREN_REVIEW_DECISIONS_V1,
  HAMYREN_SERVICE_REGISTER_V1,
  evaluateHamyrenLegalPrivacyFinalReviewPreparationV1,
  hamyrenDpiaAiScreeningV1,
  hamyrenLegalPrivacyFinalReviewPreparationManifestV1
} from '../src/customer-product/hamyren-legal-privacy-final-review-preparation-v1.js';

const manifest = hamyrenLegalPrivacyFinalReviewPreparationManifestV1();
assert.equal(manifest.product.product_name, 'HAMYREN');
assert.equal(manifest.preparation_complete, true);
assert.equal(manifest.qualified_human_review_required, true);
assert.equal(manifest.final_legal_acceptance_recorded, false);
assert.equal(manifest.legal_privacy_review_complete, false);
assert.equal(manifest.public_customer_surface_active, false);
assert.equal(manifest.real_customer_ai_processing_approved, false);
assert.equal(manifest.real_customer_data, false);
assert.equal(manifest.paid_provider_calls, 0);
assert.equal(manifest.variable_cost_eur, 0);

assert.equal(HAMYREN_LEGAL_PRIMARY_SOURCES_V1.length, 5);
assert.ok(HAMYREN_LEGAL_PRIMARY_SOURCES_V1.every((row) => row.url.startsWith('https://')));
assert.ok(HAMYREN_REVIEW_DECISIONS_V1.length >= 15);
assert.ok(HAMYREN_REVIEW_DECISIONS_V1.every((row) => [
  'REQUIRES_HUMAN_REVIEW',
  'OPERATOR_OR_COUNSEL_INPUT_REQUIRED'
].includes(row.status)));
assert.ok(HAMYREN_PROCESSING_REGISTER_V1.length >= 9);
assert.ok(HAMYREN_PROCESSING_REGISTER_V1.every((row) => row.human_review_status === 'REQUIRES_HUMAN_REVIEW'));
assert.ok(HAMYREN_SERVICE_REGISTER_V1.some((row) => row.service === 'Cloudflare'));
assert.ok(HAMYREN_SERVICE_REGISTER_V1.some((row) => row.service === 'Supabase'));
assert.ok(HAMYREN_SERVICE_REGISTER_V1.some((row) => row.service.startsWith('AI provider')));
assert.ok(HAMYREN_SERVICE_REGISTER_V1.every((row) => row.status === 'REQUIRES_HUMAN_REVIEW'));
assert.ok(HAMYREN_RETENTION_PROPOSALS_V1.length >= 8);
assert.ok(HAMYREN_RETENTION_PROPOSALS_V1.every((row) => row.status === 'REQUIRES_HUMAN_REVIEW'));

const screening = hamyrenDpiaAiScreeningV1();
assert.equal(screening.dpia_decision, 'REQUIRES_HUMAN_REVIEW');
assert.equal(screening.final_classification, 'REQUIRES_HUMAN_REVIEW');
assert.ok(screening.forbidden_without_new_assessment.length >= 5);

const prepared = evaluateHamyrenLegalPrivacyFinalReviewPreparationV1();
assert.equal(prepared.ok, true);
assert.equal(prepared.preparation_complete, true);
assert.equal(prepared.unresolved_human_decision_count, HAMYREN_REVIEW_DECISIONS_V1.length);
assert.equal(prepared.legal_privacy_review_complete, false);

for (const [input, expectedFailure] of [
  [{ legal_privacy_review_complete: true }, 'AUTOMATED_LEGAL_ACCEPTANCE_FORBIDDEN'],
  [{ public_customer_surface_active: true }, 'PUBLIC_SURFACE_MUST_REMAIN_OFF'],
  [{ real_customer_ai_processing_approved: true }, 'REAL_CUSTOMER_AI_MUST_REMAIN_OFF'],
  [{ real_customer_data: true }, 'REAL_CUSTOMER_DATA_FORBIDDEN'],
  [{ variable_cost_eur: 0.01 }, 'ZERO_VARIABLE_COST_REQUIRED']
]) {
  const rejected = evaluateHamyrenLegalPrivacyFinalReviewPreparationV1(input);
  assert.equal(rejected.ok, false);
  assert.ok(rejected.failures.includes(expectedFailure));
  assert.equal(rejected.legal_privacy_review_complete, false);
  assert.equal(rejected.public_customer_surface_active, false);
  assert.equal(rejected.real_customer_ai_processing_approved, false);
}

const prepDoc = await readFile(new URL('../docs/HAMYREN_LEGAL_PRIVACY_FINAL_REVIEW_PREPARATION_V1.md', import.meta.url), 'utf8');
const privacyDraft = await readFile(new URL('../docs/legal/HAMYREN_DATENSCHUTZERKLAERUNG_REVIEW_DRAFT_V1.md', import.meta.url), 'utf8');
const termsDraft = await readFile(new URL('../docs/legal/HAMYREN_NUTZUNGSBEDINGUNGEN_REVIEW_DRAFT_V1.md', import.meta.url), 'utf8');

assert.match(prepDoc, /NOT LEGALLY APPROVED/);
assert.match(prepDoc, /legal_privacy_review_complete/);
assert.match(prepDoc, /public Customer Surface/i);
assert.match(privacyDraft, /NICHT VERÖFFENTLICHEN/);
assert.match(privacyDraft, /\[REVIEW:/);
assert.match(privacyDraft, /Art\. 22 DSGVO/);
assert.match(termsDraft, /B2B Review Draft/);
assert.match(termsDraft, /NICHT VERÖFFENTLICHEN/);
assert.match(termsDraft, /fünf Business-Fragen/);

console.log(JSON.stringify({
  suite: 'HAMYREN LEGAL PRIVACY FINAL REVIEW PREPARATION V1',
  status: 'PASS',
  preparation_complete: true,
  unresolved_human_decisions: HAMYREN_REVIEW_DECISIONS_V1.length,
  processing_activities: HAMYREN_PROCESSING_REGISTER_V1.length,
  service_entries: HAMYREN_SERVICE_REGISTER_V1.length,
  retention_proposals: HAMYREN_RETENTION_PROPOSALS_V1.length,
  qualified_human_review_required: true,
  legal_privacy_review_complete: false,
  public_customer_surface_active: false,
  real_customer_ai_processing_approved: false,
  real_customer_data: false,
  paid_provider_calls: 0,
  variable_cost_eur: 0
}, null, 2));
