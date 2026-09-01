import { HAMYREN_LEGAL_REVIEW_ITEMS_V1, HAMYREN_PRODUCT_IDENTITY_V1 } from './legal-privacy-readiness-v1.js';

const REQUIRED = 'REQUIRES_HUMAN_REVIEW';
const INPUT_REQUIRED = 'OPERATOR_OR_COUNSEL_INPUT_REQUIRED';
const RECORDED_PENDING_COUNSEL = 'OPERATOR_DECISION_RECORDED_PENDING_COUNSEL_REVIEW';

const freezeRows = (rows) => Object.freeze(rows.map((row) => Object.freeze(row)));

export const HAMYREN_LEGAL_PRIMARY_SOURCES_V1 = freezeRows([
  {
    id: 'gdpr',
    title: 'Regulation (EU) 2016/679 (GDPR)',
    url: 'https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng',
    review_focus: 'Articles 5, 6, 12-22, 25, 28, 30, 32, 35 and Chapter V'
  },
  {
    id: 'eu_ai_act',
    title: 'Regulation (EU) 2024/1689 (AI Act)',
    url: 'https://eur-lex.europa.eu/eli/reg/2024/1689/oj/eng',
    review_focus: 'Intended purpose, prohibited/high-risk scope, AI literacy and Article 50 transparency'
  },
  {
    id: 'tdddg_25',
    title: 'TDDDG section 25',
    url: 'https://www.gesetze-im-internet.de/ttdsg/__25.html',
    review_focus: 'Terminal-equipment storage/access and consent exceptions'
  },
  {
    id: 'ddg_5',
    title: 'DDG section 5',
    url: 'https://www.gesetze-im-internet.de/ddg/__5.html',
    review_focus: 'Provider identity and legal-notice information'
  },
  {
    id: 'bgb_distance_digital',
    title: 'German Civil Code (BGB)',
    url: 'https://www.gesetze-im-internet.de/bgb/',
    review_focus: 'Online contracting, digital products and consumer duties if B2C is permitted'
  }
]);

export const HAMYREN_B2B_ONLY_SCOPE_V1 = Object.freeze({
  schema: 'hamyren.legal.customer-scope.b2b-only.v1',
  launch_version: 'V1',
  market_scope: 'B2B_ONLY',
  eligibility_rule: 'Entrepreneur under section 14 BGB acting for commercial or independent professional activity',
  eligibility_source: 'https://www.gesetze-im-internet.de/bgb/__14.html',
  consumers_under_section_13_bgb_allowed: false,
  mixed_private_business_use_allowed: false,
  consumer_contract_flow_present: false,
  b2c_terms_present: false,
  operator_decision_recorded: true,
  counsel_review_required: true,
  public_activation_effect: false,
  real_customer_processing_effect: false,
  required_precontract_attestations: [
    'I am an entrepreneur within the meaning of section 14 BGB or act with authority for one',
    'I conclude and use HAMYREN exclusively for commercial or independent professional activity',
    'I do not conclude or use HAMYREN as a consumer within the meaning of section 13 BGB',
    'The supplied business and representative information is complete and accurate'
  ],
  eligibility_evidence_fields: [
    'business_legal_or_trade_name',
    'business_address',
    'business_country',
    'business_activity',
    'representative_name',
    'representative_role_or_authority',
    'bgb14_attested_at',
    'terms_version'
  ]
});

