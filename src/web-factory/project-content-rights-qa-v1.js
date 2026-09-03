const APPROVED_RIGHTS = new Set(['OWNED_CONFIRMED', 'CUSTOMER_LICENSED', 'CUSTOMER_ASSERTED']);
const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);

function textFromArtifact(artifact = {}) {
  return Object.entries(artifact.files || {}).filter(([name]) => name.endsWith('.html')).map(([, value]) => String(value)).join('\n').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
}
function normalized(value) { return clean(value, 1000).replace(/\s+/g, ' ').toLowerCase(); }
function listCanonical(values = {}, patterns = []) {
  const out = [];
  for (const [key, value] of Object.entries(values)) {
    if (!patterns.some((pattern) => pattern.test(key))) continue;
    if (Array.isArray(value)) value.forEach((item) => out.push(normalized(item)));
    else if (value && typeof value === 'object') out.push(normalized(JSON.stringify(value)));
    else if (value != null) out.push(normalized(value));
  }
  return out.filter(Boolean);
}
function tokens(text, regex) { return [...new Set((String(text).match(regex) || []).map(normalized).filter(Boolean))]; }
function categoryFor(code) {
  if (/RIGHTS|ASSET/.test(code)) return 'rights';
  if (/PROVENANCE|PACK_VERSION_EVIDENCE/.test(code)) return 'provenance';
  if (/SCOPE_ISOLATION/.test(code)) return 'security';
  return 'content';
}

export function runProjectContentRightsQa(artifact = {}, projectContext = artifact.project_mission_context || null) {
  const issues = [];
  const block = (code, message, details = {}) => issues.push({ category: categoryFor(code), code, message, severity: 'blocking', ...details });
  if (!projectContext) return { schema: 'aurentara.project-content-rights-qa.v1', status: 'NOT_APPLICABLE', blocking_issues: [], warnings: [], checks: { project_context_present: false } };
  if (projectContext.schema !== 'aurentara.project-mission-context.v1') block('PROJECT_CONTEXT_INVALID', 'Project mission context schema is invalid.');
  if (projectContext.readiness_ref?.status === 'BLOCKED') block('PROJECT_CONTENT_READINESS_BLOCKED', 'Blocked content readiness cannot enter a Web Factory build.');
  const revision = Number(projectContext.knowledge_revision);
  if ([projectContext.content_pack_ref?.knowledge_revision, projectContext.visual_pack_ref?.knowledge_revision, projectContext.readiness_ref?.knowledge_revision].some((value) => Number(value) !== revision)) block('PROJECT_PACK_BINDING_STALE', 'Content, visual and readiness bindings must share the compiled knowledge revision.');
  if (!projectContext.content_pack_ref?.pack_id || !projectContext.visual_pack_ref?.pack_id || !projectContext.readiness_ref?.readiness_id) block('PROJECT_PACK_VERSION_EVIDENCE_MISSING', 'Pack and readiness version evidence is required.');

  const values = projectContext.verified_content || {};
  const provenance = Array.isArray(projectContext.content_provenance) ? projectContext.content_provenance : [];
  const criticalKeys = Object.keys(values).filter((key) => /price|pricing|business\.name|phone|email|address|opening_hours|legal|offerings|services|products/i.test(key));
  for (const key of criticalKeys) {
    const evidence = provenance.find((item) => item.field_path === key);
    if (!evidence || !Array.isArray(evidence.source_refs) || evidence.source_refs.length === 0) block('CRITICAL_FACT_PROVENANCE_MISSING', `Critical project fact ${key} has no source provenance.`, { field_path: key });
    if (evidence && !['OPERATOR_CONFIRMED', 'CUSTOMER_CONFIRMED', 'VERIFIED'].includes(evidence.verification_status)) block('CRITICAL_FACT_VERIFICATION_NOT_ALLOWED', `Critical project fact ${key} uses a non-approved verification state.`, { field_path: key, verification_status: evidence.verification_status });
  }

  const htmlText = textFromArtifact(artifact);
  const approvedPrices = listCanonical(values, [/price|pricing/i]);
  const renderedPrices = tokens(htmlText, /\b\d{1,5}(?:[.,]\d{1,2})?\s?(?:€|EUR)\b/gi);
  for (const price of renderedPrices) if (approvedPrices.length && !approvedPrices.some((approved) => approved.includes(price) || price.includes(approved))) block('RENDERED_PRICE_NOT_IN_APPROVED_PACK', `Rendered price ${price} is not present in the approved Content Pack.`, { value: price });
  if (renderedPrices.length && !approvedPrices.length) block('RENDERED_PRICE_WITHOUT_APPROVED_FACT', 'Rendered prices require an approved pricing fact.');

  const approvedEmails = listCanonical(values, [/email/i]);
  const renderedEmails = tokens(htmlText, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
  for (const email of renderedEmails) if (!approvedEmails.some((approved) => approved.includes(email) || email.includes(approved))) block('RENDERED_EMAIL_NOT_IN_APPROVED_PACK', `Rendered email ${email} is not present in the approved Content Pack.`, { value: email });

  const approvedPhones = listCanonical(values, [/phone/i]);
  const renderedPhones = tokens(htmlText, /(?:\+?\d[\d\s().\/-]{6,}\d)/g);
  for (const phone of renderedPhones) if (approvedPhones.length && !approvedPhones.some((approved) => approved.includes(phone) || phone.includes(approved))) block('RENDERED_PHONE_NOT_IN_APPROVED_PACK', `Rendered phone ${phone} is not present in the approved Content Pack.`, { value: phone });
  if (renderedPhones.length && !approvedPhones.length) block('RENDERED_PHONE_WITHOUT_APPROVED_FACT', 'Rendered phone numbers require an approved phone fact.');

  const assets = Array.isArray(projectContext.assets) ? projectContext.assets : [];
  const assetById = new Map(assets.map((asset) => [asset.asset_id, asset]));
  const usedIds = Array.isArray(artifact.used_project_asset_ids) ? artifact.used_project_asset_ids : [];
  for (const asset of assets) if (!APPROVED_RIGHTS.has(asset.rights_status) || asset.publishable !== true) block('UNPUBLISHABLE_ASSET_IN_VISUAL_PACK', `Asset ${asset.asset_id || 'unknown'} is not publishable.`, { asset_id: asset.asset_id || null, rights_status: asset.rights_status || null });
  for (const assetId of usedIds) {
    const asset = assetById.get(assetId);
    if (!asset) block('USED_PROJECT_ASSET_NOT_IN_APPROVED_PACK', `Used asset ${assetId} is not present in the approved Visual Pack.`, { asset_id: assetId });
    else if (!APPROVED_RIGHTS.has(asset.rights_status) || asset.publishable !== true) block('USED_PROJECT_ASSET_RIGHTS_BLOCKED', `Used asset ${assetId} does not have publishable rights.`, { asset_id: assetId, rights_status: asset.rights_status });
  }

  if (!artifact.project_scope_key) block('PROJECT_SCOPE_ISOLATION_MISSING', 'Bound project builds must retain their project scope key.');
  else if (artifact.project_scope_key !== projectContext.project?.scope_key) block('PROJECT_SCOPE_ISOLATION_MISMATCH', 'Artifact project scope differs from compiled project scope.');
  return { schema: 'aurentara.project-content-rights-qa.v1', status: issues.length ? 'FAIL' : 'PASS', blocking_issues: issues, warnings: [], checks: { project_context_present: true, provenance_checked: true, critical_rendered_facts_checked: true, asset_rights_checked: true, pack_versions_checked: true, project_scope_checked: true } };
}
