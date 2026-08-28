const clone = (value) => structuredClone(value ?? null);
const clean = (value, max = 160) => String(value || '').trim().slice(0, max);

function healthy(provider = {}, health = {}) {
  const state = health[provider.id];
  if (!state) return true;
  if (state.enabled === false) return false;
  if (state.status && ['down', 'blocked', 'disabled'].includes(String(state.status).toLowerCase())) return false;
  return true;
}

export function buildProviderAttemptPlan(route = {}, health = {}) {
  if (!route.ok || !route.provider) return { ok: false, error: 'PROVIDER_ROUTE_REQUIRED' };
  const chain = [route.provider, ...(route.fallbacks || [])];
  const attempts = chain.filter((provider) => healthy(provider, health)).map((provider, index) => ({
    index,
    provider_id: provider.id,
    external: provider.external !== false,
    paid: provider.paid === true,
    estimated_cost_units: Number(provider.estimated_cost_units || 0),
    production_deploy: false
  }));
  if (!attempts.length) return { ok: false, error: 'NO_HEALTHY_PROVIDER_AVAILABLE', attempted_provider_ids: chain.map((provider) => provider.id) };
  return { ok: true, attempts, primary_provider_id: attempts[0].provider_id, production_deploy: false };
}

export async function executeProviderPlan(plan = {}, runners = {}, authorizeAttempt = async () => ({ ok: true, authorized: false })) {
  if (!plan.ok || !Array.isArray(plan.attempts)) return { ok: false, error: 'PROVIDER_ATTEMPT_PLAN_REQUIRED', production_deploy: false };
  const failures = [];
  for (const attempt of plan.attempts) {
    const authorization = await authorizeAttempt(clone(attempt));
    if (!authorization?.ok || authorization.authorized !== true) {
      failures.push({ provider_id: attempt.provider_id, code: authorization?.code || authorization?.error || 'PROVIDER_ATTEMPT_NOT_AUTHORIZED' });
      continue;
    }
    const runner = runners[attempt.provider_id];
    if (typeof runner !== 'function') {
      failures.push({ provider_id: attempt.provider_id, code: 'PROVIDER_RUNNER_NOT_CONFIGURED' });
      continue;
    }
    try {
      const result = await runner(clone(attempt));
      if (result?.ok === false) {
        failures.push({ provider_id: attempt.provider_id, code: clean(result.error || result.code, 160) || 'PROVIDER_EXECUTION_FAILED' });
        continue;
      }
      return { ok: true, provider_id: attempt.provider_id, result: clone(result), failures, production_deploy: false };
    } catch (error) {
      failures.push({ provider_id: attempt.provider_id, code: 'PROVIDER_EXECUTION_EXCEPTION', message: clean(error?.message, 240) });
    }
  }
  return { ok: false, error: 'ALL_PROVIDER_ATTEMPTS_FAILED', failures, production_deploy: false };
}

export function providerRuntimeManifest() {
  return { version: 'riosystems.provider-runtime.v1', health_aware_fallback: true, per_attempt_authorization: true, implicit_external_execution: false, production_deploy: false };
}