export const HAMYREN_OPERATOR_IDENTITY_FIELDS_V1 = freezeRows([
  { id: 'legal_name', required: true, condition: 'always', purpose: 'controller, legal notice and contracting party' },
  { id: 'legal_form', required: true, condition: 'always', purpose: 'controller, legal notice and contracting party' },
  { id: 'authorized_representative', required: true, condition: 'for legal entity/person partnership', purpose: 'DDG legal notice and contract identification' },
  { id: 'street_house_number', required: true, condition: 'always', purpose: 'service-provider and controller address' },
  { id: 'postal_code_city', required: true, condition: 'always', purpose: 'service-provider and controller address' },
  { id: 'country', required: true, condition: 'always', purpose: 'service-provider and controller jurisdiction' },
  { id: 'general_contact_email', required: true, condition: 'always', purpose: 'rapid electronic contact and direct communication' },
  { id: 'privacy_contact_email', required: true, condition: 'always; may equal general contact email', purpose: 'data-subject and privacy requests' },
  { id: 'direct_contact_channel', required: true, condition: 'always', purpose: 'immediate communication channel; counsel to confirm final legal-notice format' },
  { id: 'register_name_and_court', required: false, condition: 'if registered', purpose: 'DDG legal notice' },
  { id: 'register_number', required: false, condition: 'if registered', purpose: 'DDG legal notice' },
  { id: 'vat_or_business_identification_number', required: false, condition: 'if issued', purpose: 'DDG legal notice' },
  { id: 'competent_supervisory_authority', required: false, condition: 'if the offered activity requires official authorization', purpose: 'DDG legal notice' },
  { id: 'regulated_profession_details', required: false, condition: 'if a regulated profession is involved', purpose: 'DDG legal notice' },
  { id: 'dpo_name_and_contact_or_none_confirmation', required: true, condition: 'always', purpose: 'privacy notice and governance' },
  { id: 'aurentara_legal_brand_relationship', required: true, condition: 'always', purpose: 'explain whether AURENTARA SYSTEMS is a trade name/brand of the controller' }
]);

export const HAMYREN_REVIEW_DECISIONS_V1 = freezeRows([
  { id: 'controller_legal_identity', owner: 'operator', status: INPUT_REQUIRED, blocks: ['privacy_notice', 'legal_notice', 'terms'] },
  { id: 'controller_postal_and_privacy_contact', owner: 'operator', status: INPUT_REQUIRED, blocks: ['privacy_notice', 'data_subject_requests'] },
  { id: 'dpo_or_representative_applicability', owner: 'counsel', status: REQUIRED, blocks: ['privacy_notice'] },
  { id: 'b2b_only_or_b2c_scope', owner: 'operator+counsel', status: RECORDED_PENDING_COUNSEL, decision: 'B2B_ONLY_V1', blocks: ['counsel_review'] },
  { id: 'minimum_age_and_minor_handling', owner: 'operator+counsel', status: INPUT_REQUIRED, blocks: ['terms', 'privacy_notice', 'intake'] },
  { id: 'purposes_and_legal_bases', owner: 'counsel', status: REQUIRED, blocks: ['privacy_notice', 'consent_ui'] },
  { id: 'retention_and_legal_hold_schedule', owner: 'operator+counsel', status: INPUT_REQUIRED, blocks: ['privacy_notice', 'runtime_configuration'] },
  { id: 'processor_contracts_and_subprocessor_list', owner: 'operator+counsel', status: INPUT_REQUIRED, blocks: ['privacy_notice', 'real_customer_processing'] },
  { id: 'international_transfer_mechanisms', owner: 'counsel', status: REQUIRED, blocks: ['privacy_notice', 'real_customer_processing'] },
  { id: 'dpia_required_and_completed', owner: 'counsel', status: REQUIRED, blocks: ['real_customer_processing'] },
  { id: 'ai_act_classification_and_article_50_copy', owner: 'counsel', status: REQUIRED, blocks: ['public_surface', 'real_customer_processing'] },
  { id: 'prohibited_and_high_impact_use_scope', owner: 'operator+counsel', status: INPUT_REQUIRED, blocks: ['terms', 'safety_policy'] },
  { id: 'terms_liability_and_service_commitments', owner: 'counsel', status: REQUIRED, blocks: ['terms'] },
  { id: 'cookie_analytics_configuration', owner: 'operator+counsel', status: INPUT_REQUIRED, blocks: ['public_surface', 'privacy_notice'] },
  { id: 'supervisory_authority_and_complaint_copy', owner: 'counsel', status: REQUIRED, blocks: ['privacy_notice'] },
  { id: 'final_document_versions_and_effective_date', owner: 'operator+counsel', status: INPUT_REQUIRED, blocks: ['publication'] }
]);

