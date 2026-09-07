import assert from 'node:assert/strict';
import { verifyJarvisCloudflareAccessJwtV1 } from '../src/jarvis/access-jwt-v1.js';

const b64url = (bytes) => Buffer.from(bytes).toString('base64url');
const encodeJson = (value) => b64url(Buffer.from(JSON.stringify(value)));

const keys = await crypto.subtle.generateKey(
  { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1,0,1]), hash: 'SHA-256' },
  true,
  ['sign', 'verify']
);
const jwk = await crypto.subtle.exportKey('jwk', keys.publicKey);
jwk.kid = 'jarvis-test-key';
jwk.alg = 'RS256';
jwk.use = 'sig';

const now = 1760000000000;
const header = encodeJson({ alg: 'RS256', typ: 'JWT', kid: jwk.kid });
const payload = encodeJson({
  iss: 'https://jarvis-test.cloudflareaccess.com',
  aud: ['jarvis-private-aud'],
  email: 'operator@example.invalid',
  exp: Math.floor(now / 1000) + 600,
  iat: Math.floor(now / 1000)
});
const signingInput = header + '.' + payload;
const signature = await crypto.subtle.sign(
  { name: 'RSASSA-PKCS1-v1_5' },
  keys.privateKey,
  new TextEncoder().encode(signingInput)
);
const token = signingInput + '.' + b64url(signature);

const fetch_impl = async (url) => {
  assert.equal(url, 'https://jarvis-test.cloudflareaccess.com/cdn-cgi/access/certs');
  return new Response(JSON.stringify({ keys: [jwk] }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
};

const valid = await verifyJarvisCloudflareAccessJwtV1({
  token,
  audience: 'jarvis-private-aud',
  team_domain: 'https://jarvis-test.cloudflareaccess.com',
  fetch_impl,
  now_ms: now
});
assert.equal(valid.ok, true);
assert.equal(valid.email, 'operator@example.invalid');
assert.equal(valid.signature_verified, true);

const wrongAud = await verifyJarvisCloudflareAccessJwtV1({
  token,
  audience: 'wrong-aud',
  team_domain: 'https://jarvis-test.cloudflareaccess.com',
  fetch_impl,
  now_ms: now
});
assert.equal(wrongAud.ok, false);
assert.equal(wrongAud.error, 'JARVIS_ACCESS_JWT_AUDIENCE_MISMATCH');

console.log('JARVIS Cloudflare Access JWT V1 smoke: PASS');
