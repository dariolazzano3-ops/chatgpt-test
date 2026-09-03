import { quickImportProjectWebsite, validatePublicUrl } from './scraper.js';

const MAX_ROBOTS_BYTES = 250_000;
const MAX_REDIRECTS = 5;
const FETCH_TIMEOUT_MS = 10_000;

function parseRobots(text = '') {
  const disallow = [];
  let applies = false;
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const index = line.indexOf(':');
    if (index < 0) continue;
    const key = line.slice(0, index).trim().toLowerCase();
    const value = line.slice(index + 1).trim();
    if (key === 'user-agent') applies = value === '*' || /aurentara|chatgpt-project-factory/i.test(value);
    else if (key === 'disallow' && applies && value) disallow.push(value);
  }
  return [...new Set(disallow)];
}

function robotsAllowsRoot(disallow = []) {
  return !disallow.includes('/');
}

async function readBoundedText(response, maxBytes = MAX_ROBOTS_BYTES) {
  const declared = Number(response.headers?.get?.('content-length') || 0);
  if (declared > maxBytes) return { ok: false, error: 'ROBOTS_RESPONSE_TOO_LARGE' };
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) return { ok: false, error: 'ROBOTS_RESPONSE_TOO_LARGE' };
  return { ok: true, text };
}

async function preflightRobots(sourceUrl, fetcher) {
  let current = new URL('/robots.txt', sourceUrl);
  const sourceOrigin = sourceUrl.origin;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    if (current.origin !== sourceOrigin) return { ok: false, error: 'ROBOTS_CROSS_ORIGIN_REDIRECT_BLOCKED' };
    const checked = validatePublicUrl(current);
    if (!checked.ok) return { ok: false, error: checked.error };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let response;
    try {
      response = await fetcher(checked.url.toString(), {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'user-agent': 'Aurentara-Project-Source-Intake/1.0 (+robots-preflight)' }
      });
    } catch (error) {
      clearTimeout(timeout);
      return { ok: false, error: error?.name === 'AbortError' ? 'ROBOTS_FETCH_TIMEOUT' : 'ROBOTS_FETCH_FAILED' };
    }
    clearTimeout(timeout);
    if (response.status >= 300 && response.status < 400) {
      if (hop >= MAX_REDIRECTS) return { ok: false, error: 'ROBOTS_REDIRECT_LIMIT_EXCEEDED' };
      const location = response.headers?.get?.('location');
      if (!location) return { ok: false, error: 'ROBOTS_REDIRECT_LOCATION_MISSING' };
      let target;
      try { target = new URL(location, checked.url); } catch { return { ok: false, error: 'ROBOTS_REDIRECT_TARGET_INVALID' }; }
      if (target.origin !== sourceOrigin) return { ok: false, error: 'ROBOTS_CROSS_ORIGIN_REDIRECT_BLOCKED' };
      current = target;
      continue;
    }
    if (response.status === 404) return { ok: true, status: 'NOT_FOUND', disallow: [] };
    if (!response.ok) return { ok: false, error: `ROBOTS_HTTP_${response.status}` };
    const body = await readBoundedText(response);
    if (!body.ok) return body;
    const disallow = parseRobots(body.text);
    return { ok: robotsAllowsRoot(disallow), status: 'RESPECTED', disallow, error: robotsAllowsRoot(disallow) ? null : 'ROBOTS_DISALLOWS_IMPORT' };
  }
  return { ok: false, error: 'ROBOTS_REDIRECT_LIMIT_EXCEEDED' };
}

function guardedFetcher(sourceOrigin, fetcher) {
  return async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    const allowedDns = url.origin === 'https://cloudflare-dns.com';
    if (!allowedDns && url.origin !== sourceOrigin) {
      throw Object.assign(new Error('PROJECT_SOURCE_CROSS_ORIGIN_FETCH_BLOCKED'), { code: 'PROJECT_SOURCE_CROSS_ORIGIN_FETCH_BLOCKED' });
    }
    return fetcher(input, init);
  };
}

export async function importProjectWebsiteSource(input = {}, deps = {}) {
  const checked = validatePublicUrl(input.source_url);
  if (!checked.ok) return { ok: false, error: checked.error, import_status: 'IMPORT_BLOCKED', variable_cost_eur: 0, paid_provider_calls: 0, production_deploy: false };
  const fetcher = deps.fetcher || globalThis.fetch;
  if (typeof fetcher !== 'function') return { ok: false, error: 'FETCH_UNAVAILABLE', import_status: 'IMPORT_BLOCKED', variable_cost_eur: 0, paid_provider_calls: 0, production_deploy: false };

  const preflight = await preflightRobots(checked.url, fetcher);
  if (!preflight.ok) {
    return {
      ok: false,
      error: preflight.error,
      import_status: 'IMPORT_BLOCKED',
      robots_status: preflight.status || 'BLOCKED',
      pages_analyzed: 0,
      variable_cost_eur: 0,
      paid_provider_calls: 0,
      production_deploy: false
    };
  }

  const result = await quickImportProjectWebsite(input, {
    ...deps,
    fetcher: guardedFetcher(checked.url.origin, fetcher)
  });
  return {
    ...result,
    preflight_robots_status: preflight.status,
    source_origin_locked: checked.url.origin,
    cross_origin_fetch_allowed: false,
    variable_cost_eur: 0,
    paid_provider_calls: 0,
    production_deploy: false
  };
}

export function projectSourceWebsiteImportManifest() {
  return {
    schema: 'aurentara.project-source-website-import.v1',
    robots_checked_before_root_fetch: true,
    cross_origin_redirect_fetch_blocked: true,
    dns_private_target_blocked_by_scraper: true,
    bounded: true,
    paid_provider_calls: 0,
    variable_cost_eur: 0,
    production_deploy: false
  };
}
