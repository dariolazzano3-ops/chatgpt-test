#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { quickImportProjectWebsite } from '../src/scraper.js';
import { createCustomerDeliveryContractV1 } from '../src/customer-delivery-contract-v1.js';

const PROJECT_DIR = new URL('../projects/gelato-donatello-website-v1/', import.meta.url);
const confirmed = JSON.parse(await readFile(new URL('confirmed-project-inputs-v1.json', PROJECT_DIR), 'utf8'));
const scopeKey = confirmed.project_ref.scope_key;

const live = await quickImportProjectWebsite({
  source_url: 'https://gelato-donatello.de/',
  max_pages: 20,
  max_depth: 2,
  discover_sitemap: true
});
assert.equal(live.ok, true);
assert.equal(live.import_status, 'IMPORTED');
assert.equal(live.production_deploy, false);
assert.equal(live.paid_provider_calls, 0);
assert.equal(live.ai_inference_calls, 0);
assert.equal(live.post_requests, 0);
assert.equal(live.forms_submitted, 0);

const pages = live.pages || [];
const root = pages.find((p) => new URL(p.url).pathname === '/') || pages[0];
const imprint = pages.find((p) => /\/impressum\/?$/i.test(new URL(p.url).pathname));
const privacy = pages.find((p) => /datenschutzerklaerung/i.test(new URL(p.url).pathname));
assert.ok(root);
assert.ok(imprint);
assert.ok(privacy);

const rootText = String(root.visible_text || '');
const imprintText = String(imprint.visible_text || '');
const privacyText = String(privacy.visible_text || '');
const allText = [rootText, imprintText, privacyText].join('\n');

const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const digits = (value) => String(value ?? '').replace(/\D/g, '');
const unique = (items) => [...new Set(items.filter(Boolean))];

const rawPhoneCandidates = unique(live.extracted_candidates?.contacts?.phones || []);
const phoneCandidates = rawPhoneCandidates.filter((value) => {
  const v = clean(value);
  const d = digits(v);
  return d.length >= 9 && (/^\+/.test(v) || /^0/.test(v));
});
const parserNoise = rawPhoneCandidates.filter((value) => !phoneCandidates.includes(value));
assert.deepEqual(phoneCandidates.sort(), ['+49 176 200 150 65','06806 9394980'].sort());
assert.ok(parserNoise.includes('653/2016'));
assert.ok(parserNoise.includes('306 726 779'));