export const HAMYREN_PROCESSING_REGISTER_V1 = freezeRows([
  {
    id: 'visitor_intake_and_free_questions',
    data: 'name, business/business idea, industry, current objective, optional country/region, five questions and answers',
    purpose: 'provide and demonstrate business-context assistance',
    legal_basis_candidate: 'GDPR Article 6(1)(b) pre-contract steps or contract; counsel must confirm scope',
    recipients: 'Cloudflare Customer Runtime; an approved AI provider only after the separate processing gate',
    retention_candidate: 'ephemeral before account unless the user explicitly chooses persistent handoff',
    human_review_status: REQUIRED
  },
  {
    id: 'account_and_tenant_identity',
    data: 'email, authentication identifiers, tenant membership, account security events',
    purpose: 'account creation, authentication, authorization and security',
    legal_basis_candidate: 'GDPR Article 6(1)(b), with Article 6(1)(f) candidate for abuse/security controls',
    recipients: 'Supabase and Cloudflare',
    retention_candidate: 'account term plus approved deletion/claims window',
    human_review_status: REQUIRED
  },
  {
    id: 'persistent_business_workspace',
    data: 'business profile, memory facts/candidates, goals, decisions, snapshots and correction history',
    purpose: 'provide persistent personalized Business AI context',
    legal_basis_candidate: 'GDPR Article 6(1)(b); consent ledger does not itself decide the legal basis',
    recipients: 'Supabase; approved AI/research processors only for separately enabled purposes',
    retention_candidate: 'active account plus approved deletion/claims window; customer correction/export/deletion supported',
    human_review_status: REQUIRED
  },
  {
    id: 'conversation_and_ai_output',
    data: 'messages, bounded context, outputs, proposals, safety metadata, source references and usage attribution',
    purpose: 'answer business questions, maintain context, enforce safety and attribute usage',
    legal_basis_candidate: 'GDPR Article 6(1)(b), with Article 6(1)(f) candidate for limited security/audit metadata',
    recipients: 'Supabase, Cloudflare and the selected approved AI provider',
    retention_candidate: 'customer-controlled history with an approved maximum and deletion schedule',
    human_review_status: REQUIRED
  },
  {
    id: 'trusted_research',
    data: 'customer query subset necessary for retrieval, official-source requests and citation metadata',
    purpose: 'retrieve current authoritative information for research-dependent questions',
    legal_basis_candidate: 'GDPR Article 6(1)(b); data minimization and recipient review required',
    recipients: 'Cloudflare plus official/public source hosts or later approved retrieval provider',
    retention_candidate: 'source/citation metadata only for the approved conversation period; no unnecessary raw page retention',
    human_review_status: REQUIRED
  },
  {
    id: 'consent_and_preference_ledger',
    data: 'purpose, decision, policy version, source and timestamp',
    purpose: 'record customer choices and withdrawals',
    legal_basis_candidate: 'GDPR Article 6(1)(c) or 6(1)(f) evidence candidate; counsel must confirm',
    recipients: 'Supabase',
    retention_candidate: 'approved evidence/claims period after withdrawal or account end',
    human_review_status: REQUIRED
  },
  {
    id: 'technical_observability_and_product_analytics',
    data: 'content-minimized request, error, performance, abuse and allowlisted product-event metadata',
    purpose: 'security, reliability and product improvement',
    legal_basis_candidate: 'GDPR Article 6(1)(f) candidate; consent/TDDDG review for non-essential client-side analytics',
    recipients: 'Cloudflare; PostHog only after approved minimized configuration',
    retention_candidate: 'short, documented operational period; customer business content forbidden',
    human_review_status: REQUIRED
  },
  {
    id: 'service_handoff',
    data: 'customer-approved contact and business-context subset',
    purpose: 'handoff from HAMYREN to an eligible AURENTARA service relationship',
    legal_basis_candidate: 'explicit customer request under Article 6(1)(b), with separate consent choice where used',
    recipients: 'authorized AURENTARA service personnel/system only after activation',
    retention_candidate: 'documented CRM/contract period after explicit handoff',
    human_review_status: REQUIRED
  },
  {
    id: 'billing_and_subscription_future',
    data: 'plan, entitlement, invoices, payment status and required transaction records',
    purpose: 'subscriptions, payment and statutory accounting',
    legal_basis_candidate: 'GDPR Article 6(1)(b) and 6(1)(c)',
    recipients: 'not selected; Stripe and real payments remain inactive',
    retention_candidate: 'applicable statutory commercial/tax periods after later payment activation',
    human_review_status: REQUIRED
  }
]);

