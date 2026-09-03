import { createProjectSourceWorkerResolver } from '../../src/project-source-worker-dns-resolver-v1.js';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const hostname = url.searchParams.get('hostname') || 'example.com';
    const session = createProjectSourceWorkerResolver();
    try {
      const addresses = await session.resolveHostname(hostname);
      return Response.json({
        ok: true,
        hostname,
        addresses,
        runtime: 'workerd-node-dns',
        production_deploy: false,
        variable_cost_eur: 0
      });
    } catch (error) {
      return Response.json({
        ok: false,
        hostname,
        error: error?.code || 'DNS_RESOLVER_FAILURE',
        runtime: 'workerd-node-dns',
        production_deploy: false,
        variable_cost_eur: 0
      }, { status: 422 });
    }
  }
};