const emailCandidates = unique(live.extracted_candidates?.contacts?.emails || []);
const legalLinks = unique((live.extracted_candidates?.legal_links || []).map((url) => String(url).replace(/#$/, '')));
const openingHourCandidate = /Täglich von 12\.00 bis 22\.00 \(von März bis Oktober\)/i.exec(rootText)?.[0] || null;
const rootAddress = /Hauptstraße 4, 66346 Köllerbach/i.exec(rootText)?.[0] || null;
const imprintAddress = /Hauptstraße 4\s+66346 Püttlingen\s+Deutschland/i.exec(imprintText)?.[0] || null;
const legalEntity = /Gelato Donatello UG \(haftungsbeschränkt\)/i.exec(imprintText)?.[0] || null;
const responsiblePerson = /Geschäftsführer:\s*Herr\s+Fabrizio Lazzano/i.exec(imprintText)?.[0]?.replace(/^Geschäftsführer:\s*/i,'') || null;
const vatId = /DE\s*306\s*726\s*779/i.exec(imprintText)?.[0] || null;
const liveFlavorClaim = /über 45 verschiedene Eissorten/i.exec(rootText)?.[0] || null;
const trustClaims = [
  /seit 1965 ein familiengeführtes Unternehmen/i.exec(rootText)?.[0],
  /in 2\. Generation/i.exec(rootText)?.[0],
  /seit 2016 in Köllerbach/i.exec(rootText)?.[0],
  /vor Ort täglich frisch im eigenem Eislabor zubereitet/i.exec(rootText)?.[0],
  /Fruchteis Sorten werden mit frischen Früchten hergestellt und sind vegan und laktosefrei/i.exec(rootText)?.[0]
].filter(Boolean);

const confirmedByPath = Object.fromEntries(confirmed.facts.map((fact) => [fact.field_path, fact]));
assert.equal(confirmedByPath['business.name']?.value, 'Gelato Donatello');
assert.equal(confirmedByPath['products.flavor_count']?.value, 40);
assert.equal(confirmedByPath['products.mocca_included']?.value, true);

const confirmedFacts = confirmed.facts.map((fact) => ({
  field_path: fact.field_path,
  value: fact.value,
  classification: 'CONFIRMED',
  provenance: 'CANONICAL_OPERATOR_CONFIRMED'
}));

const highConfidenceCandidates = [
  { field_path:'business.email', value:emailCandidates[0] || null, classification:'HIGH_CONFIDENCE_CANDIDATE', evidence:['impressum'] },
  { field_path:'business.opening_hours', value:openingHourCandidate, classification:'HIGH_CONFIDENCE_CANDIDATE', evidence:['homepage'] },
  { field_path:'legal.entity', value:legalEntity, classification:'HIGH_CONFIDENCE_CANDIDATE', evidence:['impressum','privacy'] },
  { field_path:'legal.responsible_person', value:responsiblePerson, classification:'HIGH_CONFIDENCE_CANDIDATE', evidence:['impressum'] },
  { field_path:'legal.vat_id', value:vatId, classification:'HIGH_CONFIDENCE_CANDIDATE', evidence:['impressum'] },
  ...trustClaims.map((value, index) => ({ field_path:`trust.observed_claim_${index+1}`, value, classification:'HIGH_CONFIDENCE_CANDIDATE', evidence:['homepage'] }))
].filter((item) => item.value);

const conflicts = [
  {
    field_path:'business.phone',
    classification:'CONFLICT',
    values:phoneCandidates,
    reason:'Homepage and imprint/privacy expose different phone numbers.'
  },
  {
    field_path:'business.address',
    classification:'CONFLICT',
    values:unique([rootAddress, imprintAddress]),
    reason:'Homepage says Köllerbach while legal pages say Püttlingen; do not normalize locality without human confirmation.'
  },
  {
    field_path:'products.flavor_count',
    classification:'CONFLICT',
    values:[{source:'CONFIRMED_PROJECT_INPUT',value:40},{source:'LIVE_WEBSITE',value:liveFlavorClaim}],
    resolution:'KEEP_CONFIRMED_40_REJECT_LIVE_OVER_45_FOR_PUBLICATION'
  }
];
assert.equal(conflicts[0].values.length, 2);
assert.equal(conflicts[1].values.length, 2);
assert.ok(liveFlavorClaim);

const observedFacts = [
  {field_path:'website.pages_analyzed',value:live.pages_analyzed},
  {field_path:'website.detected_cta',value:(live.conversion_inventory?.detected_ctas || [])[0] || null},
  {field_path:'website.legal_links',value:legalLinks},
  {field_path:'website.asset_candidate_count',value:(live.asset_candidates || []).length},
  {field_path:'website.social_links',value:live.extracted_candidates?.social_links || []},
  {field_path:'website.price_candidates',value:live.extracted_candidates?.prices || []},
  {field_path:'website.parser_noise_phone_like_values',value:parserNoise}
];

const businessUnderstanding = {
  observed_facts:[
    'Owned website identifies Gelato Donatello and presents an ice-cream shop / gelateria.',
    'Website exposes a Kontakt CTA, flavors, opening hours and location/contact information.',
    'Canonical confirmed project inputs add Eisbecher, Spaghetti-Eis, Shakes, Joghurt, Kinderangebote, Eistorten, Eisbomben and Eisvitrinen-Vermietung.',
    'Canonical confirmed project inputs contain current project pricing and 40 confirmed flavors including Mocca.'
  ],
  system_inferences:[
    {
      field:'business_model',
      value:'Lokales Eiscafé / Gelateria mit Vor-Ort-Verkauf, Eistorten sowie ergänzendem Event-/Eisvitrinen-Angebot.',
      confidence:'HIGH',
      publish_as_customer_claim:false,
      human_confirmation_required_for_internal_build:false
    },
    {
      field:'target_customer_draft',
      value:['lokale Laufkundschaft und Eisgäste','Familien','Kunden für Feiern/Eistorten','Kunden für Eisvitrinen-/Eventbedarf'],
      confidence:'MEDIUM_HIGH',
      publish_as_customer_claim:false,
      human_confirmation_required:true
    },
    {
      field:'conversion_candidates',
      value:['Vor-Ort-Besuch','Anruf/Kontakt','Eistorten-Anfrage','Eisvitrinen-Anfrage'],
      confidence:'MEDIUM_HIGH',
      publish_as_customer_claim:false,
      human_confirmation_required:true
    },
    {
      field:'primary_website_journeys',
      value:['Sortiment/Sorten ansehen','Preise verstehen','Standort/Öffnungszeiten prüfen','Kontakt aufnehmen','Eistorten/Vermietung prüfen'],
      confidence:'HIGH',
      publish_as_customer_claim:false,
      human_confirmation_required:false
    }
  ],
  human_decision_required:[
    'final target customer confirmation',
    'primary conversion channel',
    'current contact details because phone/address conflict',
    'opening hours currentness',
    'legal details currentness',
    'final visual asset quality approval',
    'final human quality approval'
  ]
};

const privacyBasis = legalLinks.find((value) => /datenschutz/i.test(value)) || legalLinks[1] || null;
const questions = [
  {
    id:'CONTACT_DETAILS',
    type:'COMPOSITE',
    required:true,
    reason:'CONFLICT: Homepage und Legal-Seiten zeigen zwei Telefonnummern und zwei Ortsangaben. Die gefundene E-Mail ist ein High-Confidence-Candidate.',
    question:'Welche der gefundenen Kontaktangaben sind aktuell korrekt?',
    evidence:['homepage','impressum','datenschutzerklaerung'],
    controls:[
      {
        id:'phone',type:'MULTI_CHOICE',label:'Telefon',field_path:'business.phone',
        candidates:phoneCandidates.map((value,index)=>({value,label:value,evidence:index===0?'homepage':'impressum/privacy'})),
        allow_other:true,collapse_single:true,materialize_candidates:true,candidate_origin:'EXTRACTED',critical:true
      },
      {
        id:'address',type:'SINGLE_CHOICE',label:'Adresse',field_path:'business.address',
        candidates:unique([rootAddress,imprintAddress]).map((value,index)=>({value,label:value,evidence:index===0?'homepage':'impressum/privacy'})),
        allow_other:true,materialize_candidates:true,candidate_origin:'EXTRACTED',critical:true
      },
      {
        id:'email',type:'CONFIRMATION',label:'E-Mail',field_path:'business.email',
        candidate:emailCandidates[0] || null,requires_correction_when_rejected:true,
        materialize_candidates:true,
        candidates:(emailCandidates[0]?[{value:emailCandidates[0],label:emailCandidates[0],evidence:'impressum'}]:[]),
        candidate_origin:'EXTRACTED',critical:true
      }
    ]
  },
  {
    id:'OPENING_HOURS',type:'CONFIRMATION',required:true,
    reason:'HIGH_CONFIDENCE_CANDIDATE aus der Homepage; saisonale Öffnungszeiten sind zeitkritisch.',
    question:'Sind die extrahierten Öffnungszeiten aktuell korrekt?',
    evidence:['homepage'],
    controls:[{
      id:'opening_hours',type:'CONFIRMATION',label:'Öffnungszeiten',field_path:'business.opening_hours',
      candidate:openingHourCandidate,requires_correction_when_rejected:true,materialize_candidates:true,
      candidates:openingHourCandidate?[{value:openingHourCandidate,label:openingHourCandidate,evidence:'homepage'}]:[],
      candidate_origin:'EXTRACTED',critical:true
    }]
  },
  {
    id:'LEGAL_CURRENTNESS',type:'COMPOSITE',required:true,
    reason:'HIGH_CONFIDENCE_CANDIDATES aus Impressum/Datenschutz; rechtliche Aktualität benötigt menschliche Verantwortung.',
    question:'Sind die gefundenen Angaben zu Legal Entity, Verantwortlichem und USt-ID aktuell korrekt?',
    evidence:['impressum','datenschutzerklaerung'],
    aggregate_field_path:'legal.details',
    controls:[
      {id:'entity',aggregate_key:'entity',type:'CONFIRMATION',label:'Legal Entity',field_path:'legal.entity',candidate:legalEntity,requires_correction_when_rejected:true,materialize_candidates:true,candidates:legalEntity?[{value:legalEntity,label:legalEntity,evidence:'impressum/privacy'}]:[],candidate_origin:'EXTRACTED',critical:true},
      {id:'responsible_person',aggregate_key:'responsible_person',type:'CONFIRMATION',label:'Verantwortlicher',field_path:'legal.responsible_person',candidate:responsiblePerson,requires_correction_when_rejected:true,materialize_candidates:true,candidates:responsiblePerson?[{value:responsiblePerson,label:responsiblePerson,evidence:'impressum'}]:[],candidate_origin:'EXTRACTED',critical:true},
      {id:'vat_id',aggregate_key:'vat_id',type:'CONFIRMATION',label:'USt-ID',field_path:'legal.vat_id',candidate:vatId,requires_correction_when_rejected:true,materialize_candidates:true,candidates:vatId?[{value:vatId,label:vatId,evidence:'impressum'}]:[],candidate_origin:'EXTRACTED',critical:true},
      {id:'privacy_basis',aggregate_key:'privacy_basis',type:'CONFIRMATION',label:'Datenschutz-Ausgangsbasis',field_path:'legal.privacy_basis',candidate:privacyBasis,requires_correction_when_rejected:true,materialize_candidates:true,candidates:privacyBasis?[{value:privacyBasis,label:'Bestehende Datenschutzerklärung',evidence:'datenschutzerklaerung'}]:[],candidate_origin:'EXTRACTED',critical:true}
    ]
  },
  {
    id:'TARGET_CUSTOMERS',type:'MULTI_CHOICE',required:true,
    reason:'System-Inferenz kann die Auswahl eingrenzen, die finale Positionierungsentscheidung bleibt menschlich.',
    question:'Welche Zielgruppen sollen für Gelato final priorisiert werden?',
    evidence:['existing website','confirmed offers','system inference'],
    controls:[{
      id:'target_customers',type:'MULTI_CHOICE',label:'Priorisierte Zielgruppen',field_path:'target.customers',
      candidates:businessUnderstanding.system_inferences[1].value.map((value)=>({value,label:value})),
      allow_other:true,materialize_candidates:false,candidate_origin:'INFERRED'
    }]
  },
  {
    id:'PRIMARY_CONVERSION',type:'SINGLE_CHOICE',required:true,
    reason:'Die Website zeigt Kontakt, während die bestätigten Angebote mehrere plausible Conversion-Ziele unterstützen.',
    question:'Was ist der primäre Conversion-Kanal der Website?',
    evidence:['website CTA','confirmed offers','system inference'],
    controls:[{
      id:'primary_conversion',type:'SINGLE_CHOICE',label:'Primäre Conversion',field_path:'website.primary_conversion',
      candidates:businessUnderstanding.system_inferences[2].value.map((value)=>({value,label:value})),
      allow_other:true,materialize_candidates:false,candidate_origin:'INFERRED'
    }]
  },
  {
    id:'FINAL_ASSET_QUALITY_APPROVAL',type:'APPROVAL',effect:'ASSET_QUALITY',required:true,
    reason:'Fünf Projektassets sind rechtegeklärt; Qualitätsfreigabe bleibt bewusst getrennt von Rechten.',
    question:'Sind die fünf bereits rechtegeklärten Assets auch qualitativ für die Website freigegeben?',
    evidence:['5 project assets','rights cleared'],
    controls:[{id:'asset_quality',type:'APPROVAL',label:'Asset Quality Approval',help:'JA setzt nur die vorhandenen Projektassets auf Qualitätsstatus VERIFIED. Rechte werden nicht verändert.'}]
  },
  {
    id:'FINAL_HUMAN_QUALITY_APPROVAL',type:'APPROVAL',effect:'HUMAN_APPROVAL',required:true,
    reason:'Der Premium Website Standard verbietet eine automatische finale Human Approval.',
    question:'Besteht nach Sichtprüfung die finale Human Quality Approval?',
    evidence:['actual private preview required'],
    controls:[{id:'human_quality',type:'APPROVAL',label:'Final Human Quality Approval',requires_preview_seen:true,help:'Eine positive Freigabe ist nur zulässig, wenn die tatsächliche Vorschau gesehen wurde.'}]
  }
]

const contract = createCustomerDeliveryContractV1({
  customer_id:'gelato-donatello',
  project_id:'gelato-donatello-website-v1',
  scope_key:scopeKey,
  customer_problem:'Die bestehende Gelato-Website evidence-backed modernisieren und als private Premium-Vorschau mit bestätigten Inhalten bereitstellen.',
  desired_outcomes:['confirmed-content premium private preview','rights-safe visual pack','customer-reviewable website candidate'],
  business_profile:{
    model_draft:businessUnderstanding.system_inferences[0],
    target_customer_draft:businessUnderstanding.system_inferences[1],
    conversion_candidates:businessUnderstanding.system_inferences[2],
    observed_source:'LIVE_EXISTING_WEBSITE_PLUS_CANONICAL_CONFIRMED_INPUTS',
    authoritative:false
  },
  requested_capabilities:['web_presence'],
  required_capabilities:['web_presence'],
  optional_capabilities:[],
  excluded_capabilities:['lead_capture','business_crm','automation_followup','analytics','ai_assistance'],
  required_customer_inputs:[
    'target_customers','primary_conversion_channel','current_contact_details',
    'opening_hours_confirmation','legal_details','final_asset_quality_approval'
  ],
  available_customer_inputs:['business_identity','products_services','pricing','business_model_draft'],
  missing_inputs:[
    'target_customers','primary_conversion_channel','current_contact_details',
    'opening_hours_confirmation','legal_details','final_asset_quality_approval'
  ],
  human_decisions_required:businessUnderstanding.human_decision_required,
  source_readiness:'READY_WITH_WARNINGS',
  rights_readiness:'READY',
  provider_plan:{route:'existing-ferrari-web-factory',providers:['project-source-intake','web-factory']},
  cost_preflight:{approved_ceiling_eur:0,actual_variable_cost_eur:0,paid_overflow:false},
  quality_contract:{schema:'aurentara.premium-website-standard.v1',browser_qa_required:true,human_outcome_required:true,unconfirmed_critical_facts_publishable:false},
  acceptance_criteria:['source_provenance','critical_fact_resolution','rights_enforcement','premium_standard','human_outcome','customer_review','delivery_gate'],
  customer_review_required:true,
  production_approval_required:true,
  delivery_definition:{kind:'private_premium_customer_review_candidate',public:false,production:false},
  scope_confirmation_status:'HUMAN_CONFIRMED',
  current_status:'CUSTOMER_INPUT_CLOSURE'
});
assert.equal(contract.ok, true);
assert.equal(contract.readiness.ready_for_build, false);
assert.deepEqual(contract.contract.missing_inputs, [
  'target_customers','primary_conversion_channel','current_contact_details',
  'opening_hours_confirmation','legal_details','final_asset_quality_approval'
]);

const previousHumanSlots = 8;
const fullyAvoidedQuestions = 1;
const narrowedOpenEndedQuestions = 3;
assert.equal(questions.length, 7);

const normalizedExtractedFactCount =
  emailCandidates.length +
  phoneCandidates.length +
  (openingHourCandidate ? 1 : 0) +
  unique([rootAddress,imprintAddress]).length +
  (legalEntity ? 1 : 0) +
  (responsiblePerson ? 1 : 0) +
  (vatId ? 1 : 0) +
  (liveFlavorClaim ? 1 : 0) +
  trustClaims.length +
  legalLinks.length +
  ((live.conversion_inventory?.detected_ctas || []).length ? 1 : 0);

const evidence = {
  schema:'aurentara.gelato-auto-customer-input-closure.v1',
  project_ref:confirmed.project_ref,
  live_capture:{
    captured_at:new Date().toISOString(),
    import_status:live.import_status,
    pages_analyzed:live.pages_analyzed,
    robots_status:live.robots_status,
    fetch_errors:live.fetch_errors,
    raw_phone_candidates:rawPhoneCandidates,
    parser_noise_rejected:parserNoise,
    asset_candidate_count:(live.asset_candidates || []).length
  },
  classifications:{
    confirmed:confirmedFacts,
    high_confidence_candidates:highConfidenceCandidates,
    conflicts,
    missing:[
      {field:'social_links',classification:'MISSING',required_for_scope:false,reason:'No social links detected by existing scraper.'}
    ],
    human_only:businessUnderstanding.human_decision_required
  },
  observed:observedFacts,
  business_understanding:businessUnderstanding,
  human_questions:questions,
  customer_delivery_contract:{
    schema:contract.contract.schema,
    contract:contract.contract,
    readiness:contract.readiness
  },
  efficiency:{
    operator_touch_count:1,
    active_operator_minutes_after_submission:0,
    initial_instruction_composition_time:'UNKNOWN_OUT_OF_SCOPE',
    system_extracted_fact_candidates:normalizedExtractedFactCount,
    automatically_resolved_required_inputs:1,
    automatically_resolved_required_input_ids:['business_model'],
    previous_human_input_slots:previousHumanSlots,
    human_questions_remaining:questions.length,
    manual_questions_fully_avoided:fullyAvoidedQuestions,
    open_ended_questions_narrowed_to_confirmation_or_choice:narrowedOpenEndedQuestions,
    conflicts:conflicts.length,
    missing_required_source_values:0,
    optional_missing_items:1,
    repairs:0,
    retries:0,
    external_waiting_time_seconds:0,
    provider_runs:0,
    actual_variable_cost_eur:0
  },
  safety:{
    scraped_is_confirmed:false,
    unconfirmed_critical_facts_publishable:false,
    production_deploy:false,
    public_launch:false,
    dns_changed:false,
    billing_changed:false,
    new_providers:0,
    paid_overflow:false,
    paid_provider_calls:0,
    ai_inference_calls:0,
    forms_submitted:0,
    post_requests:0
  },
  result:{
    auto_customer_input_closure:'PASS',
    customer_input_closure:'BLOCKED_BY_EXTERNAL_INPUT',
    gelato_full_dogfood_ready:false
  }
};

console.log('PROJECT FERRARI Gelato Auto Customer Input Closure V1: PASS');
console.log(JSON.stringify(evidence, null, 2));
