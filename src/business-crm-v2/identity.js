const clone = (v) => structuredClone(v ?? null);
const text = (v, max = 500) => String(v ?? '').trim().slice(0, max);
const lower = (v) => text(v).toLowerCase();

export function normalizeBusinessData(input = {}) {
  const email = lower(input.email).replace(/\s+/g,'');
  const phone = text(input.phone, 80).replace(/[^0-9+]/g,'').replace(/(?!^)\+/g,'');
  const companyName = text(input.company_name || input.company, 200).replace(/\s+/g,' ').trim();
  const domainRaw = lower(input.domain || (email.includes('@') ? email.split('@')[1] : '')).replace(/^https?:\/\//,'').replace(/^www\./,'').split('/')[0];
  const name = text(input.name || input.full_name, 200).replace(/\s+/g,' ');
  const country = text(input.country, 2).toUpperCase();
  const language = text(input.language, 12).replace('_','-').toLowerCase();
  const currency = text(input.currency, 3).toUpperCase();
  let date = null;
  if (input.date || input.datetime) { const d = new Date(input.date || input.datetime); if (!Number.isNaN(d.getTime())) date = d.toISOString(); }
  let timezone = text(input.timezone, 80) || null;
  if (timezone) { try { Intl.DateTimeFormat('en-US',{timeZone:timezone}); } catch { timezone = null; } }
  return { schema:'riosystems.business-normalized-data.v2', canonical: { name, email, phone, company_name:companyName, normalized_company: lower(companyName).replace(/[^a-z0-9äöüß]+/g,' ').trim(), domain:domainRaw, country, language, currency, date, timezone }, original: clone(input) };
}

function pairScore(candidate, record, type) {
  const a = normalizeBusinessData(candidate).canonical, b = normalizeBusinessData(record).canonical; let score = 0; const reasons = [];
  const externalA = text(candidate.external_id || candidate.external_ref, 160), externalB = text(record.external_id || record.external_ref, 160);
  if (externalA && externalB && externalA === externalB) { score += 0.7; reasons.push('external_id_exact'); }
  if (a.email && b.email && a.email === b.email) { score += type === 'company' ? 0.15 : 0.55; reasons.push('email_exact'); }
  if (a.phone && b.phone && a.phone === b.phone) { score += type === 'company' ? 0.1 : 0.25; reasons.push('phone_exact'); }
  if (a.normalized_company && b.normalized_company && a.normalized_company === b.normalized_company) { score += type === 'company' ? 0.45 : 0.12; reasons.push('company_name_exact'); }
  if (a.domain && b.domain && a.domain === b.domain) { score += type === 'company' ? 0.4 : 0.06; reasons.push('domain_exact'); }
  const addressA = lower(candidate.address), addressB = lower(record.address); if (addressA && addressB && addressA === addressB) { score += type === 'company' ? 0.2 : 0.04; reasons.push('address_exact'); }
  return { score: Math.min(1, Number(score.toFixed(2))), reasons };
}

function resolve(input, records, type) {
  const projectId = text(input.project_id,80); if (!projectId) return { ok:false, error:'IDENTITY_PROJECT_REQUIRED' };
  const candidates = (Array.isArray(records) ? records : []).filter((r) => r?.project_id === projectId).map((record) => ({ record, ...pairScore(input, record, type) })).filter((m) => m.score > 0).sort((a,b) => b.score - a.score);
  const best = candidates[0] || null, confidence = !best ? 0 : best.score, manualReview = confidence >= 0.35 && confidence < 0.9;
  return { ok:true, resolution: { project_id: projectId, type, confidence, match_reason: best?.reasons || [], matching_record_id: best?.record?.id || null, matching_records: candidates.slice(0,5).map((x) => ({ id:x.record.id, confidence:x.score, match_reason:x.reasons })), manual_review_required: manualReview, recommended_action: confidence >= 0.9 ? 'link_existing' : confidence >= 0.35 ? 'manual_review' : 'create_new', automatic_merge_allowed: false } };
}

export function detectLeadDuplicates(input = {}, records = []) { const resolved = resolve(input, records, 'lead'); if (!resolved.ok) return resolved; return { ok:true, duplicate_probability: resolved.resolution.confidence, matching_records: resolved.resolution.matching_records, recommended_action: resolved.resolution.recommended_action, manual_review_required: resolved.resolution.manual_review_required, automatic_merge_allowed:false }; }
export function resolveContactIdentity(input = {}, records = []) { return resolve(input, records, 'contact'); }
export function resolveCompanyIdentity(input = {}, records = []) { return resolve(input, records, 'company'); }
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9]{6,20}$/;

