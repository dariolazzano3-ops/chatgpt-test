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


// Cost gate for potential username-only analyses. This endpoint never starts a paid Actor.
// All counts in public quote requests are UNVERIFIED hypothetical inputs. Never authorize a
// charged operation on the basis of these values or the browser's decision/status.
const FC_BUDGET_POLICY = Object.freeze({
  version: 'v2-lance-free',
  maxApiEurCents: 25,
  conservativeUsdCap: 0.20,
  autoFollowersMax: 1000,
  manualReviewFollowersMax: 5000,
  absoluteFollowingMax: 5000,
  referenceUsdPer1000: 1.50,
  referenceUsdRunFee: 0.001,
  referenceUsdProfileFee: 0.001,
  referenceRuns: 1,
  freeTierResultsLimitPerList: 100,
  bufferPercent: 20,
  extraReserveUsd: 0.01,
  // No provider contract/API key/business permission approved yet. Fail closed.
  executionEnabled: false
});
function validCount(n) { return Number.isSafeInteger(n) && n >= 0 && n <= 1000000000; }
function safeUsd(n) { return Math.ceil(n * 10000) / 10000; }
function estimateFollowCleanBudget(followers, following) {
  const p = FC_BUDGET_POLICY;
  if (!validCount(followers) || !validCount(following)) {
    return {status:'COUNTS_REQUIRED', eligible:false, estimatedUsd:null,
      message:'Verifizierte Follower- und Gefolgt-Zahlen erforderlich.'};
  }
  if (followers > p.manualReviewFollowersMax || following > p.absoluteFollowingMax) {
    return {status:'LARGE_PROFILE', eligible:false, estimatedUsd:null,
      message:'Großes Profil: keine automatische API-Abfrage. Lokalen ZIP-Import verwenden.'};
  }
  // One Actor run requests both relationship types. Include run and profile events.
  // This is only a quote at the documented reference tariff, NOT an executable budget reservation.
  const baseUsd = ((followers + following) / 1000) * p.referenceUsdPer1000 +
    p.referenceUsdRunFee * p.referenceRuns + p.referenceUsdProfileFee;
  const withReserveUsd = safeUsd(baseUsd * (1 + p.bufferPercent / 100) + p.extraReserveUsd);
  const withinBudget = withReserveUsd <= p.conservativeUsdCap;
  if (!withinBudget) {
    return {status:'OVER_BUDGET', eligible:false, estimatedUsd:withReserveUsd,
      message:'Kostenschätzung über unserem vorsichtigen $0,20-Limit. Keine automatische Abfrage.'};
  }
  if (followers > p.autoFollowersMax) {
    return {status:'REVIEW_REQUIRED', eligible:false, estimatedUsd:withReserveUsd,
      message:'Mittleres Profil: zusätzliche serverseitige Vorabprüfung erforderlich.'};
  }
  return {status:'CANDIDATE', eligible:true, estimatedUsd:withReserveUsd,
    message:'Kostenseitig geeignet, aber noch keine Berechtigung zum API-Start.'};
}

/*
 * Opt-in Apify adapter staging.
 * This Worker does not start actors, even if someone adds a token to Cloudflare.
 * A later release needs platform approval, account-ownership verification,
 * durable idempotency, global spend reservation, and an independently checked tariff.
 * Source: lance_api/instagram-followers-following-scraper.
 */
