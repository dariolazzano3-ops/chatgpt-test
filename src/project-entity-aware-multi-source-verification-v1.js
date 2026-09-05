import {
  registerProjectSource,
  upsertProjectFact,
  annotateProjectFactEvidence
} from './project-source-intake-v1.js';

const clone = (value) => structuredClone(value ?? null);
const clean = (value, max = 4000) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const arr = (value) => Array.isArray(value) ? value : [];
const uniq = (items = []) => [...new Set(items.filter((item) => item !== null && item !== undefined && item !== ''))];

export const ENTITY_MATCH_STATES = Object.freeze([
  'ENTITY_MATCH_CONFIRMED',
  'ENTITY_MATCH_HIGH_CONFIDENCE',
  'ENTITY_MATCH_AMBIGUOUS',
  'ENTITY_MATCH_REJECTED'
]);

export const MULTI_SOURCE_FACT_CLASSIFICATIONS = Object.freeze([
  'CONFIRMED',
  'HIGH_CONFIDENCE_CANDIDATE',
  'CORROBORATED_CANDIDATE',
  'CONFLICT',
  'MISSING',
  'HUMAN_ONLY'
]);

export const BUSINESS_PUBLIC_SOURCE_WEIGHTS = Object.freeze({
  CUSTOMER_CONFIRMED_INPUT: 100,
  ANCHOR_OWNED_WEBSITE: 92,
  OFFICIAL_LINKED_SOCIAL: 84,
  OFFICIAL_BUSINESS_REGISTER: 82,
  OFFICIAL_BUSINESS_LISTING: 76,
  REPUTABLE_BUSINESS_LISTING: 64,
  THIRD_PARTY_DIRECTORY: 48,
  LOCAL_PRESS_SECONDARY: 42,
  SECONDARY_WEB_SOURCE: 34
});

const TIME_SENSITIVE_FIELDS = new Set([
  'business.phone','business.email','business.address','business.opening_hours',
  'legal.entity','legal.responsible_person','legal.vat_id'
]);

function normalizeText(value = '') {
  return clean(value, 4000)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9@.+]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizePhone(value = '') {
  let digits = clean(value, 120).replace(/\D/g, '');
  if (digits.startsWith('0049')) digits = '0' + digits.slice(4);
  else if (digits.startsWith('49') && digits.length > 10) digits = '0' + digits.slice(2);
  return digits.replace(/^00/, '');
}

function normalizeEmail(value = '') {
  return clean(value, 320).toLowerCase();
}

function normalizeDomain(value = '') {
  try {
    const url = new URL(/^https?:/i.test(clean(value)) ? clean(value) : `https://${clean(value)}`);
    return url.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return clean(value, 320).toLowerCase().replace(/^www\./, '');
  }
}

function normalizeAddress(value = '') {
  return normalizeText(value)
    .replace(/\bstrasse\b/g, 'str')
    .replace(/\bstraße\b/g, 'str');
}

function addressCore(value = '') {
  const text = normalizeAddress(value);
  const postal = text.match(/\b\d{5}\b/)?.[0] || '';
  const number = text.match(/\b\d+[a-z]?\b/)?.[0] || '';
  const street = text.replace(/\b\d{5}\b/g, '').replace(/\b\d+[a-z]?\b/g, '').replace(/\b(deutschland|germany)\b/g, '').trim().split(' ').slice(0, 4).join(' ');
  return clean(`${street}|${number}|${postal}`, 320);
}

