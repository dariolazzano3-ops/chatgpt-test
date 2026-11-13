// FollowClean Cloudflare Worker template: inject JSON.stringify(index.html) into __FOLLOWCLEAN_HTML__ at build time.
// Live Instagram data: explicit OAuth consent for Business/Creator accounts only.
// Required Worker secrets: FC_IG_CLIENT_ID, FC_IG_CLIENT_SECRET, FC_IG_SESSION_SECRET (>=32 characters).
const FOLLOWCLEAN_HTML = __FOLLOWCLEAN_HTML__;
const COOKIE_SESSION = '__Host-fc-ig-session';
const COOKIE_OAUTH = '__Host-fc-ig-state';
const API_PREFIX = '/api/instagram/';
const GRAPH_VERSION = 'v27.0';
const MAX_COOKIE_AGE = 30 * 24 * 3600;
const MIN_GRAPH_REFRESH_MS = 60 * 1000;

function configured(env) {
  return typeof env.FC_IG_CLIENT_ID === 'string' && !!env.FC_IG_CLIENT_ID &&
    typeof env.FC_IG_CLIENT_SECRET === 'string' && !!env.FC_IG_CLIENT_SECRET &&
    typeof env.FC_IG_SESSION_SECRET === 'string' && env.FC_IG_SESSION_SECRET.length >= 32;
}
function headers(contentType) {
  return {'Content-Type': contentType, 'Cache-Control': 'private, no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer'};
}
function json(data, code = 200, cookies = []) {
  const h = new Headers(headers('application/json; charset=utf-8'));
  for (const cookie of cookies) h.append('Set-Cookie', cookie);
  return new Response(JSON.stringify(data), {status: code, headers: h});
}
function cookie(request, key) {
  const raw = request.headers.get('Cookie') || '';
  const item = raw.split(';').map(v => v.trim()).find(v => v.startsWith(key + '='));
  return item ? item.slice(key.length + 1) : null;
}
function cookieValue(name, value, age) {
  return name + '=' + value + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + age;
}
function clearCookie(name) { return cookieValue(name, '', 0); }
function toB64Url(bytes) {
  let string = '';
  for (const x of bytes) string += String.fromCharCode(x);
  return btoa(string).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64Url(raw) {
  if (!/^[A-Za-z0-9_-]{1,4000}$/.test(raw)) throw new Error('Bad session cookie');
  const padded = raw.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - raw.length % 4) % 4);
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}
async function keyFor(env) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(env.FC_IG_SESSION_SECRET));
  return crypto.subtle.importKey('raw', hash, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
async function seal(payload, env) {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({name: 'AES-GCM', iv: nonce}, await keyFor(env),
    new TextEncoder().encode(JSON.stringify(payload)));
  return toB64Url(nonce) + '.' + toB64Url(new Uint8Array(encrypted));
}
async function unseal(token, env) {
  try {
    if (!token || token.length > 3800) return null;
    const [left, right, extra] = token.split('.');
    if (!left || !right || extra) return null;
    const nonce = fromB64Url(left);
    if (nonce.length !== 12) return null;
    const plaintext = await crypto.subtle.decrypt({name: 'AES-GCM', iv: nonce},
      await keyFor(env), fromB64Url(right));
    const payload = JSON.parse(new TextDecoder().decode(plaintext));
    return payload && typeof payload === 'object' && payload.expiresAt > Date.now() && typeof payload.token === 'string'
      ? payload : null;
  } catch { return null; }
}
async function graphProfile(token) {
  const endpoint = new URL('https://graph.instagram.com/' + GRAPH_VERSION + '/me');
  endpoint.searchParams.set('fields', 'id,username,followers_count,follows_count');
  const res = await fetch(endpoint, {headers: {'Authorization': 'Bearer ' + token, 'Accept': 'application/json'},
    signal: AbortSignal.timeout(10000)});
  if (!res.ok) throw new Error('Instagram API response ' + res.status);
  const user = await res.json();
  const followers = user.followers_count;
  const following = user.follows_count;
  if (!/^[a-z0-9._]{1,30}$/.test(String(user.username || '').toLowerCase()) ||
    !Number.isSafeInteger(followers) || followers < 0 ||
    !Number.isSafeInteger(following) || following < 0) throw new Error('Invalid Instagram API profile');
  return {username: user.username.toLowerCase(), followers, following, fetchedAt: new Date().toISOString()};
}
async function exchangeToken(code, callbackUrl, env) {
  const form = new URLSearchParams({
    client_id: env.FC_IG_CLIENT_ID, client_secret: env.FC_IG_CLIENT_SECRET,
    grant_type: 'authorization_code', redirect_uri: callbackUrl, code
  });
  const shortResponse = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: form, signal: AbortSignal.timeout(10000)
  });
  if (!shortResponse.ok) throw new Error('Instagram authorization rejected');
  const short = await shortResponse.json();
  if (typeof short.access_token !== 'string' || !short.access_token) throw new Error('No authorization token');
  const longUrl = new URL('https://graph.instagram.com/access_token');
  longUrl.searchParams.set('grant_type', 'ig_exchange_token');
  longUrl.searchParams.set('client_secret', env.FC_IG_CLIENT_SECRET);
  longUrl.searchParams.set('access_token', short.access_token);
  const longResponse = await fetch(longUrl, {signal: AbortSignal.timeout(10000)});
  if (!longResponse.ok) throw new Error('Instagram token exchange failed');
  const long = await longResponse.json();
  if (typeof long.access_token !== 'string' || !long.access_token || !Number.isFinite(Number(long.expires_in)))
    throw new Error('Invalid Instagram token response');
  return {token: long.access_token, expiresAt: Date.now() + Number(long.expires_in) * 1000 - 60000};
}
function finishPage(success, cookies = []) {
  const title = success ? 'Instagram verbunden' : 'Instagram-Verbindung nicht abgeschlossen';
  const info = success ? 'Du kannst zu deinem FollowClean-Tab zurückkehren. Deine ZIP-Daten bleiben dort.' :
    'Die Verbindung wurde nicht eingerichtet. FollowClean funktioniert weiterhin mit deinem lokalen ZIP-Export.';
  const code = success ? 'connected' : 'error';
  const body = '<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<meta name="robots" content="noindex,nofollow"><title>' + title + ' · FollowClean</title>'+
    '<style>body{font:16px system-ui;background:#f6f8ff;color:#243452;display:grid;place-items:center;min-height:90vh;padding:20px}main{max-width:460px;background:white;padding:32px;border-radius:22px;box-shadow:0 15px 50px #304e7122}a{color:#205fae;font-weight:700}</style></head>'+
    '<body><main><h1>' + title + '</h1><p>' + info + '</p><p><a href="/">Zurück zu FollowClean</a></p></main>'+
    '<script>try{if(window.opener)window.opener.postMessage({type:"followclean:instagram:' + code + '"},location.origin)}catch(e){}</script></body></html>';
  const h = new Headers(headers('text/html; charset=utf-8'));
  for (const v of cookies) h.append('Set-Cookie', v);
  return new Response(body, {headers: h});
}
function redirect(location, cookies = []) {
  const h = new Headers(headers('text/plain; charset=utf-8'));
  h.set('Location', location);
  for (const v of cookies) h.append('Set-Cookie', v);
  return new Response('', {status: 302, headers: h});
}
async function handleApi(request, env, url) {
  const endpoint = url.pathname.slice(API_PREFIX.length);
  if (endpoint === 'status' && request.method === 'GET') {
    return json({available: configured(env), provider: 'instagram', accountTypes: ['BUSINESS', 'CREATOR']});
  }
  if (!configured(env)) return json({available: false, connected: false,
    error: 'meta_setup_required'}, 503);
  if (endpoint === 'connect' && request.method === 'GET') {
    const nonce = toB64Url(crypto.getRandomValues(new Uint8Array(24)));
    const callbackUrl = url.origin + API_PREFIX + 'callback';
    const authorizeUrl = new URL('https://www.instagram.com/oauth/authorize');
    authorizeUrl.searchParams.set('client_id', env.FC_IG_CLIENT_ID);
    authorizeUrl.searchParams.set('redirect_uri', callbackUrl);
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('scope', 'instagram_business_basic');
    authorizeUrl.searchParams.set('enable_fb_login', '0');
    authorizeUrl.searchParams.set('state', nonce);
    return redirect(authorizeUrl.toString(), [cookieValue(COOKIE_OAUTH, nonce, 600)]);
  }
  if (endpoint === 'callback' && request.method === 'GET') {
    const supplied = url.searchParams.get('state') || '';
    const expected = cookie(request, COOKIE_OAUTH);
    const removeState = clearCookie(COOKIE_OAUTH);
    const code = url.searchParams.get('code') || '';
    if (url.searchParams.has('error') || !code || code.length > 2048 || !expected || supplied !== expected)
      return finishPage(false, [removeState]);
    try {
      const tokenData = await exchangeToken(code.replace(/#_$/, ''), url.origin + API_PREFIX + 'callback', env);
      const sample = await graphProfile(tokenData.token);
      const session = {token: tokenData.token, expiresAt: tokenData.expiresAt, account: sample.username,
        sample, sampleAt: Date.now()};
      const sealed = await seal(session, env);
      return finishPage(true, [removeState, cookieValue(COOKIE_SESSION, sealed, MAX_COOKIE_AGE)]);
    } catch {
      return finishPage(false, [removeState]);
    }
  }
  if (endpoint === 'summary' && request.method === 'GET') {
    const session = await unseal(cookie(request, COOKIE_SESSION), env);
    if (!session) return json({available: true, connected: false});
    if (session.sample && Date.now() - session.sampleAt < MIN_GRAPH_REFRESH_MS)
      return json({available: true, connected: true, ...session.sample});
    try {
      const sample = await graphProfile(session.token);
      if (sample.username !== session.account) return json({available: true, connected: false,
        error: 'account_changed'}, 409, [clearCookie(COOKIE_SESSION)]);
      const sealed = await seal({...session, sample, sampleAt: Date.now()}, env);
      return json({available: true, connected: true, ...sample}, 200,
        [cookieValue(COOKIE_SESSION, sealed, Math.min(MAX_COOKIE_AGE,
          Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000))))]);
    } catch {
      return json({available: true, connected: true, error: 'instagram_temporarily_unavailable'}, 502);
    }
  }
  if (endpoint === 'disconnect' && request.method === 'POST') {
    const origin = request.headers.get('Origin');
    const sameSite = request.headers.get('Sec-Fetch-Site');
    if (origin !== url.origin || (sameSite && sameSite !== 'same-origin'))
      return json({error: 'origin_not_allowed'}, 403);
    return json({available: true, connected: false}, 200, [clearCookie(COOKIE_SESSION)]);
  }
  return json({error: 'not_found'}, 404);
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith(API_PREFIX)) return handleApi(request, env, url);
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', {status:405});
    if (url.pathname === '/robots.txt') return new Response('User-agent: *\nDisallow: /\n', {headers: headers('text/plain; charset=utf-8')});
    if (url.pathname !== '/' && url.pathname !== '/index.html') return new Response('Not found', {status:404});
    return new Response(request.method === 'HEAD' ? null : FOLLOWCLEAN_HTML,
      {headers: {...headers('text/html; charset=utf-8'), 'X-FollowClean-Release': 'followclean-v11-autoadvance-redrate'}});
  }
};