export const HAMYREN_SERVICE_REGISTER_V1 = freezeRows([
  { service: 'Cloudflare', role_candidate: 'processor', current_scope: 'dedicated Customer Worker, security and minimized observability', customer_content: 'runtime transit; business content forbidden from technical telemetry', region_or_transfer: 'contract, locations and transfer mechanism require documentary review', status: REQUIRED },
  { service: 'Supabase', role_candidate: 'processor', current_scope: 'EU Central dedicated Customer Data Plane and authentication', customer_content: 'account, workspace, memory, conversations, consent and privacy operations', region_or_transfer: 'project region observed as eu-central-1; support/subprocessor/transfer terms still require review', status: REQUIRED },
  { service: 'PostHog', role_candidate: 'processor if activated', current_scope: 'minimized product analytics', customer_content: 'forbidden', region_or_transfer: 'real-customer activation, hosting choice, contract and transfer review pending', status: REQUIRED },
  { service: 'AI provider (not finally selected for real customers)', role_candidate: 'processor', current_scope: 'provider-abstraction inference after explicit approval', customer_content: 'bounded prompt, selected context and output', region_or_transfer: 'DPA, training/retention settings, region, subprocessors and transfer mechanism must be approved before activation', status: REQUIRED },
  { service: 'Official/public source hosts or retrieval provider', role_candidate: 'recipient/processor classification to be confirmed', current_scope: 'trusted research', customer_content: 'minimized query only', region_or_transfer: 'host-by-host or provider-contract review required', status: REQUIRED },
  { service: 'Payment provider (none active)', role_candidate: 'separate controller and/or processor to be confirmed', current_scope: 'future subscription payments', customer_content: 'no payment data currently processed', region_or_transfer: 'out of scope until separate provider activation', status: REQUIRED }
]);

export const HAMYREN_RETENTION_PROPOSALS_V1 = freezeRows([
  { record: 'unauthenticated_guest_session', proposal: 'memory/process lifetime only; no durable persistence', status: REQUIRED },
  { record: 'account_tenant_business_workspace', proposal: 'active contract plus 30-day deletion/recovery window unless law or customer instruction requires otherwise', status: REQUIRED },
  { record: 'conversation_messages_memory_goals_decisions', proposal: 'customer-controlled during account term; erase with account, plus approved maximum inactive-account period', status: REQUIRED },
  { record: 'technical_security_logs', proposal: '30 days by default; longer only for documented incident/legal hold', status: REQUIRED },
  { record: 'product_analytics_events', proposal: '90 days in raw/event form, then aggregate or delete; no customer business content', status: REQUIRED },
  { record: 'consent_events_and_policy_acceptance', proposal: 'three years after withdrawal/account end as evidence candidate', status: REQUIRED },
  { record: 'deletion_receipts_and_minimized_audit', proposal: 'three years without deleted customer payload as evidence candidate', status: REQUIRED },
  { record: 'billing_tax_records_future', proposal: 'applicable statutory period only after billing activation; counsel/accountant to set exact rule', status: REQUIRED },
  { record: 'backups_and_replication', proposal: 'provider-specific rolling window and deletion propagation must be documented before launch', status: REQUIRED }
]);

