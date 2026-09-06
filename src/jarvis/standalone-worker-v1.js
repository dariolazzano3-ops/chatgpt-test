import { handleJarvisHttpV1 } from './http-v1.js';

const INTERNAL_BASE = '/jarvis';

function internalizeRequest(request) {
  const incoming = new URL(request.url);
  const internal = new URL(request.url);
  const suffix = incoming.pathname === '/' ? '' : incoming.pathname;
  internal.pathname = INTERNAL_BASE + suffix;
  return new Request(internal.toString(), request);
}

function externalizeLocation(location, requestUrl) {
  if (!location) return location;
  const origin = new URL(requestUrl).origin;
  if (location.startsWith(INTERNAL_BASE)) {
    const suffix = location.slice(INTERNAL_BASE.length) || '/';
    return suffix.startsWith('/') ? suffix : '/' + suffix;
  }
  if (location.startsWith(origin + INTERNAL_BASE)) {
    const suffix = location.slice((origin + INTERNAL_BASE).length) || '/';
    return origin + (suffix.startsWith('/') ? suffix : '/' + suffix);
  }
  return location;
}

function externalizeResponse(response, requestUrl) {
  if (!response) return response;
  const headers = new Headers(response.headers);
  const location = headers.get('location');
  if (location) headers.set('location', externalizeLocation(location, requestUrl));
  headers.set('x-jarvis-standalone-worker', 'v1');
  headers.set('x-jarvis-aurentara-runtime-shared', 'false');
  headers.set('x-jarvis-hamyren-data-flow', 'false');
  headers.delete('content-length');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export async function handleJarvisStandaloneWorkerV1(request, env = {}, ctx = {}, options = {}) {
  const url = new URL(request.url);
  if (url.pathname.startsWith('/jarvis')) {
    return new Response(JSON.stringify({
      ok: false,
      error: 'JARVIS_STANDALONE_LEGACY_PREFIX_REJECTED',
      standalone_host: true,
      production_deploy: false
    }), {
      status: 404,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
    });
  }

  const response = await handleJarvisHttpV1(
    internalizeRequest(request),
    env,
    ctx,
    { ...options, ui_base_path: '' }
  );

  return externalizeResponse(response, request.url);
}

export function jarvisStandaloneWorkerManifestV1() {
  return {
    schema: 'aurentara.jarvis.standalone-worker.v1',
    dedicated_worker: true,
    root_route: '/',
    legacy_aurentara_subpath: false,
    workers_dev_first: true,
    custom_domain_required: false,
    cloudflare_access_required: true,
    aurentara_runtime_shared: false,
    hamyren_runtime_shared: false,
    data_plane: 'EPHEMERAL_UNTIL_ISOLATED',
    production_deploy: false,
    public_access: false,
    external_writes: false
  };
}

export default {
  async fetch(request, env, ctx) {
    return handleJarvisStandaloneWorkerV1(request, env, ctx);
  }
};
