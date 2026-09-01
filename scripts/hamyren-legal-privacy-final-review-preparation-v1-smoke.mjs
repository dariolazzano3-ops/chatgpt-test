import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  HAMYREN_B2B_ONLY_SCOPE_V1,
  HAMYREN_LEGAL_PRIMARY_SOURCES_V1,
  HAMYREN_OPERATOR_IDENTITY_FIELDS_V1,
  HAMYREN_OPERATOR_LEGAL_STATUS_V1,
  HAMYREN_PROCESSING_REGISTER_V1,
  HAMYREN_RETENTION_PROPOSALS_V1,
  HAMYREN_REVIEW_DECISIONS_V1,
  HAMYREN_SERVICE_REGISTER_V1,
  evaluateHamyrenB2bEligibilityAttestationV1,
  evaluateHamyrenHumanLegalReviewHandoffV1,
  evaluateHamyrenOperatorLegalStatusV1,
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
assert.equal(manifest.b2b_only_scope.market_scope, 'B2B_ONLY');
assert.equal(manifest.b2b_only_scope.consumers_under_section_13_bgb_allowed, false);
assert.equal(manifest.b2b_only_scope.operator_decision_recorded, true);
assert.match(manifest.intended_launch_scope, /section 14 BGB/);
assert.equal(HAMYREN_B2B_ONLY_SCOPE_V1.consumer_contract_flow_present, false);
assert.equal(HAMYREN_OPERATOR_IDENTITY_FIELDS_V1.length, 16);
assert.equal(HAMYREN_OPERATOR_LEGAL_STATUS_V1.status, 'PRE_LAUNCH_UNREGISTERED');
assert.equal(HAMYREN_OPERATOR_LEGAL_STATUS_V1.verified_legal_operator_available, false);
assert.equal(HAMYREN_OPERATOR_LEGAL_STATUS_V1.registered_company_exists, false);
assert.equal(HAMYREN_OPERATOR_LEGAL_STATUS_V1.aurentara_systems_role, 'PRODUCT_AND_BRAND_NAME_ONLY');
assert.equal(HAMYREN_OPERATOR_LEGAL_STATUS_V1.hamyren_role, 'PRODUCT_NAME_ONLY');
assert.equal(HAMYREN_OPERATOR_LEGAL_STATUS_V1.legal_notice_publishable, false);
assert.equal(HAMYREN_OPERATOR_LEGAL_STATUS_V1.contracts_executable, false);

assert.equal(HAMYREN_LEGAL_PRIMARY_SOURCES_V1.length, 5);
assert.ok(HAMYREN_LEGAL_PRIMARY_SOURCES_V1.every((row) => row.url.startsWith('https://')));
assert.ok(HAMYREN_REVIEW_DECISIONS_V1.length >= 15);
assert.ok(HAMYREN_REVIEW_DECISIONS_V1.every((row) => [
  'REQUIRES_HUMAN_REVIEW',
  'OPERATOR_OR_COUNSEL_INPUT_REQUIRED',
  'OPERATOR_DECISION_RECORDED_PENDING_COUNSEL_REVIEW',
  'PRE_LAUNCH_HUMAN_GATE'
].includes(row.status)));
assert.equal(HAMYREN_REVIEW_DECISIONS_V1.find((row) => row.id === 'controller_legal_identity').status, 'PRE_LAUNCH_HUMAN_GATE');
assert.deepEqual(
  HAMYREN_REVIEW_DECISIONS_V1.find((row) => row.id === 'b2b_only_or_b2c_scope'),
  {
    id: 'b2b_only_or_b2c_scope',
    owner: 'operator+counsel',
    status: 'OPERATOR_DECISION_RECORDED_PENDING_COUNSEL_REVIEW',
    decision: 'B2B_ONLY_V1',
    blocks: ['counsel_review']
  }
);
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
assert.deepEqual(prepared.recorded_operator_decisions, ['B2B_ONLY_V1']);
assert.equal(prepared.operator_legal_status, 'PRE_LAUNCH_UNREGISTERED');
assert.equal(prepared.missing_operator_identity_field_count, HAMYREN_OPERATOR_IDENTITY_FIELDS_V1.length);

const honestPrelaunch = evaluateHamyrenOperatorLegalStatusV1();
assert.equal(honestPrelaunch.ok, true);
assert.equal(honestPrelaunch.honest_status_recorded, true);
assert.equal(honestPrelaunch.operator_identity_ready, false);
assert.equal(honestPrelaunch.legal_notice_publishable, false);
assert.equal(honestPrelaunch.contracts_executable, false);

for (const invented of [
  { legal_form: 'Synthetic GmbH' },
  { register_number: 'HRB 12345' },
  { vat_or_business_identification_number: 'DE123456789' },
  { registered_company_exists: true },
  { verified_legal_operator_available: true }
]) {
  const rejected = evaluateHamyrenOperatorLegalStatusV1(invented);
  assert.equal(rejected.ok, false);
  assert.equal(rejected.operator_identity_ready, false);
}

const emptyHumanHandoff = evaluateHamyrenHumanLegalReviewHandoffV1();
assert.equal(emptyHumanHandoff.ok, false);
assert.ok(emptyHumanHandoff.failures.includes('VERIFIED_LEGAL_OPERATOR_REQUIRED'));
assert.ok(emptyHumanHandoff.failures.includes('QUALIFIED_HUMAN_REVIEW_REQUIRED'));
assert.equal(emptyHumanHandoff.automatically_records_legal_acceptance, false);

