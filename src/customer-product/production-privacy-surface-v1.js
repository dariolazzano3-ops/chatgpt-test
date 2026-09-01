const clean = (value, max = 8000) => String(value ?? '').trim().slice(0, max);
const SCHEMA = 'aurentara_customer_ai';
const PURPOSES = new Set(['persistent_business_memory','trusted_research','product_analytics','service_handoff']);

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer'
    }
  });
}

async function readJson(request, maxChars = 12000) {
  if (!String(request.headers.get('content-type') || '').toLowerCase().includes('application/json')) return { ok: false, error: 'CUSTOMER_JSON_REQUIRED' };
  const raw = await request.text();
  if (raw.length > maxChars) return { ok: false, error: 'CUSTOMER_REQUEST_TOO_LARGE' };
  try { return { ok: true, value: raw ? JSON.parse(raw) : {} }; } catch { return { ok: false, error: 'CUSTOMER_JSON_INVALID' }; }
}

function headers(config, accessToken, mutation = false) {
  return {
    'content-type': 'application/json',
    'apikey': config.publishable_key,
    'authorization': `Bearer ${accessToken}`,
    [mutation ? 'Content-Profile' : 'Accept-Profile']: SCHEMA
  };
}

async function fetchJson(fetchImpl, url, init = {}) {
  const response = await fetchImpl(url, init);
  let body = {};
  try { body = await response.json(); } catch {}
  return { ok: response.ok, status: response.status, body };
}

async function primaryMembership(config, accessToken, userId, fetchImpl) {
  const result = await fetchJson(
    fetchImpl,
    `${config.url}/rest/v1/memberships?select=tenant_id,role,status&user_id=eq.${encodeURIComponent(userId)}&status=eq.active&order=created_at.asc&limit=1`,
    { method: 'GET', headers: headers(config, accessToken, false) }
  );
  if (!result.ok) return { ok: false, error: 'CUSTOMER_MEMBERSHIP_READ_FAILED' };
  const membership = Array.isArray(result.body) ? result.body[0] : null;
  return membership ? { ok: true, membership } : { ok: false, error: 'ACTIVE_TENANT_MEMBERSHIP_REQUIRED' };
}

export function productionPrivacySurfaceManifest() {
  return {
    version: 'aurentara.customer.production-privacy-surface.v1',
    privacy_export_rpc: 'aurentara_customer_ai.export_my_workspace',
    consent_append_only: true,
    consent_purposes: [...PURPOSES],
    account_delete_edge_function: 'aurentara-delete-account-v1',
    service_role_in_worker: false,
    user_jwt_and_rls: true
  };
}

export async function handleProductionCustomerPrivacyRoute(request, context = {}) {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const config = context.config;
  const accessToken = clean(context.access_token, 12000);
  const userId = clean(context.user?.id, 120);
  const fetchImpl = context.fetch_impl || fetch;
  if (!config?.url || !config?.publishable_key || !accessToken || !userId) return null;

  if (url.pathname === '/customer/api/privacy/export' && method === 'GET') {
    const result = await fetchJson(fetchImpl, `${config.url}/rest/v1/rpc/export_my_workspace`, {
      method: 'POST',
      headers: headers(config, accessToken, true),
      body: '{}'
    });
    if (!result.ok) return { response: json({ ok: false, error: 'CUSTOMER_PRIVACY_EXPORT_FAILED', status: result.status }, result.status >= 500 ? 502 : 403), clear_session: false };
    return { response: json({ ok: true, export: result.body }), clear_session: false };
  }

  if (url.pathname === '/customer/api/privacy/consent' && method === 'GET') {
    const membership = await primaryMembership(config, accessToken, userId, fetchImpl);
    if (!membership.ok) return { response: json({ ok: false, error: membership.error }, 403), clear_session: false };
    const purpose = clean(url.searchParams.get('purpose'), 80);
    if (purpose && !PURPOSES.has(purpose)) return { response: json({ ok: false, error: 'CUSTOMER_CONSENT_PURPOSE_INVALID' }, 400), clear_session: false };
    const filter = purpose ? `&purpose=eq.${encodeURIComponent(purpose)}` : '';
    const result = await fetchJson(
      fetchImpl,
      `${config.url}/rest/v1/consent_events?select=consent_id,purpose,granted,policy_version,source,recorded_at&tenant_id=eq.${encodeURIComponent(membership.membership.tenant_id)}&user_id=eq.${encodeURIComponent(userId)}${filter}&order=recorded_at.desc,consent_id.desc`,
      { method: 'GET', headers: headers(config, accessToken, false) }
    );
    if (!result.ok) return { response: json({ ok: false, error: 'CUSTOMER_CONSENT_READ_FAILED' }, 502), clear_session: false };
    return { response: json({ ok: true, consent_events: Array.isArray(result.body) ? result.body : [] }), clear_session: false };
  }

  if (url.pathname === '/customer/api/privacy/consent' && method === 'POST') {
    const parsed = await readJson(request, 5000);
    if (!parsed.ok) return { response: json({ ok: false, error: parsed.error }, 400), clear_session: false };
    const purpose = clean(parsed.value?.purpose, 80);
    const policyVersion = clean(parsed.value?.policy_version, 120);
    const granted = parsed.value?.granted;
    if (!PURPOSES.has(purpose) || typeof granted !== 'boolean' || !policyVersion) {
      return { response: json({ ok: false, error: 'CUSTOMER_CONSENT_INPUT_INVALID' }, 400), clear_session: false };
    }
    const membership = await primaryMembership(config, accessToken, userId, fetchImpl);
    if (!membership.ok) return { response: json({ ok: false, error: membership.error }, 403), clear_session: false };
    const consentId = `consent_${crypto.randomUUID()}`;
    const event = {
      tenant_id: membership.membership.tenant_id,
      consent_id: consentId,
      user_id: userId,
      purpose,
      granted,
      policy_version: policyVersion,
      source: 'customer_ui'
    };
    const result = await fetchJson(fetchImpl, `${config.url}/rest/v1/consent_events`, {
      method: 'POST',
      headers: { ...headers(config, accessToken, true), 'prefer': 'return=representation' },
      body: JSON.stringify(event)
    });
    if (!result.ok) return { response: json({ ok: false, error: 'CUSTOMER_CONSENT_WRITE_FAILED' }, 502), clear_session: false };
    return { response: json({ ok: true, consent_event: Array.isArray(result.body) ? result.body[0] || event : event }, 201), clear_session: false };
  }

  if (url.pathname === '/customer/api/account/delete' && method === 'POST') {
    const parsed = await readJson(request, 3000);
    if (!parsed.ok) return { response: json({ ok: false, error: parsed.error }, 400), clear_session: false };
    if (parsed.value?.confirm !== 'DELETE_MY_AURENTARA_DATA') {
      return { response: json({ ok: false, error: 'EXPLICIT_DELETION_CONFIRMATION_REQUIRED' }, 400), clear_session: false };
    }
    const result = await fetchJson(fetchImpl, `${config.url}/functions/v1/aurentara-delete-account-v1`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'apikey': config.publishable_key,
        'authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ confirm: 'DELETE_MY_AURENTARA_DATA' })
    });
    if (!result.ok) return { response: json({ ok: false, error: result.body?.error || 'CUSTOMER_ACCOUNT_DELETION_FAILED', audit_id: result.body?.audit_id || null }, result.status >= 500 ? 502 : result.status), clear_session: false };
    return { response: json({ ok: true, deletion: result.body }), clear_session: true };
  }

  return null;
}