const FC_APIFY_ACTOR = 'lance_api~instagram-followers-following-scraper';
const FC_PROVIDER_EXECUTION_ENABLED = false;
function fcNormalizeUsername(value) {
  if (typeof value !== 'string') return null;
  const username = value.replace(/^@/,'').trim().toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(username) ? username : null;
}
function buildApifyDryRun(username, trustedCounts) {
  const name=fcNormalizeUsername(username);
  if (!name || !trustedCounts || trustedCounts.verifiedByServer !== true)
    return {ok:false,error:'trusted_account_counts_required'};
  if(trustedCounts.followers===0 && trustedCounts.following===0)
    return {ok:false,error:'no_relationships_to_analyze'};
  // Do not bypass actual budget denial just because the free plan has a coverage cap.
  const price=estimateFollowCleanBudget(trustedCounts.followers,trustedCounts.following);
  const maximum=Math.max(trustedCounts.followers,trustedCounts.following);
  if (maximum>FC_BUDGET_POLICY.freeTierResultsLimitPerList)
    return {ok:false,error:'FREE_TIER_LIMIT',quote:price,
      message:'Free-Tarif liest höchstens 100 pro Liste. Kein behauptetes Vollergebnis.'};
  if(price.status!=='CANDIDATE')return {ok:false,error:price.status,quote:price};
  // Apify API: maxItems is a query parameter, NOT maxPaidDatasetItems.
  // One list capped to <resultsLimit>, both directions capped via maxItems.
  const apiQuery={
    maxTotalChargeUsd:FC_BUDGET_POLICY.conservativeUsdCap,
    maxItems:trustedCounts.followers+trustedCounts.following,
    restartOnError:false,
    memory:128,
    timeout:90
  };
  return {
    ok:true,executed:false,provider:'Apify',actor:FC_APIFY_ACTOR,
    endpoint:'/v2/acts/'+FC_APIFY_ACTOR+'/runs',
    input:{profiles:[name],dataToScrape:'both',resultsLimit:Math.max(1,maximum)},
    runOptions:apiQuery,
    quote:price,
    gates:['owner_consent','actor_usage_approval','provider_credentials',
      'durable_idempotency','durable_global_spend_limit','current_tariff_verified']
  };
}

function buildApifyRequestDescription(draft){
  if (!draft || draft.ok!==true || draft.executed!==false ||
    draft.actor!==FC_APIFY_ACTOR || !draft.quote || draft.quote.status!=='CANDIDATE')
    return {ok:false,error:'invalid_draft'};
  const url=new URL('https://api.apify.com'+draft.endpoint);
  for(const [key,value] of Object.entries(draft.runOptions)){
    if(!['maxTotalChargeUsd','maxItems','restartOnError','memory','timeout'].includes(key))
      return {ok:false,error:'unexpected_query_param'};
    url.searchParams.set(key,String(value));
  }
  // Intentionally exclude tokens. Authorization belongs exclusively in a
  // private Worker secret header, never in URL, repo, client or logs.
  return {ok:true,executed:false,method:'POST',url:url.toString(),
    headers:{'Content-Type':'application/json','Authorization':'Bearer [WORKER_SECRET_ONLY]'},
    body:JSON.stringify(draft.input)};
}

// Conservative offline parser for *synthetic test fixtures only* until a verified
// external data source and provenance are available. Never trust public request
// bodies as proof of follower or following membership.
function validateApifyEvidence(username,counts,rows,summary){
  const source=fcNormalizeUsername(username);
  if(!source||!counts||counts.verifiedByServer!==true||
     !validCount(counts.followers)||!validCount(counts.following)||
     !Array.isArray(rows)||rows.length!==counts.followers+counts.following||
     !summary||summary.status!=='SUCCEEDED'||summary.billing?.confirmed!==true)
    return {ok:false,reason:'unverified_or_incomplete'};
  if(rows.length>1200) return {ok:false,reason:'over_test_limit'};
  const coverage=summary.results;
  if(!Array.isArray(coverage))return {ok:false,reason:'missing_coverage'};
  const followerProof=coverage.find(v=>v.relationshipType==='follower'&&fcNormalizeUsername(v.sourceUsername)===source);
  const followingProof=coverage.find(v=>v.relationshipType==='following'&&fcNormalizeUsername(v.sourceUsername)===source);
  if(!followerProof||!followingProof||
    [followerProof,followingProof].some(x=>x.coverageStatus!=='COMPLETE'||
      x.billingConfirmed!==true || x.hasNextPage===true) ||
    followerProof.deliveredCount!==counts.followers||
    followingProof.deliveredCount!==counts.following)
    return {ok:false,reason:'incomplete_coverage'};
  const followers=new Set(),following=new Map();
  for(const record of rows){
    if(!record||fcNormalizeUsername(record.sourceUsername)!==source||
       !['follower','following'].includes(record.relationshipType)||
       !/^[0-9]{1,32}$/.test(String(record.userId||''))||
       !fcNormalizeUsername(record.username))
      return {ok:false,reason:'ambiguous_record'};
    if(record.relationshipType==='follower'){
      if(followers.has(record.userId))return {ok:false,reason:'duplicate_record'};
      followers.add(record.userId);
    }else{
      if(following.has(record.userId))return {ok:false,reason:'duplicate_record'};
      following.set(record.userId,fcNormalizeUsername(record.username));
    }
  }
  if(followers.size!==counts.followers||following.size!==counts.following)
    return {ok:false,reason:'count_discrepancy'};
  const first=[...following].find(([id])=>!followers.has(id));
  return {ok:true,source:'synthetic_offline_evidence_parser',verifiedAgainstCounts:true,
    nonfollower:first?{username:first[1]}:null,
    coverageNote:'COMPLETE describes exposed pagination; Instagram may still omit accounts.'};
}