function sourceIdFromUrl(url = '') {
  try {
    const parsed = new URL(url);
    const slug = `${parsed.hostname}${parsed.pathname}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120);
    return `public-${slug || 'source'}`;
  } catch {
    return `public-${normalizeText(url).replace(/\s+/g, '-').slice(0, 100) || 'source'}`;
  }
}

function visibleTexts(importResult = {}) {
  return arr(importResult.pages).map((page) => clean(page.visible_text, 100_000)).filter(Boolean);
}

function firstBusinessName(importResult = {}, input = {}) {
  if (clean(input.business_name, 300)) return clean(input.business_name, 300);
  const candidates = [
    ...arr(input.business_name_candidates),
    ...arr(importResult.pages).flatMap((page) => [page?.brand_signals?.og_site_name, ...arr(page?.headings?.h1), page?.title])
  ].map((value) => clean(value, 300)).filter(Boolean);
  return candidates.find((value) => value.length >= 3) || null;
}

function extractLegalEntities(text = '', businessName = '') {
  const matches = [...clean(text, 120_000).matchAll(/\b([A-ZÄÖÜ][A-Za-zÄÖÜäöüß0-9&.'\- ]{1,90}?(?:GmbH|UG\s*\(haftungsbeschränkt\)|GbR|AG|OHG|KG|e\.K\.))/g)]
    .map((match) => clean(match[1], 180));
  const businessTokens = normalizeText(businessName).split(' ').filter((token) => token.length > 2);
  const filtered = matches.filter((value) => !businessTokens.length || businessTokens.some((token) => normalizeText(value).includes(token)));
  return uniq(filtered.length ? filtered : matches).slice(0, 12);
}

function extractResponsiblePeople(text = '') {
  const out = [];
  const patterns = [
    /(?:Geschäftsführer(?:in)?|Verantwortlich(?:er|e)?(?:\s+für[^:\n]{0,80})?|Inhaber(?:in)?|Management)\s*:?\s*(?:Herr\s+|Frau\s+)?([A-ZÄÖÜ][A-Za-zÄÖÜäöüß.'\-]+\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß.'\-]+)/gi,
    /([A-ZÄÖÜ][A-Za-zÄÖÜäöüß.'\-]+\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß.'\-]+)\s+(?:Geschäftsführer(?:in)?|Inhaber(?:in)?)/gi
  ];
  for (const pattern of patterns) for (const match of clean(text, 120_000).matchAll(pattern)) out.push(clean(match[1], 160));
  return uniq(out).slice(0, 12);
}

function extractVatIds(text = '') {
  return uniq([...clean(text, 120_000).matchAll(/\bDE\s*\d{9}\b/gi)].map((match) => match[0].replace(/\s+/g, ' ').toUpperCase())).slice(0, 12);
}

function extractDomainMentions(text = '') {
  return uniq([...clean(text, 120_000).matchAll(/(?:https?:\/\/)?(?:www\.)?([a-z0-9.-]+\.[a-z]{2,})(?:\/[^\s<]*)?/gi)].map((match) => normalizeDomain(match[1]))).slice(0, 30);
}

function inferCitySignals(addresses = [], text = '') {
  const out = [];
  for (const address of addresses) {
    const match = clean(address, 500).match(/\b\d{5}\s+([^,\n]+)$/);
    if (match) out.push(clean(match[1], 120));
  }
  for (const name of ['Püttlingen','Köllerbach','Saarbrücken','Heusweiler']) if (new RegExp(`\\b${name}\\b`, 'i').test(text)) out.push(name);
  return uniq(out);
}

export function extractBusinessEvidenceFromImport(importResult = {}, input = {}) {
  const pages = arr(importResult.pages);
  const text = visibleTexts(importResult).join('\n');
  const businessName = firstBusinessName(importResult, input);
  const phones = uniq([
    ...arr(importResult.business_facts?.phones),
    ...pages.flatMap((page) => arr(page?.contacts?.phones)),
    ...arr(input.phone_candidates)
  ]).map((value) => clean(value, 120)).filter(Boolean);
  const emails = uniq([
    ...arr(importResult.business_facts?.emails),
    ...pages.flatMap((page) => arr(page?.contacts?.emails)),
    ...arr(input.email_candidates)
  ]).map((value) => clean(value, 320)).filter(Boolean);
  const addresses = uniq([
    ...pages.flatMap((page) => arr(page?.address_candidates)),
    ...arr(input.address_candidates)
  ]).map((value) => clean(value, 500)).filter(Boolean);
  const openingHours = uniq([
    ...pages.flatMap((page) => arr(page?.opening_hour_candidates)),
    ...arr(input.opening_hour_candidates)
  ]).map((value) => clean(value, 500)).filter(Boolean);
  const products = uniq([
    ...pages.flatMap((page) => arr(page?.service_product_candidates)),
    ...arr(input.product_candidates)
  ]).map((value) => clean(value, 500)).filter(Boolean);
  const socialLinks = uniq([
    ...arr(importResult.extracted_candidates?.social_links),
    ...pages.flatMap((page) => arr(page?.social_links)),
    ...arr(input.social_links)
  ]).map((value) => clean(value, 2000)).filter(Boolean);
  const ctas = uniq([
    ...arr(importResult.conversion_inventory?.detected_ctas),
    ...pages.flatMap((page) => arr(page?.ctas))
  ]).map((value) => clean(value, 160)).filter(Boolean);

  return {
    schema: 'aurentara.business-public-source-evidence.v1',
    source_url: clean(input.source_url || importResult.canonical_source_url || importResult.source_url, 2000) || null,
    business_name: businessName,
    business_name_candidates: uniq([businessName, ...arr(input.business_name_candidates)]).filter(Boolean),
    domains: uniq([
      normalizeDomain(input.source_url || importResult.canonical_source_url || importResult.source_url),
      ...extractDomainMentions(text),
      ...arr(input.domain_candidates).map(normalizeDomain)
    ]).filter(Boolean),
    phones,
    normalized_phones: uniq(phones.map(normalizePhone).filter(Boolean)),
    emails,
    normalized_emails: uniq(emails.map(normalizeEmail).filter(Boolean)),
    addresses,
    address_cores: uniq(addresses.map(addressCore).filter(Boolean)),
    city_region: inferCitySignals(addresses, text),
    opening_hours: openingHours,
    legal_entities: uniq([...extractLegalEntities(text, businessName), ...arr(input.legal_entity_candidates).map((v)=>clean(v,180))]),
    responsible_people: uniq([...extractResponsiblePeople(text), ...arr(input.responsible_person_candidates).map((v)=>clean(v,160))]),
    vat_ids: uniq([...extractVatIds(text), ...arr(input.vat_id_candidates).map((v)=>clean(v,80))]),
    social_links: socialLinks,
    products_services: products,
    conversion_signals: ctas,
    brand_signals: uniq(pages.flatMap((page) => [page?.brand_signals?.og_site_name, page?.brand_signals?.og_image, page?.brand_signals?.favicon]).filter(Boolean)),
    text_excerpt: clean(text, 12_000),
    fetched_at: clean(input.fetched_at, 80) || new Date().toISOString(),
    visible_updated_at: clean(input.visible_updated_at, 80) || null
  };
}

export function buildBusinessEntityFingerprint(anchorImport = {}, input = {}) {
  const evidence = extractBusinessEvidenceFromImport(anchorImport, input);
  const domain = normalizeDomain(anchorImport.canonical_source_url || anchorImport.source_url || input.source_url);
  const fingerprint = {
    schema: 'aurentara.business-entity-fingerprint.v1',
    project_id: clean(input.project_id, 200) || null,
    scope_key: clean(input.scope_key, 400) || null,
    anchor_source_url: clean(anchorImport.canonical_source_url || anchorImport.source_url || input.source_url, 2000) || null,
    anchor_domain: domain || null,
    business_names: uniq([
      ...arr(input.confirmed_business_names),
      ...arr(evidence.business_name_candidates)
    ].map((value) => clean(value, 300)).filter(Boolean)),
    city_region: uniq([...arr(input.city_region), ...arr(evidence.city_region)]),
    addresses: uniq([...arr(input.address_candidates), ...arr(evidence.addresses)]),
    address_cores: uniq([...arr(input.address_candidates), ...arr(evidence.addresses)].map(addressCore).filter(Boolean)),
    phones: uniq([...arr(input.phone_candidates), ...arr(evidence.phones)]),
    normalized_phones: uniq([...arr(input.phone_candidates), ...arr(evidence.phones)].map(normalizePhone).filter(Boolean)),
    emails: uniq([...arr(input.email_candidates), ...arr(evidence.emails)]),
    normalized_emails: uniq([...arr(input.email_candidates), ...arr(evidence.emails)].map(normalizeEmail).filter(Boolean)),
    legal_entities: uniq([...arr(input.legal_entity_candidates), ...arr(evidence.legal_entities)]),
    responsible_people: uniq([...arr(input.responsible_person_candidates), ...arr(evidence.responsible_people)]),
    vat_ids: uniq([...arr(input.vat_id_candidates), ...arr(evidence.vat_ids)]),
    social_links: uniq([...arr(input.social_links), ...arr(evidence.social_links)]),
    brand_signals: uniq([...arr(input.brand_signals), ...arr(evidence.brand_signals)]),
    generated_at: clean(input.generated_at, 80) || new Date().toISOString(),
    global_entity_database_created: false
  };
  return { ok: Boolean(fingerprint.anchor_domain && fingerprint.business_names.length), fingerprint };
}

function intersects(a = [], b = [], normalize = normalizeText) {
  const right = new Set(arr(b).map(normalize).filter(Boolean));
  return arr(a).some((value) => right.has(normalize(value)));
}

function nameMatches(fingerprint = {}, evidence = {}) {
  const fp = arr(fingerprint.business_names).map(normalizeText).filter(Boolean);
  const candidates = arr(evidence.business_name_candidates).map(normalizeText).filter(Boolean);
  return candidates.some((candidate) => fp.some((name) => candidate.includes(name) || name.includes(candidate)));
}

function domainMatches(fingerprint = {}, evidence = {}, meta = {}) {
  const anchor = normalizeDomain(fingerprint.anchor_domain);
  const declared = uniq([...arr(evidence.domains), ...arr(meta.declared_domains), meta.declared_domain].filter(Boolean)).map(normalizeDomain);
  return Boolean(anchor && declared.includes(anchor));
}

export function evaluateBusinessEntityMatch(fingerprint = {}, sourceEvidence = {}, sourceMeta = {}) {
  if (!fingerprint?.anchor_domain || !arr(fingerprint.business_names).length) {
    return { ok: false, state: 'ENTITY_MATCH_REJECTED', error: 'BUSINESS_ENTITY_FINGERPRINT_REQUIRED', score: 0, signals: {} };
  }
  const signals = {
    business_name: nameMatches(fingerprint, sourceEvidence),
    same_domain: domainMatches(fingerprint, sourceEvidence, sourceMeta),
    phone: intersects(fingerprint.normalized_phones, sourceEvidence.normalized_phones, String),
    email: intersects(fingerprint.normalized_emails, sourceEvidence.normalized_emails, String),
    address: intersects(fingerprint.address_cores, sourceEvidence.address_cores, String),
    city_region: intersects(fingerprint.city_region, sourceEvidence.city_region, normalizeText),
    legal_entity: intersects(fingerprint.legal_entities, sourceEvidence.legal_entities, normalizeText),
    responsible_person: intersects(fingerprint.responsible_people, sourceEvidence.responsible_people, normalizeText),
    vat_id: intersects(fingerprint.vat_ids, sourceEvidence.vat_ids, normalizeText),
    official_social_link: arr(fingerprint.social_links).some((url) => clean(url, 2000).replace(/\/$/, '') === clean(sourceEvidence.source_url, 2000).replace(/\/$/, '')),
    brand_identity: intersects(fingerprint.brand_signals, sourceEvidence.brand_signals, normalizeText)
  };
  const weights = {
    business_name:0.18,same_domain:0.28,phone:0.20,email:0.20,address:0.18,city_region:0.08,
    legal_entity:0.22,responsible_person:0.10,vat_id:0.30,official_social_link:0.34,brand_identity:0.08
  };
  let score = Object.entries(signals).reduce((sum,[key,value]) => sum + (value ? weights[key] : 0), 0);
  const matchedSignalCount = Object.values(signals).filter(Boolean).length;
  const sourceCity = arr(sourceEvidence.city_region).map(normalizeText).filter(Boolean);
  const fpCity = arr(fingerprint.city_region).map(normalizeText).filter(Boolean);
  const explicitCityMismatch = sourceCity.length && fpCity.length && !signals.city_region && !signals.address;
  if (explicitCityMismatch && !signals.same_domain && !signals.vat_id && !signals.official_social_link) score -= 0.12;
  score = Math.max(0, Math.min(1, score));

  const strongIdentifier = signals.same_domain || signals.vat_id || signals.official_social_link;
  let state = 'ENTITY_MATCH_REJECTED';
  if ((strongIdentifier && score >= 0.50) || (matchedSignalCount >= 3 && score >= 0.72)) state = 'ENTITY_MATCH_CONFIRMED';
  else if (matchedSignalCount >= 2 && score >= 0.42) state = 'ENTITY_MATCH_HIGH_CONFIDENCE';
  else if (matchedSignalCount >= 1 && score >= 0.20) state = 'ENTITY_MATCH_AMBIGUOUS';

  return {
    ok: true,
    state,
    score: Math.round(score * 1000) / 1000,
    matched_signal_count: matchedSignalCount,
    signals,
    fail_closed: ['ENTITY_MATCH_AMBIGUOUS','ENTITY_MATCH_REJECTED'].includes(state),
    facts_may_be_ingested: ['ENTITY_MATCH_CONFIRMED','ENTITY_MATCH_HIGH_CONFIDENCE'].includes(state)
  };
}

export function sourceWeightForRole(role = '') {
  const key = clean(role, 120).toUpperCase();
  return BUSINESS_PUBLIC_SOURCE_WEIGHTS[key] ?? BUSINESS_PUBLIC_SOURCE_WEIGHTS.SECONDARY_WEB_SOURCE;
}

function ageDays(timestamp, nowMs = Date.now()) {
  const parsed = Date.parse(timestamp || '');
  return Number.isFinite(parsed) ? Math.max(0, (nowMs - parsed) / 86_400_000) : Infinity;
}

export function evaluateSourceFreshness(source = {}, fieldPath = '', options = {}) {
  const referenceTime = Number.isFinite(Number(options.reference_time_ms)) ? Number(options.reference_time_ms) : Date.now();
  const timestamp = source.visible_updated_at || source.fetched_at || null;
  const days = ageDays(timestamp, referenceTime);
  const timeSensitive = TIME_SENSITIVE_FIELDS.has(fieldPath);
  let score = 0.5;
  let state = 'UNKNOWN_FRESHNESS';
  if (Number.isFinite(days)) {
    if (timeSensitive) {
      if (days <= 30) { score = 1; state = 'FRESH'; }
      else if (days <= 180) { score = 0.85; state = 'RECENT'; }
      else if (days <= 365) { score = 0.65; state = 'AGING'; }
      else { score = 0.35; state = 'STALE'; }
    } else {
      if (days <= 365) { score = 1; state = 'FRESH'; }
      else if (days <= 730) { score = 0.85; state = 'RECENT'; }
      else { score = 0.6; state = 'AGING'; }
    }
  }
  return {
    timestamp,
    age_days: Number.isFinite(days) ? Math.round(days * 10) / 10 : null,
    time_sensitive: timeSensitive,
    state,
    score
  };
}

function factCandidatesFromEvidence(evidence = {}) {
  const out = [];
  for (const value of arr(evidence.phones)) out.push({field_path:'business.phone',value,critical:true});
  for (const value of arr(evidence.emails)) out.push({field_path:'business.email',value,critical:true});
  for (const value of arr(evidence.addresses)) out.push({field_path:'business.address',value,critical:true});
  for (const value of arr(evidence.opening_hours)) out.push({field_path:'business.opening_hours',value,critical:true});
  for (const value of arr(evidence.legal_entities)) out.push({field_path:'legal.entity',value,critical:true});
  for (const value of arr(evidence.responsible_people)) out.push({field_path:'legal.responsible_person',value,critical:true});
  for (const value of arr(evidence.vat_ids)) out.push({field_path:'legal.vat_id',value,critical:true});
  if (arr(evidence.products_services).length) out.push({field_path:'business.product_observations',value:clone(evidence.products_services),critical:false});
  if (arr(evidence.social_links).length) out.push({field_path:'social.links',value:clone(evidence.social_links),critical:false});
  if (arr(evidence.conversion_signals).length) out.push({field_path:'website.observed_conversion_signals',value:clone(evidence.conversion_signals),critical:false});
  return out;
}

function valueKey(fieldPath = '', value) {
  if (fieldPath === 'business.phone') return normalizePhone(value);
  if (fieldPath === 'business.email') return normalizeEmail(value);
  if (fieldPath === 'business.address') return normalizeAddress(value);
  if (fieldPath === 'legal.vat_id') return normalizeText(value).replace(/\s+/g, '');
  return normalizeText(typeof value === 'string' ? value : JSON.stringify(value));
}

export function ingestAnchorBusinessEvidence(state = {}, input = {}, options = {}) {
  const evidence = input.evidence || {};
  const sourceUrl = clean(input.source_url || evidence.source_url, 2000);
  if (!sourceUrl) return { ok:false,error:'ANCHOR_SOURCE_URL_REQUIRED' };
  const fetchedAt = clean(input.fetched_at || evidence.fetched_at, 80) || new Date().toISOString();
  const registered = registerProjectSource(state, {
    source_id: clean(input.source_id, 200) || 'primary-anchor-website',
    source_type:'OWNED_WEBSITE',
    source_role:'ANCHOR_OWNED_WEBSITE',
    locator:sourceUrl,
    source_url:sourceUrl,
    display_name:clean(input.display_name,300) || 'Primary anchor website',
    ownership_status:'OWNED_CONFIRMED',
    ingestion_status:'PRIMARY_ANCHOR_EVIDENCE',
    fetched_at:fetchedAt,
    visible_updated_at:clean(input.visible_updated_at || evidence.visible_updated_at,80) || null,
    entity_match_state:'ENTITY_MATCH_CONFIRMED',
    entity_match_score:1,
    source_weight:BUSINESS_PUBLIC_SOURCE_WEIGHTS.ANCHOR_OWNED_WEBSITE,
    source_metadata:{primary_anchor:true,rights_use:'OWNED_CONTENT_AND_FACT_EVIDENCE',automatic_customer_confirmation:false},
    website_usage:{content:true,structure_reference:false,design_reference:false}
  }, {at:options.at || fetchedAt});
  if(!registered.ok) return registered;
  let next=registered.state;
  const facts=[];
  for(const candidate of factCandidatesFromEvidence(evidence)){
    const freshness=evaluateSourceFreshness(registered.source,candidate.field_path,options);
    const provenance=[{
      source_id:registered.source.source_id,
      source_url:sourceUrl,
      source_type:'ANCHOR_OWNED_WEBSITE',
      fetched_at:fetchedAt,
      visible_updated_at:input.visible_updated_at || evidence.visible_updated_at || null,
      entity_match_state:'ENTITY_MATCH_CONFIRMED',
      entity_match_score:1,
      source_weight:BUSINESS_PUBLIC_SOURCE_WEIGHTS.ANCHOR_OWNED_WEBSITE,
      freshness_state:freshness.state,
      extracted_value:clone(candidate.value),
      existing_verification_state:'UNVERIFIED'
    }];
    const added=upsertProjectFact(next,{
      field_path:candidate.field_path,
      value:clone(candidate.value),
      origin:'EXTRACTED',
      verification_status:'UNVERIFIED',
      source_refs:[registered.source.source_id],
      provenance,
      evidence_classification:'HIGH_CONFIDENCE_CANDIDATE',
      confidence:Math.min(0.98,0.82+(freshness.score*0.16)),
      critical:candidate.critical,
      preserve_confirmed_precedence:true
    },{at:options.at || fetchedAt});
    if(!added.ok) return added;
    next=added.state;
    facts.push(added.fact);
  }
  return {ok:true,state:next,source:registered.source,facts,facts_ingested:facts.length,production_deploy:false,paid_provider_calls:0,variable_cost_eur:0};
}

export function ingestEntityMatchedPublicSource(state = {}, input = {}, options = {}) {
  const sourceUrl = clean(input.source_url || input.evidence?.source_url, 2000);
  const match = input.entity_match;
  if (!sourceUrl) return { ok:false,error:'PUBLIC_SOURCE_URL_REQUIRED' };
  if (!match || !ENTITY_MATCH_STATES.includes(match.state)) return { ok:false,error:'ENTITY_MATCH_RESULT_REQUIRED' };
  if (!['ENTITY_MATCH_CONFIRMED','ENTITY_MATCH_HIGH_CONFIDENCE'].includes(match.state)) {
    return { ok:true,state:clone(state),accepted:false,entity_match:clone(match),facts_ingested:0,fail_closed:true,production_deploy:false };
  }
  const sourceRole = clean(input.source_role, 120).toUpperCase() || 'SECONDARY_WEB_SOURCE';
  const weight = sourceWeightForRole(sourceRole);
  const fetchedAt = clean(input.fetched_at || input.evidence?.fetched_at, 80) || new Date().toISOString();
  const registered = registerProjectSource(state, {
    source_id: clean(input.source_id, 200) || sourceIdFromUrl(sourceUrl),
    source_type:'PUBLIC_WEB_SOURCE',
    source_role:sourceRole,
    locator:sourceUrl,
    source_url:sourceUrl,
    display_name:clean(input.display_name, 300) || sourceUrl,
    ownership_status:'UNKNOWN',
    ingestion_status:'ENTITY_MATCHED_PUBLIC_EVIDENCE',
    fetched_at:fetchedAt,
    visible_updated_at:clean(input.visible_updated_at || input.evidence?.visible_updated_at, 80) || null,
    entity_match_state:match.state,
    entity_match_score:match.score,
    source_weight:weight,
    source_metadata:{
      discovery_method:clean(input.discovery_method, 120) || 'PUBLIC_RESEARCH_CANDIDATE',
      match_signals:clone(match.signals),
      rights_use:'FACT_EVIDENCE_ONLY',
      publishable_asset_source:false,
      login_bypass:false,
      anti_bot_bypass:false
    }
  }, {at:options.at || fetchedAt});
  if(!registered.ok) return registered;
  let next=registered.state;
  const evidence=input.evidence || {};
  const facts=[];
  for(const candidate of factCandidatesFromEvidence(evidence)){
    const freshness=evaluateSourceFreshness({
      fetched_at:fetchedAt,
      visible_updated_at:input.visible_updated_at || evidence.visible_updated_at
    },candidate.field_path,options);
    const baseConfidence=Math.min(0.98, (match.score * 0.58) + (weight/100 * 0.27) + (freshness.score * 0.15));
    const provenance=[{
      source_id:registered.source.source_id,
      source_url:sourceUrl,
      source_type:sourceRole,
      fetched_at:fetchedAt,
      visible_updated_at:input.visible_updated_at || evidence.visible_updated_at || null,
      entity_match_state:match.state,
      entity_match_score:match.score,
      source_weight:weight,
      freshness_state:freshness.state,
      extracted_value:clone(candidate.value),
      existing_verification_state:'UNVERIFIED'
    }];
    const added=upsertProjectFact(next,{
      field_path:candidate.field_path,
      value:clone(candidate.value),
      origin:'EXTRACTED',
      verification_status:'UNVERIFIED',
      source_refs:[registered.source.source_id],
      provenance,
      evidence_classification:'HIGH_CONFIDENCE_CANDIDATE',
      confidence:baseConfidence,
      critical:candidate.critical,
      preserve_confirmed_precedence:true
    },{at:options.at || fetchedAt});
    if(!added.ok) return added;
    next=added.state;
    facts.push(added.fact);
  }
  return {
    ok:true,state:next,accepted:true,source:registered.source,entity_match:clone(match),
    facts_ingested:facts.length,facts:clone(facts),production_deploy:false,paid_provider_calls:0,variable_cost_eur:0
  };
}

export function corroborateProjectFacts(state = {}, options = {}) {
  let next=clone(state);
  const sources=new Map(arr(next.sources).map((source)=>[source.source_id,source]));
  const isResearchSource=(source)=>source&&['OWNED_WEBSITE','PUBLIC_WEB_SOURCE'].includes(source.source_type); const externalFacts=arr(next.facts).filter((fact)=>arr(fact.source_refs).some((id)=>isResearchSource(sources.get(id))));
  const fields=uniq(externalFacts.map((fact)=>fact.field_path));
  const summaries=[];

  for(const fieldPath of fields){
    const allFieldFacts=arr(next.facts).filter((fact)=>fact.field_path===fieldPath && !['REJECTED','OUTDATED'].includes(fact.verification_status));
    const authoritative=allFieldFacts.filter((fact)=>['CUSTOMER_CONFIRMED','OPERATOR_CONFIRMED','VERIFIED'].includes(fact.verification_status));
    const external=allFieldFacts.filter((fact)=>arr(fact.source_refs).some((id)=>isResearchSource(sources.get(id))));
    const groups=new Map();
    for(const fact of external){
      const key=valueKey(fieldPath,fact.value);
      const support=arr(fact.source_refs).map((id)=>sources.get(id)).filter((source)=>isResearchSource(source)&&(source.source_type==='OWNED_WEBSITE'||['ENTITY_MATCH_CONFIRMED','ENTITY_MATCH_HIGH_CONFIDENCE'].includes(source.entity_match_state)));
      const current=groups.get(key)||{key,value:clone(fact.value),facts:[],source_ids:new Set(),weighted_support:0,freshest:null};
      current.facts.push(fact);
      for(const source of support){
        if(current.source_ids.has(source.source_id)) continue;
        current.source_ids.add(source.source_id);
        const freshness=evaluateSourceFreshness(source,fieldPath,options);
        current.weighted_support += Number(source.source_weight || (source.source_type==='OWNED_WEBSITE'?BUSINESS_PUBLIC_SOURCE_WEIGHTS.ANCHOR_OWNED_WEBSITE:0)) * freshness.score;
        if(!current.freshest || (freshness.timestamp && Date.parse(freshness.timestamp)>Date.parse(current.freshest.timestamp||0))) current.freshest=freshness;
      }
      groups.set(key,current);
    }

    const distinct=[...groups.values()].filter((group)=>group.source_ids.size);
    const authoritativeKeys=new Set(authoritative.map((fact)=>valueKey(fieldPath,fact.value)));
    const conflict = distinct.length > 1 || (authoritativeKeys.size && distinct.some((group)=>!authoritativeKeys.has(group.key)));

    for(const group of distinct){
      let classification='HIGH_CONFIDENCE_CANDIDATE';
      if(conflict) classification='CONFLICT';
      else if(group.source_ids.size>=2) classification='CORROBORATED_CANDIDATE';
      const confidence=classification==='CORROBORATED_CANDIDATE'
        ? Math.min(0.98,0.72+Math.min(0.24,group.source_ids.size*0.06)+Math.min(0.08,group.weighted_support/2000))
        : classification==='CONFLICT' ? 0.5 : Math.min(0.9,0.55+Math.min(0.25,group.weighted_support/400));
      for(const fact of group.facts){
        const annotated=annotateProjectFactEvidence(next,fact.fact_id,{
          evidence_classification:classification,
          confidence,
          corroboration:{
            independent_source_count:group.source_ids.size,
            supporting_source_ids:[...group.source_ids],
            weighted_support:Math.round(group.weighted_support*10)/10,
            conflict,
            authoritative_fact_present:authoritative.length>0,
            majority_vote_used:false,
            freshest:clone(group.freshest)
          }
        },{at:options.at});
        if(!annotated.ok) return annotated;
        next=annotated.state;
      }
    }

    for(const fact of authoritative){
      const annotated=annotateProjectFactEvidence(next,fact.fact_id,{
        evidence_classification:'CONFIRMED',
        confidence:1,
        corroboration:{
          public_supporting_source_count:distinct.filter((group)=>authoritativeKeys.has(group.key)).reduce((sum,group)=>sum+group.source_ids.size,0),
          external_conflict_present:conflict,
          confirmed_precedence:true,
          majority_vote_used:false
        }
      },{at:options.at});
      if(!annotated.ok) return annotated;
      next=annotated.state;
    }

    summaries.push({
      field_path:fieldPath,
      classification:authoritative.length?'CONFIRMED':conflict?'CONFLICT':distinct.some((group)=>group.source_ids.size>=2)?'CORROBORATED_CANDIDATE':distinct.length?'HIGH_CONFIDENCE_CANDIDATE':'MISSING',
      authoritative_fact_count:authoritative.length,
      candidate_groups:distinct.map((group)=>({
        value:clone(group.value),
        independent_source_count:group.source_ids.size,
        supporting_source_ids:[...group.source_ids],
        weighted_support:Math.round(group.weighted_support*10)/10,
        freshness:clone(group.freshest)
      })),
      conflict,
      majority_vote_used:false
    });
  }
  return {ok:true,state:next,summaries,production_deploy:false,paid_provider_calls:0,variable_cost_eur:0};
}

export function discoverAnchorLinkedPublicSources(anchorImport = {}) {
  const social=uniq([
    ...arr(anchorImport.extracted_candidates?.social_links),
    ...arr(anchorImport.pages).flatMap((page)=>arr(page?.social_links))
  ]);
  return social.map((url,index)=>({
    candidate_id:`anchor-social-${index+1}`,
    url,
    discovery_method:'ANCHOR_DIRECT_LINK',
    source_role:'OFFICIAL_LINKED_SOCIAL',
    anchor_linked:true
  }));
}

export function entityAwareMultiSourceVerificationManifest() {
  return {
    schema:'aurentara.entity-aware-multi-source-verification.v1',
    existing_project_source_intake_reused:true,
    existing_website_import_reused:true,
    anchor_ingested_as_existing_owned_website:true,
    existing_fact_engine_reused:true,
    existing_fact_conflicts_reused:true,
    project_scoped:true,
    global_entity_database:false,
    source_weighting:true,
    freshness_aware:true,
    majority_vote:false,
    ambiguous_match_facts_ingested:false,
    rejected_match_facts_ingested:false,
    automatic_customer_confirmation:false,
    login_bypass:false,
    anti_bot_bypass:false,
    production_deploy:false,
    public_launch:false,
    paid_provider_calls:0
  };
}