export function hamyrenDpiaAiScreeningV1() {
  return {
    schema: 'hamyren.legal-privacy.dpia-ai-screening.v1',
    dpia_decision: REQUIRED,
    dpia_indicators: [
      'persistent personalized business profile and longitudinal memory',
      'AI-generated recommendations that users may rely on for material business decisions',
      'free-text fields can contain unexpected personal or special-category data despite product restrictions',
      'multiple processors and possible international transfers after provider activation'
    ],
    mitigating_facts: [
      'no solely automated legal or similarly significant decision is part of the intended purpose',
      'high-impact topics fail closed without current evidence and professional escalation',
      'tenant and conversation-owner isolation, export, correction and deletion are technically implemented',
      'real-customer AI processing and the public surface remain inactive'
    ],
    ai_act_candidate: 'general-purpose conversational business-assistance product with Article 50 human-interaction transparency; not intended for Annex III high-risk decisions',
    forbidden_without_new_assessment: [
      'employment candidate or worker scoring/selection/termination decisions',
      'creditworthiness, lending, insurance eligibility or essential-service access decisions',
      'biometric categorization, emotion recognition or prohibited manipulative uses',
      'legal, tax, medical or regulated professional advice presented as a substitute for a qualified professional',
      'fully automated decisions producing legal or similarly significant effects'
    ],
    final_classification: REQUIRED,
    article_50_transparency_review: REQUIRED,
    ai_literacy_and_operator_process_review: REQUIRED
  };
}

export function evaluateHamyrenB2bEligibilityAttestationV1(input = {}) {
  const required = [
    'business_legal_or_trade_name',
    'business_address',
    'business_country',
    'business_activity',
    'representative_name',
    'representative_role_or_authority',
    'bgb14_attested_at',
    'terms_version'
  ];
  const missing = required.filter((field) => !String(input[field] ?? '').trim());
  const failures = [];
  if (input.is_entrepreneur_under_bgb14 !== true) failures.push('BGB14_ENTREPRENEUR_ATTESTATION_REQUIRED');
  if (input.business_use_only !== true) failures.push('EXCLUSIVE_BUSINESS_USE_ATTESTATION_REQUIRED');
  if (input.consumer_use === true) failures.push('CONSUMER_USE_FORBIDDEN_V1');
  if (input.authorized_representative !== true) failures.push('BUSINESS_REPRESENTATIVE_AUTHORITY_REQUIRED');
  if (missing.length) failures.push('B2B_ELIGIBILITY_EVIDENCE_INCOMPLETE');
  return {
    ok: failures.length === 0,
    schema: 'hamyren.legal.b2b-eligibility-attestation-result.v1',
    eligible_for_v1: failures.length === 0,
    failures,
    missing_fields: missing,
    market_scope: 'B2B_ONLY',
    consumer_contract_allowed: false,
    counsel_review_required: true,
    activates_public_surface: false,
    activates_real_customer_processing: false
  };
}

export function hamyrenLegalPrivacyFinalReviewPreparationManifestV1() {
  return {
    schema: 'hamyren.legal-privacy.final-review-preparation.v1',
    product: { ...HAMYREN_PRODUCT_IDENTITY_V1 },
    jurisdiction_baseline: ['European Union', 'Germany'],
    intended_launch_scope: 'B2B-only entrepreneurs under section 14 BGB and authorized representatives acting exclusively for commercial or independent professional activity',
    b2b_only_scope: { ...HAMYREN_B2B_ONLY_SCOPE_V1, required_precontract_attestations: [...HAMYREN_B2B_ONLY_SCOPE_V1.required_precontract_attestations], eligibility_evidence_fields: [...HAMYREN_B2B_ONLY_SCOPE_V1.eligibility_evidence_fields] },
    operator_identity_fields: HAMYREN_OPERATOR_IDENTITY_FIELDS_V1.map((row) => ({ ...row })),
    official_sources: HAMYREN_LEGAL_PRIMARY_SOURCES_V1.map((row) => ({ ...row })),
    processing_register: HAMYREN_PROCESSING_REGISTER_V1.map((row) => ({ ...row })),
    service_register: HAMYREN_SERVICE_REGISTER_V1.map((row) => ({ ...row })),
    retention_proposals: HAMYREN_RETENTION_PROPOSALS_V1.map((row) => ({ ...row })),
    dpia_ai_screening: hamyrenDpiaAiScreeningV1(),
    decision_register: HAMYREN_REVIEW_DECISIONS_V1.map((row) => ({ ...row })),
    source_technical_review_items: HAMYREN_LEGAL_REVIEW_ITEMS_V1.map((row) => ({ ...row })),
    draft_documents: [
      'docs/legal/HAMYREN_DATENSCHUTZERKLAERUNG_REVIEW_DRAFT_V1.md',
      'docs/legal/HAMYREN_NUTZUNGSBEDINGUNGEN_REVIEW_DRAFT_V1.md'
    ],
    preparation_complete: true,
    qualified_human_review_required: true,
    final_legal_acceptance_recorded: false,
    legal_privacy_review_complete: false,
    customer_surface_active: false,
    public_customer_surface_active: false,
    real_customer_ai_processing_approved: false,
    real_customer_data: false,
    paid_provider_calls: 0,
    variable_cost_eur: 0
  };
}

