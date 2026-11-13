// Run: node apps/followclean/tests/instagram-live-worker-smoke.mjs
// Local synthetic assertions only. No real Meta token, account, ZIP or paid checkout.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import '../build-instagram-worker.mjs';

const content = await readFile(new URL('../dist/worker.mjs', import.meta.url), 'utf8');
const { default: worker } = await import('data:text/javascript;base64,' + Buffer.from(content).toString('base64'));
const origin = 'https://followclean.example';
const env = {
  FC_IG_CLIENT_ID: 'test-app-123',
  FC_IG_CLIENT_SECRET: 'not-real-ig-app-secret',
  FC_IG_SESSION_SECRET: 'synthetic-only-32-character-long-session-secret'
};
let passed = 0;
async function test(name, execute) {
  try { await execute(); passed++; console.log('PASS', name); }
  catch (error) { console.error('FAIL', name, error); process.exitCode = 1; }
}
const hit = (path, opts = {}, config = {}) => worker.fetch(new Request(origin + path, opts), config);
const noConfig = {};
await test('no secrets => safe unavailable status', async () => {
  const reply = await hit('/api/instagram/status', {}, noConfig);
  assert.equal(reply.status, 200);
  assert.deepEqual((await reply.json()).available, false);
  assert.equal((await hit('/api/instagram/connect', {}, noConfig)).status, 503);
});
await test('existing HTML, noindex and Stripe sandbox are intact', async () => {
  const reply = await hit('/');
  const html = await reply.text();
  assert.equal(reply.status, 200);
  assert.match(html, /id="fc-live-following"/);
  assert.match(html, /id="stat-nonfollowers"/);
  assert.match(html, /buy\.stripe\.com\/test_/);
  assert.match(html, /noindex/);
  assert.doesNotMatch(html, /not-real-ig-app-secret/);
});
await test('local-only baseline remains separated from API', async () => {
  const html = await (await hit('/')).text();
  assert.match(html, /Die Nicht-Rückfolger-Liste ist eine Momentaufnahme/);
  assert.match(html, /keine Differenz zwischen verschiedenen Konten/);
});
await test('OAuth requires CSRF state cookie', async () => {
  const start = await hit('/api/instagram/connect', {}, env);
  assert.equal(start.status, 302);
  const redirect = new URL(start.headers.get('location'));
  assert.equal(redirect.hostname, 'www.instagram.com');
  assert.equal(redirect.searchParams.get('scope'), 'instagram_business_basic');
  assert.equal(redirect.searchParams.get('redirect_uri'), origin + '/api/instagram/callback');
  assert.match(start.headers.get('set-cookie'), /HttpOnly; Secure; SameSite=Lax/);
  assert.ok(redirect.searchParams.get('state'));
});
await test('wrong CSRF state refuses code without contacting Instagram', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('Should never contact Instagram'); };
  try {
    const bad = await hit('/api/instagram/callback?state=bad&code=untrusted', {}, env);
    assert.equal(bad.status, 200);
    assert.match(await bad.text(), /nicht abgeschlossen/);
  } finally { globalThis.fetch = original; }
});
await test('synthetic Meta login creates encrypted HttpOnly session', async () => {
  const first = await hit('/api/instagram/connect', {}, env);
  const auth = new URL(first.headers.get('location'));
  const oauthCookie = first.headers.get('set-cookie').split(';')[0];
  const priorFetch = globalThis.fetch;
  const upstream = [];
  globalThis.fetch = async (url, opts = {}) => {
    upstream.push({url: String(url), method: opts.method, auth: opts.headers?.Authorization});
    if (String(url).includes('api.instagram.com/oauth/access_token'))
      return Response.json({access_token:'synthetic-short-token'});
    if (String(url).includes('graph.instagram.com/access_token'))
      return Response.json({access_token:'synthetic-long-token',expires_in:5184000});
    if (String(url).includes('/me?'))
      return Response.json({username:'test.creator',followers_count:636,follows_count:451,id:'test-user-id'});
    return new Response('Unknown mock URL', {status:404});
  };
  try {
    const callback = await hit('/api/instagram/callback?state=' +
      encodeURIComponent(auth.searchParams.get('state')) + '&code=synthetic-code',
      {headers:{Cookie:oauthCookie}}, env);
    assert.equal(callback.status, 200);
    assert.match(await callback.text(), /Instagram verbunden/);
    const sessionCookie = callback.headers.getSetCookie().find(v => v.startsWith('__Host-fc-ig-session='));
    assert.ok(sessionCookie);
    assert.match(sessionCookie, /HttpOnly; Secure; SameSite=Lax/);
    assert.doesNotMatch(sessionCookie, /synthetic-long-token/);
    assert.equal(upstream.length, 3);
    assert.equal(upstream.at(-1).auth, 'Bearer synthetic-long-token');
    const stats = await hit('/api/instagram/summary',
      {headers:{Cookie: sessionCookie.split(';')[0]}}, env);
    const data = await stats.json();
    assert.equal(data.connected, true);
    assert.equal(data.username, 'test.creator');
    assert.equal(data.followers, 636);
    assert.equal(data.following, 451);
    assert.equal(data.fetchedAt.length > 10, true);
    assert.equal(upstream.length, 3); // cached after callback, no gratuitous polling
  } finally { globalThis.fetch = priorFetch; }
});
await test('disconnect rejects cross-origin requests', async () => {
  const wrong = await hit('/api/instagram/disconnect',
    {method:'POST',headers:{Origin:'https://evil.example'}}, env);
  assert.equal(wrong.status, 403);
  const right = await hit('/api/instagram/disconnect',
    {method:'POST',headers:{Origin:origin,'Sec-Fetch-Site':'same-origin'}}, env);
  assert.equal(right.status, 200);
  assert.match(right.headers.get('set-cookie'), /Max-Age=0/);
});
await test('missing session never invents stats', async () => {
  const response = await hit('/api/instagram/summary', {}, env);
  assert.deepEqual(await response.json(), {available:true,connected:false});
});
console.log('Instagram Worker smoke:', passed, 'checks passed');
if (process.exitCode) process.exit(process.exitCode);