const syntheticCompleteHandoff = evaluateHamyrenHumanLegalReviewHandoffV1({
  verified_legal_operator_available: true,
  qualified_human_review_completed: true,
  approved_for_legal_privacy_gate: true,
  reviewer_name: 'Synthetic Qualified Reviewer',
  reviewer_role_and_qualification: 'Synthetic Counsel Fixture',
  reviewed_at: '2026-09-01T00:00:00Z',
  jurisdiction_scope: 'Synthetic DE/EU fixture',
  controller_identity_evidence_ref: 'synthetic-controller-ref',
  privacy_notice_version_hash: 'synthetic-privacy-hash',
  terms_version_hash: 'synthetic-terms-hash',
  legal_notice_version_hash: 'synthetic-legal-notice-hash',
  avv_version_hash: 'synthetic-avv-hash',
  tom_annex_version_hash: 'synthetic-tom-hash',
  dpia_decision_ref: 'synthetic-dpia-ref',
  ai_act_classification_ref: 'synthetic-ai-act-ref',
  processor_contract_evidence_ref: 'synthetic-processor-ref',
  retention_approval_ref: 'synthetic-retention-ref'
});
assert.equal(syntheticCompleteHandoff.ok, true);
assert.equal(syntheticCompleteHandoff.eligible_for_separate_operator_gate_recording, true);
assert.equal(syntheticCompleteHandoff.automatically_records_legal_acceptance, false);
assert.equal(syntheticCompleteHandoff.automatically_activates_public_surface, false);
assert.equal(syntheticCompleteHandoff.automatically_activates_real_customer_processing, false);

const eligibleB2b = evaluateHamyrenB2bEligibilityAttestationV1({
  is_entrepreneur_under_bgb14: true,
  business_use_only: true,
  consumer_use: false,
  authorized_representative: true,
  business_legal_or_trade_name: 'Synthetic GmbH',
  business_address: 'Synthetic Street 1, 12345 Teststadt',
  business_country: 'DE',
  business_activity: 'Synthetic business services',
  representative_name: 'Synthetic Representative',
  representative_role_or_authority: 'Managing director',
  bgb14_attested_at: '2026-09-01T00:00:00Z',
  terms_version: 'synthetic-v1'
});
assert.equal(eligibleB2b.ok, true);
assert.equal(eligibleB2b.eligible_for_v1, true);
assert.equal(eligibleB2b.consumer_contract_allowed, false);
assert.equal(eligibleB2b.activates_public_surface, false);
assert.equal(eligibleB2b.activates_real_customer_processing, false);

const consumerRejected = evaluateHamyrenB2bEligibilityAttestationV1({
  is_entrepreneur_under_bgb14: false,
  business_use_only: false,
  consumer_use: true,
  authorized_representative: false
});
assert.equal(consumerRejected.ok, false);
assert.ok(consumerRejected.failures.includes('CONSUMER_USE_FORBIDDEN_V1'));
assert.ok(consumerRejected.failures.includes('BGB14_ENTREPRENEUR_ATTESTATION_REQUIRED'));

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
const legalNoticeDraft = await readFile(new URL('../docs/legal/HAMYREN_IMPRESSUM_REVIEW_DRAFT_V1.md', import.meta.url), 'utf8');
const avvOutline = await readFile(new URL('../docs/legal/HAMYREN_AVV_REVIEW_OUTLINE_V1.md', import.meta.url), 'utf8');
const tomAnnex = await readFile(new URL('../docs/legal/HAMYREN_TOM_REVIEW_ANNEX_V1.md', import.meta.url), 'utf8');
const humanReviewTemplate = await readFile(new URL('../docs/legal/HAMYREN_FINAL_HUMAN_REVIEW_RECORD_TEMPLATE_V1.md', import.meta.url), 'utf8');

assert.match(prepDoc, /NOT LEGALLY APPROVED/);
assert.match(prepDoc, /legal_privacy_review_complete/);
assert.match(prepDoc, /public Customer Surface/i);
assert.match(prepDoc, /B2B-only/);
assert.match(prepDoc, /§ 14 BGB/);
assert.match(prepDoc, /PRE_LAUNCH_UNREGISTERED/);
assert.match(prepDoc, /product\/brand names/);
assert.match(privacyDraft, /NICHT VERÖFFENTLICHEN/);
assert.match(privacyDraft, /\[REVIEW:/);
assert.match(privacyDraft, /Art\. 22 DSGVO/);
assert.match(privacyDraft, /ausschließlich an Unternehmer im Sinne des § 14 BGB/);
assert.match(termsDraft, /B2B Review Draft/);
assert.match(termsDraft, /NICHT VERÖFFENTLICHEN/);
assert.match(termsDraft, /fünf Business-Fragen/);
assert.match(termsDraft, /Kein B2C-Vertrag in V1/);
assert.match(termsDraft, /kein verifizierter rechtlicher Vertragspartner/);
assert.match(legalNoticeDraft, /KEIN GÜLTIGES IMPRESSUM/);
assert.match(legalNoticeDraft, /keine Rechtsform, Registerdaten, Steuer-ID oder Gesellschaftsbezeichnung erfunden/);
assert.match(avvOutline, /Art\. 28 DSGVO/);
assert.match(avvOutline, /KEIN ABSCHLUSSFÄHIGER VERTRAG/);
assert.match(tomAnnex, /separater Customer Data Plane/);
assert.match(tomAnnex, /keine Art.-32-Zertifizierung/);
assert.match(humanReviewTemplate, /ABSICHTLICH LEER/);
assert.match(humanReviewTemplate, /Kein AI-Agent/);

console.log(JSON.stringify({
  suite: 'HAMYREN LEGAL PRIVACY FINAL REVIEW PREPARATION V1',
  status: 'PASS',
  preparation_complete: true,
  customer_scope: 'B2B_ONLY_V1',
  b2c_allowed: false,
  operator_legal_status: 'PRE_LAUNCH_UNREGISTERED',
  verified_legal_operator_available: false,
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