export function evaluateHamyrenLegalPrivacyFinalReviewPreparationV1(input = {}) {
  const manifest = hamyrenLegalPrivacyFinalReviewPreparationManifestV1();
  const failures = [];
  if (input.legal_privacy_review_complete === true) failures.push('AUTOMATED_LEGAL_ACCEPTANCE_FORBIDDEN');
  if (input.public_customer_surface_active === true) failures.push('PUBLIC_SURFACE_MUST_REMAIN_OFF');
  if (input.real_customer_ai_processing_approved === true) failures.push('REAL_CUSTOMER_AI_MUST_REMAIN_OFF');
  if (input.real_customer_data === true) failures.push('REAL_CUSTOMER_DATA_FORBIDDEN');
  if (Number(input.variable_cost_eur || 0) !== 0) failures.push('ZERO_VARIABLE_COST_REQUIRED');
  if (!HAMYREN_REVIEW_DECISIONS_V1.every((row) => [REQUIRED, INPUT_REQUIRED, RECORDED_PENDING_COUNSEL].includes(row.status))) failures.push('HUMAN_DECISION_STATUS_INVALID');
  if (HAMYREN_B2B_ONLY_SCOPE_V1.market_scope !== 'B2B_ONLY' || HAMYREN_B2B_ONLY_SCOPE_V1.consumers_under_section_13_bgb_allowed !== false) failures.push('B2B_ONLY_SCOPE_INVALID');
  if (!HAMYREN_PROCESSING_REGISTER_V1.every((row) => row.human_review_status === REQUIRED)) failures.push('PROCESSING_REGISTER_REVIEW_STATUS_INVALID');
  if (!HAMYREN_SERVICE_REGISTER_V1.every((row) => row.status === REQUIRED)) failures.push('SERVICE_REGISTER_REVIEW_STATUS_INVALID');
  if (!HAMYREN_RETENTION_PROPOSALS_V1.every((row) => row.status === REQUIRED)) failures.push('RETENTION_REVIEW_STATUS_INVALID');

  return {
    ok: failures.length === 0,
    schema: 'hamyren.legal-privacy.final-review-preparation-result.v1',
    failures,
    preparation_complete: failures.length === 0,
    unresolved_human_decision_count: HAMYREN_REVIEW_DECISIONS_V1.length,
    recorded_operator_decisions: ['B2B_ONLY_V1'],
    missing_operator_identity_field_count: HAMYREN_OPERATOR_IDENTITY_FIELDS_V1.length,
    qualified_human_review_required: true,
    final_legal_acceptance_recorded: false,
    legal_privacy_review_complete: false,
    customer_surface_active: false,
    public_customer_surface_active: false,
    real_customer_ai_processing_approved: false,
    real_customer_data: false,
    paid_provider_calls: 0,
    variable_cost_eur: 0,
    manifest
  };
}
