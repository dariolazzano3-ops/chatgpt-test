const SCOPE = 'bakery-muller:digital-system-v1';
const DISTINCT_ID = 'riosystems-staging:bakery-muller:digital-system-v1:block4-analytics-001';
const FLOW_ID = 'block4-posthog-staging-001';
const MAKE_EXECUTION_ID = 'e3198aaaeed64e7b8380c6e067439ecf';
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
      flow_id: FLOW_ID,
      step_index: index + 1,
      source: event === 'automation_started' || event === 'lead_persisted' ? 'make-supabase-bridge' : 'riosystems-staging'
    };
    if (event === 'automation_started' || event === 'lead_persisted') properties.make_execution_id = MAKE_EXECUTION_ID;
    if (event === 'lead_persisted') properties.outcome = 'success';
    return { event, properties };
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/__riosystems/block4-posthog-once') return new Response('Not found', { status: 404 });
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    if (!env.BLOCK4_RUN_NONCE || request.headers.get('authorization') !== `Bearer ${env.BLOCK4_RUN_NONCE}`) {
      return new Response('Forbidden', { status: 403 });
    }
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
      secrets_returned: false,
      production_deploy: false
    }, { status: response.ok ? 200 : 502 });
  }
};