export function runCrmDataQuality(input = {}) {
  const projectId = text(input.project_id,80), records = Array.isArray(input.records) ? input.records : [], issues = [], required = input.required_fields || {}, validEnums = input.valid_enums || {}, ids = new Set(records.filter((r) => r?.project_id === projectId).map((r) => r.id)), emailSeen = new Map(), externalSeen = new Map(), now = input.now ? new Date(input.now).getTime() : Date.now(), staleMs = Number(input.stale_after_ms || 0);
  for (const record of records) {
    if (record.project_id !== projectId) { issues.push({ severity:'BLOCK', code:'CROSS_PROJECT_RECORD', id:record.id }); continue; }
    const entity = record.entity_type || record.type || 'unknown';
    for (const field of required[entity] || []) if (record[field] == null || record[field] === '') issues.push({ severity:'BLOCK', code:'MISSING_REQUIRED_FIELD', id:record.id, field });
    if (record.email) { const e = normalizeBusinessData({email:record.email}).canonical.email; if (!EMAIL_RE.test(e)) issues.push({ severity:'WARN', code:'INVALID_EMAIL', id:record.id }); const prev = emailSeen.get(e); if (prev && prev !== record.id) issues.push({ severity:'WARN', code:'POSSIBLE_DUPLICATE_EMAIL', id:record.id, matching_id:prev }); else emailSeen.set(e, record.id); }
    if (record.phone && !PHONE_RE.test(normalizeBusinessData({phone:record.phone}).canonical.phone)) issues.push({ severity:'WARN', code:'INVALID_PHONE', id:record.id });
    if (record.external_id) { const key=`${entity}:${record.external_id}`, prev=externalSeen.get(key); if (prev && prev!==record.id) issues.push({severity:'BLOCK',code:'DUPLICATE_EXTERNAL_ID',id:record.id,matching_id:prev}); else externalSeen.set(key,record.id); }
    for (const [field, allowed] of Object.entries(validEnums[entity] || {})) if (record[field] != null && !allowed.includes(record[field])) issues.push({severity:'BLOCK',code:'INVALID_ENUM',id:record.id,field,value:record[field]});
    for (const ref of record.relationship_refs || []) if (ref.required !== false && ref.id && !ids.has(ref.id)) issues.push({severity:'BLOCK',code:'ORPHAN_RELATION',id:record.id,ref:ref.id});
    if (staleMs > 0 && record.updated_at) { const ts=new Date(record.updated_at).getTime(); if (Number.isFinite(ts) && now-ts>staleMs) issues.push({severity:'WARN',code:'STALE_RECORD',id:record.id}); }
  }
  const status = issues.some((i)=>i.severity==='BLOCK') ? 'BLOCK' : issues.length ? 'WARN' : 'PASS';
  return { ok:status!=='BLOCK', schema:'riosystems.crm-data-quality.v2', status, issues, counts:{records:records.length, warnings:issues.filter((i)=>i.severity==='WARN').length, blockers:issues.filter((i)=>i.severity==='BLOCK').length} };
}
export function buildImportIdentityDecision(input = {}) { const duplicate = detectLeadDuplicates(input.record || {}, input.existing || []); return { schema:'riosystems.import-identity-decision.v2', duplicate_probability:duplicate.duplicate_probability, action:duplicate.recommended_action, manual_review_required:duplicate.manual_review_required, merge:false }; }
