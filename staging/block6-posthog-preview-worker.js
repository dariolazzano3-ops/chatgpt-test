const SCOPE = 'bakery-muller:digital-system-v1';
const TRACE_ID = 'block6-e2e-staging-001';
const FLOW_ID = 'block6-e2e-staging-001';
const DISTINCT_ID = 'riosystems-staging:bakery-muller:digital-system-v1:block6-e2e-001';
const MAKE_EXECUTION_ID = '889cbc5111364a89b17faa0eba9c4165';
const POSTHOG_BATCH_URL = 'https://eu.i.posthog.com/batch/';

function events() {
  return ['page_view','cta_clicked','lead_submitted','automation_started','lead_persisted'].map((event, index) => {
    const properties = {
      distinct_id: DISTINCT_ID,
      '$process_person_profile': false,
      '$geoip_disable': true,
      environment: 'staging',
      project_scope: SCOPE,
      synthetic: true,
      trace_id: TRACE_ID,
      flow_id: FLOW_ID,
      step_index: index + 1,
      source: event === 'automation_started' || event === 'lead_persisted' ? 'block6-make-supabase' : 'block6-web-staging'
    };
    if (event === 'automation_started' || event === 'lead_persisted') properties.make_execution_id = MAKE_EXECUTION_ID;
    if (event === 'lead_persisted') properties.outcome = 'success';
    return { event, properties };
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/__riosystems/block6-posthog-once') return new Response('Not found', { status: 404 });
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    if (!env.BLOCK6_RUN_NONCE || request.headers.get('authorization') !== `Bearer ${env.BLOCK6_RUN_NONCE}`) return new Response('Forbidden', { status: 403 });
    if (!env.POSTHOG_PROJECT_TOKEN) return Response.json({ ok: false, error: 'POSTHOG_PROJECT_TOKEN_MISSING' }, { status: 500 });

    const batch = events();
    const response = await fetch(POSTHOG_BATCH_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ api_key: env.POSTHOG_PROJECT_TOKEN, historical_migration: false, batch })
    });
    return Response.json({
      ok: response.ok,
      posthog_status: response.status,
      event_count: batch.length,
      flow_id: FLOW_ID,
      trace_id: TRACE_ID,
      make_execution_id: MAKE_EXECUTION_ID,
      secrets_returned: false,
      retries_performed: 0,
      production_deploy: false
    }, { status: response.ok ? 200 : 502 });
  }
};
