import { handleJarvisStandaloneWorkerV1 } from './standalone-worker-v1.js';

export async function handleJarvisPagesWorkerV1(request, env = {}, ctx = {}) {
  const response = await handleJarvisStandaloneWorkerV1(request, env, ctx);
  if (response) return response;
  return new Response(JSON.stringify({
    ok: false,
    error: 'JARVIS_PAGES_ROUTE_NOT_FOUND',
    public_access: false,
    production_deploy: false
  }), {
    status: 404,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex, nofollow'
    }
  });
}

export function jarvisPagesWorkerManifestV1() {
  return {
    schema: 'jarvis.pages-worker.v1',
    platform: 'cloudflare-pages-functions-advanced-mode',
    pages_dev_host: true,
    custom_domain_required: false,
    dedicated_pages_project_required: true,
    cloudflare_access_required: true,
    access_jwt_validation_required: true,
    supabase_data_plane_shared: false,
    workers_dev_used: false,
    production_deploy: false,
    public_access: false,
    external_writes: false
  };
}

export default {
  async fetch(request, env, ctx) {
    return handleJarvisPagesWorkerV1(request, env, ctx);
  }
};
