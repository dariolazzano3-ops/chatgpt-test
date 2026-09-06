const clean = (value, max = 30000) => String(value ?? '').trim().slice(0, max);
const te = new TextEncoder();
const td = new TextDecoder();

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const value of bytes) binary += String.fromCharCode(value);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value) {
  const input = clean(value, 50000).replace(/-/g, '+').replace(/_/g, '/');
  const padded = input + '='.repeat((4 - input.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function derivedBytes(rootSecret, label) {
  const root = clean(rootSecret, 12000);
  if (root.length < 32) throw new Error('JARVIS_OAUTH_ROOT_SECRET_TOO_SHORT');
  return new Uint8Array(await crypto.subtle.digest('SHA-256', te.encode(label + '\n' + root)));
}

async function hmacKey(rootSecret) {
  return crypto.subtle.importKey(
    'raw',
    await derivedBytes(rootSecret, 'jarvis.oauth.state.hmac.v1'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

async function aesKey(rootSecret) {
  return crypto.subtle.importKey(
    'raw',
    await derivedBytes(rootSecret, 'jarvis.oauth.refresh-token.aes-gcm.v1'),
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

function aad(ownerId, ownerRef) {
  return te.encode('jarvis.oauth.google_calendar.v1|' + clean(ownerId, 80) + '|' + clean(ownerRef, 320));
}

export async function createJarvisOAuthStateV1({ root_secret, owner_id, now_ms = Date.now(), ttl_ms = 10 * 60 * 1000 } = {}) {
  const ownerId = clean(owner_id, 80);
  if (!ownerId) throw new Error('JARVIS_OAUTH_STATE_OWNER_REQUIRED');
  const nonce = crypto.getRandomValues(new Uint8Array(18));
  const payload = {
    v: 1,
    o: ownerId,
    n: bytesToBase64Url(nonce),
    exp: Math.floor(Number(now_ms) + Math.max(60_000, Math.min(Number(ttl_ms) || 600_000, 900_000)))
  };
  const encoded = bytesToBase64Url(te.encode(JSON.stringify(payload)));
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(root_secret), te.encode(encoded)));
  return encoded + '.' + bytesToBase64Url(signature);
}

export async function verifyJarvisOAuthStateV1(state, { root_secret, owner_id, now_ms = Date.now() } = {}) {
  const raw = clean(state, 10000);
  const parts = raw.split('.');
  if (parts.length !== 2) return { ok: false, error: 'JARVIS_OAUTH_STATE_FORMAT_INVALID' };

  let signature;
  try { signature = base64UrlToBytes(parts[1]); }
  catch { return { ok: false, error: 'JARVIS_OAUTH_STATE_SIGNATURE_INVALID' }; }

  const valid = await crypto.subtle.verify('HMAC', await hmacKey(root_secret), signature, te.encode(parts[0]));
  if (!valid) return { ok: false, error: 'JARVIS_OAUTH_STATE_SIGNATURE_INVALID' };

  let payload;
  try { payload = JSON.parse(td.decode(base64UrlToBytes(parts[0]))); }
  catch { return { ok: false, error: 'JARVIS_OAUTH_STATE_PAYLOAD_INVALID' }; }

  if (payload?.v !== 1 || clean(payload?.o, 80) !== clean(owner_id, 80)) {
    return { ok: false, error: 'JARVIS_OAUTH_STATE_OWNER_MISMATCH' };
  }
  const exp = Number(payload?.exp);
  if (!Number.isFinite(exp) || exp < Number(now_ms) || exp > Number(now_ms) + 16 * 60 * 1000) {
    return { ok: false, error: 'JARVIS_OAUTH_STATE_EXPIRED' };
  }

  return { ok: true, owner_id: payload.o, expires_at_ms: exp };
}

export async function encryptJarvisRefreshTokenV1(token, { root_secret, owner_id, owner_ref } = {}) {
  const plaintext = clean(token, 30000);
  if (!plaintext) throw new Error('JARVIS_OAUTH_REFRESH_TOKEN_REQUIRED');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({
    name: 'AES-GCM',
    iv,
    additionalData: aad(owner_id, owner_ref),
    tagLength: 128
  }, await aesKey(root_secret), te.encode(plaintext)));

  return {
    version: 1,
    ciphertext: bytesToBase64Url(ciphertext),
    iv: bytesToBase64Url(iv),
    plaintext_returned: false
  };
}

export async function decryptJarvisRefreshTokenV1(envelope = {}, { root_secret, owner_id, owner_ref } = {}) {
  if (Number(envelope?.crypto_version || envelope?.version || 1) !== 1) throw new Error('JARVIS_OAUTH_CRYPTO_VERSION_UNSUPPORTED');
  try {
    const plaintext = await crypto.subtle.decrypt({
      name: 'AES-GCM',
      iv: base64UrlToBytes(envelope.refresh_token_iv || envelope.iv),
      additionalData: aad(owner_id, owner_ref),
      tagLength: 128
    }, await aesKey(root_secret), base64UrlToBytes(envelope.refresh_token_ciphertext || envelope.ciphertext));
    return td.decode(plaintext);
  } catch {
    throw new Error('JARVIS_OAUTH_REFRESH_TOKEN_DECRYPT_FAILED');
  }
}

export function jarvisOAuthCryptoManifestV1() {
  return {
    schema: 'aurentara.jarvis.oauth-crypto.v1',
    state_hmac: 'HMAC-SHA-256',
    refresh_token_encryption: 'AES-256-GCM',
    key_derivation_domain_separated: true,
    root_secret_persisted: false,
    plaintext_refresh_token_persisted: false,
    hamyren_data_flow: false
  };
}
