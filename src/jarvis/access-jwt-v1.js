const clean = (value, max = 12000) => String(value ?? '').trim().slice(0, max);

function b64urlBytes(value) {
  const normalized = clean(value, 24000).replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const raw = atob(padded);
  return Uint8Array.from(raw, (ch) => ch.charCodeAt(0));
}

function parseJsonPart(value) {
  try {
    return JSON.parse(new TextDecoder().decode(b64urlBytes(value)));
  } catch {
    throw new Error('JARVIS_ACCESS_JWT_MALFORMED');
  }
}

function normalizeTeamDomain(value) {
  const raw = clean(value, 1000);
  if (!raw) throw new Error('JARVIS_ACCESS_TEAM_DOMAIN_REQUIRED');
  let url;
  try {
    url = new URL(raw.includes('://') ? raw : 'https://' + raw);
  } catch {
    throw new Error('JARVIS_ACCESS_TEAM_DOMAIN_INVALID');
  }
  if (url.protocol !== 'https:') throw new Error('JARVIS_ACCESS_TEAM_DOMAIN_INVALID');
  return url.origin;
}

function audienceMatches(payloadAud, expectedAud) {
  const expected = clean(expectedAud, 1000);
  if (!expected) return false;
  if (Array.isArray(payloadAud)) return payloadAud.some((item) => clean(item, 1000) === expected);
  return clean(payloadAud, 1000) === expected;
}

export async function verifyJarvisCloudflareAccessJwtV1({
  token,
  audience,
  team_domain,
  fetch_impl = globalThis.fetch,
  now_ms = Date.now()
} = {}) {
  const jwt = clean(token, 24000);
  if (!jwt) return { ok: false, error: 'JARVIS_ACCESS_JWT_REQUIRED' };
  const parts = jwt.split('.');
  if (parts.length !== 3) return { ok: false, error: 'JARVIS_ACCESS_JWT_MALFORMED' };

  let header;
  let payload;
  try {
    header = parseJsonPart(parts[0]);
    payload = parseJsonPart(parts[1]);
  } catch (error) {
    return { ok: false, error: clean(error?.message || error, 200) };
  }

  if (header?.alg !== 'RS256' || !clean(header?.kid, 500)) {
    return { ok: false, error: 'JARVIS_ACCESS_JWT_ALGORITHM_REJECTED' };
  }

  let issuer;
  try {
    issuer = normalizeTeamDomain(team_domain);
  } catch (error) {
    return { ok: false, error: clean(error?.message || error, 200) };
  }

  if (normalizeTeamDomain(payload?.iss || '') !== issuer) {
    return { ok: false, error: 'JARVIS_ACCESS_JWT_ISSUER_MISMATCH' };
  }
  if (!audienceMatches(payload?.aud, audience)) {
    return { ok: false, error: 'JARVIS_ACCESS_JWT_AUDIENCE_MISMATCH' };
  }

  const now = Math.floor(Number(now_ms) / 1000);
  if (!Number.isFinite(Number(payload?.exp)) || Number(payload.exp) <= now) {
    return { ok: false, error: 'JARVIS_ACCESS_JWT_EXPIRED' };
  }
  if (payload?.nbf != null && Number(payload.nbf) > now + 30) {
    return { ok: false, error: 'JARVIS_ACCESS_JWT_NOT_YET_VALID' };
  }

  if (typeof fetch_impl !== 'function') return { ok: false, error: 'JARVIS_ACCESS_JWKS_FETCH_REQUIRED' };

  let jwks;
  try {
    const response = await fetch_impl(issuer + '/cdn-cgi/access/certs', {
      headers: { accept: 'application/json' }
    });
    if (!response.ok) return { ok: false, error: 'JARVIS_ACCESS_JWKS_UNAVAILABLE' };
    jwks = await response.json();
  } catch {
    return { ok: false, error: 'JARVIS_ACCESS_JWKS_UNAVAILABLE' };
  }

  const jwk = Array.isArray(jwks?.keys)
    ? jwks.keys.find((item) => clean(item?.kid, 500) === clean(header.kid, 500))
    : null;
  if (!jwk) return { ok: false, error: 'JARVIS_ACCESS_JWK_NOT_FOUND' };

  try {
    const key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const signed = new TextEncoder().encode(parts[0] + '.' + parts[1]);
    const signature = b64urlBytes(parts[2]);
    const valid = await crypto.subtle.verify(
      { name: 'RSASSA-PKCS1-v1_5' },
      key,
      signature,
      signed
    );
    if (!valid) return { ok: false, error: 'JARVIS_ACCESS_JWT_SIGNATURE_INVALID' };
  } catch {
    return { ok: false, error: 'JARVIS_ACCESS_JWT_SIGNATURE_INVALID' };
  }

  const email = clean(payload?.email, 320).toLowerCase();
  if (!email) return { ok: false, error: 'JARVIS_ACCESS_JWT_EMAIL_REQUIRED' };

  return {
    ok: true,
    email,
    audience_verified: true,
    issuer_verified: true,
    signature_verified: true,
    exp: Number(payload.exp)
  };
}

export function jarvisAccessJwtManifestV1() {
  return {
    schema: 'jarvis.cloudflare-access-jwt.v1',
    algorithm: 'RS256',
    signature_validation: true,
    audience_validation: true,
    issuer_validation: true,
    expiry_validation: true,
    email_claim_required: true,
    header_only_trust: false
  };
}