async function handleAnalysisBudget(request, env, url) {
  const endpoint=url.pathname.slice('/api/analysis/'.length);
  if (endpoint==='policy' && request.method==='GET') {
    return json({policy:FC_BUDGET_POLICY, apiProvider:'apify_standby',
      currencyNote:'Referenzpreis in USD, keine garantierte EUR-Umrechnung; vor Echtgeldbetrieb Wechselkurs und Providergebühren prüfen.'});
  }
  if (endpoint==='provider/status' && request.method==='GET') {
    return json({provider:'Apify', actor:FC_APIFY_ACTOR,
      configured:typeof env.FC_APIFY_TOKEN==='string'&&env.FC_APIFY_TOKEN.length>24,
      budgetDatabaseReady:!!env.FC_APIFY_BUDGET_DB,
      executionEnabled:FC_PROVIDER_EXECUTION_ENABLED, mode:'standby',
      acceptedAccounts:'owner-authorized test accounts only',
      analysisAvailable:false,
      note:'Kein Live-Scan, keine Bezahl-Anfrage und kein nicht verifizierter Nicht-Rückfolger.'});
  }
  if (endpoint==='provider/plan' && request.method==='POST') {
    if (request.headers.get('Origin')!==url.origin) return json({error:'origin_not_allowed'},403);
    if (!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))
      return json({error:'json_required'},415);
    if(Number(request.headers.get('content-length')||0)>256) return json({error:'body_too_large'},413);
    let input;
    try{
      const raw=await request.text();
      if(raw.length>256)return json({error:'body_too_large'},413);
      input=JSON.parse(raw);
    }catch{return json({error:'invalid_body'},400);}
    const username=fcNormalizeUsername(input?.username);
    if(!username)return json({error:'invalid_username'},400);
    // The username is never sent to Apify; public inputs cannot attest ownership.
    return json({username,provider:'Apify',executionEnabled:false,available:false,
      state:'AWAITING_VERIFIED_COUNTS_AND_PROVIDER_APPROVAL',
      message:'Test-Anbindung vorbereitet. Echte Analyse benötigt erlaubten Zugriff und geprüfte Daten.'});
  }
  if (endpoint==='start' && request.method==='POST') {
    return json({ok:false,error:'paid_provider_not_enabled',
      message:'Eine kostenpflichtige Instagram-Abfrage ist bewusst deaktiviert. ZIP-Analyse bleibt kostenlos.'},503);
  }
  if (endpoint==='quote' && request.method==='POST') {
    // Same-origin check limits cross-site use; no API token or secrets can be extracted here.
    if(request.headers.get('Origin')!==url.origin) return json({error:'origin_not_allowed'},403);
    if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))
      return json({error:'json_required'},415);
    if(Number(request.headers.get('content-length')||0)>512) return json({error:'body_too_large'},413);
    let input;
    try {
      const body=await request.text();
      if(body.length>512) return json({error:'body_too_large'},413);
      input=JSON.parse(body);
      if(!input || typeof input!=='object' || Array.isArray(input)) throw new Error('invalid');
    } catch {return json({error:'invalid_body'},400);}
    const quote=estimateFollowCleanBudget(input.followers,input.following);
    return json({estimateOnly:true, trustedCounts:false, quote, executionEnabled:false},200);
  }
  return json({error:'not_found'},404);
}

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
    if (url.pathname.startsWith('/api/analysis/')) return handleAnalysisBudget(request, env, url);
    if (url.pathname.startsWith(API_PREFIX)) return handleApi(request, env, url);
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', {status:405});
    if (url.pathname === '/robots.txt') return new Response('User-agent: *\nDisallow: /\n', {headers: headers('text/plain; charset=utf-8')});
    if (url.pathname !== '/' && url.pathname !== '/index.html') return new Response('Not found', {status:404});
    return new Response(request.method === 'HEAD' ? null : FOLLOWCLEAN_HTML,
      {headers: {...headers('text/html; charset=utf-8'), 'X-FollowClean-Release': 'followclean-v14-safe-after-apify-scope-audit'}});
  }
};