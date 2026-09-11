const clean = (value, max = 240) => String(value ?? '').trim().slice(0, max);

export const JARVIS_INTEGRATION_EFFECT = Object.freeze({
  READ: 'READ',
  PREPARE: 'PREPARE',
  SAFE_INTERNAL_WRITE: 'SAFE_INTERNAL_WRITE',
  APPROVAL_REQUIRED: 'APPROVAL_REQUIRED',
  BLOCKED: 'BLOCKED'
});

export const JARVIS_INTEGRATION_PROVIDERS = Object.freeze([
  'GITHUB',
  'CLAUDE_CODE',
  'WEB',
  'CALENDAR',
  'TASKS',
  'REMINDERS',
  'CLOUDFLARE',
  'SUPABASE',
  'GMAIL'
]);

const DEFAULT_CAPABILITIES = Object.freeze([
  { id: 'github.remote_truth.read', provider: 'GITHUB', effect: 'READ', risk: 'LOW', scope: 'PROJECT_REMOTE_TRUTH' },
  { id: 'github.branch.prepare', provider: 'GITHUB', effect: 'PREPARE', risk: 'LOW', scope: 'PROJECT_CODE' },
  { id: 'github.remote_write', provider: 'GITHUB', effect: 'APPROVAL_REQUIRED', risk: 'HIGH', scope: 'PROJECT_REMOTE' },
  { id: 'github.merge', provider: 'GITHUB', effect: 'APPROVAL_REQUIRED', risk: 'HIGH', scope: 'CANONICAL' },

  { id: 'claude_code.analyze', provider: 'CLAUDE_CODE', effect: 'READ', risk: 'LOW', scope: 'BOUNDED_WORKSPACE' },
  { id: 'claude_code.prepare', provider: 'CLAUDE_CODE', effect: 'PREPARE', risk: 'LOW', scope: 'BOUNDED_WORKSPACE' },
  { id: 'claude_code.workspace_write', provider: 'CLAUDE_CODE', effect: 'SAFE_INTERNAL_WRITE', risk: 'MEDIUM', scope: 'BOUNDED_WORKSPACE' },

  { id: 'web.research', provider: 'WEB', effect: 'READ', risk: 'LOW', scope: 'PUBLIC_WEB' },

  { id: 'calendar.read', provider: 'CALENDAR', effect: 'READ', risk: 'LOW', scope: 'PERSONAL' },
  { id: 'calendar.write', provider: 'CALENDAR', effect: 'APPROVAL_REQUIRED', risk: 'MEDIUM', scope: 'PERSONAL_EXTERNAL' },
  { id: 'tasks.read', provider: 'TASKS', effect: 'READ', risk: 'LOW', scope: 'PERSONAL' },
  { id: 'tasks.write', provider: 'TASKS', effect: 'APPROVAL_REQUIRED', risk: 'MEDIUM', scope: 'PERSONAL_EXTERNAL' },
  { id: 'reminders.write', provider: 'REMINDERS', effect: 'APPROVAL_REQUIRED', risk: 'LOW', scope: 'PERSONAL_EXTERNAL' },

  { id: 'cloudflare.read', provider: 'CLOUDFLARE', effect: 'READ', risk: 'LOW', scope: 'PROJECT_INFRA' },
  { id: 'cloudflare.deploy', provider: 'CLOUDFLARE', effect: 'APPROVAL_REQUIRED', risk: 'HIGH', scope: 'DEPLOYMENT' },
  { id: 'cloudflare.dns.write', provider: 'CLOUDFLARE', effect: 'APPROVAL_REQUIRED', risk: 'CRITICAL', scope: 'DNS' },

  { id: 'supabase.read', provider: 'SUPABASE', effect: 'READ', risk: 'LOW', scope: 'PROJECT_DATA' },
  { id: 'supabase.bounded_write', provider: 'SUPABASE', effect: 'APPROVAL_REQUIRED', risk: 'HIGH', scope: 'PROJECT_DATA' },
  { id: 'supabase.destructive_write', provider: 'SUPABASE', effect: 'BLOCKED', risk: 'CRITICAL', scope: 'PROJECT_DATA' },

  { id: 'gmail.read', provider: 'GMAIL', effect: 'READ', risk: 'MEDIUM', scope: 'PERSONAL_EXTERNAL' },
  { id: 'gmail.draft', provider: 'GMAIL', effect: 'PREPARE', risk: 'LOW', scope: 'PERSONAL_EXTERNAL' },
  { id: 'gmail.send', provider: 'GMAIL', effect: 'APPROVAL_REQUIRED', risk: 'HIGH', scope: 'PERSONAL_EXTERNAL' },

  { id: 'billing.write', provider: 'CLOUDFLARE', effect: 'BLOCKED', risk: 'CRITICAL', scope: 'BILLING' },
  { id: 'secrets.write', provider: 'SUPABASE', effect: 'APPROVAL_REQUIRED', risk: 'CRITICAL', scope: 'CREDENTIALS' }
]);

const SECRET_KEY = /(password|passwd|api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|authorization|cookie|credential|secret)/i;
const SECRET_TEXT = /\b(Bearer\s+[A-Za-z0-9._~+/-]+=*|sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9]{12,})\b/i;

function containsSecret(value, key = '') {
  if (SECRET_KEY.test(key)) return value !== undefined && value !== null && clean(value, 200).length > 0;
  if (typeof value === 'string') return SECRET_TEXT.test(value);
  if (Array.isArray(value)) return value.some((item) => containsSecret(item));
  if (value && typeof value === 'object') return Object.entries(value).some(([k, v]) => containsSecret(v, k));
  return false;
}

export function createJarvisIntegrationRegistryV1(entries = DEFAULT_CAPABILITIES) {
  const capabilities = [];
  for (const raw of Array.isArray(entries) ? entries : []) {
    const id = clean(raw?.id, 180);
    const provider = clean(raw?.provider, 80).toUpperCase();
    const effect = clean(raw?.effect, 80).toUpperCase();
    if (!id || /^hamyren[.:/]/i.test(id)) continue;
    if (!JARVIS_INTEGRATION_PROVIDERS.includes(provider)) continue;
    if (!Object.values(JARVIS_INTEGRATION_EFFECT).includes(effect)) continue;
    if (containsSecret(raw)) continue;
    if (capabilities.some((item) => item.id === id)) continue;

    capabilities.push({
      id,
      provider,
      effect,
      risk: clean(raw?.risk, 40).toUpperCase() || 'LOW',
      scope: clean(raw?.scope, 120).toUpperCase() || 'UNSPECIFIED',
      live_binding: raw?.live_binding === true
    });
  }

  return {
    schema: 'aurentara.jarvis.integration-layer.v1',
    capabilities,
    providers: [...new Set(capabilities.map((item) => item.provider))],
    hamyren_private_data_flow: false,
    credentials_embedded: false,
    live_writes_enabled: capabilities.some((item) =>
      item.live_binding === true
      && ['SAFE_INTERNAL_WRITE', 'APPROVAL_REQUIRED'].includes(item.effect)
    )
  };
}

export function evaluateJarvisIntegrationActionV1(input = {}) {
  const registry = input.registry || createJarvisIntegrationRegistryV1();
  const capabilityId = clean(input.capability, 180);
  const capability = (registry.capabilities || []).find((item) => item.id === capabilityId) || null;

  if (!capability) {
    return { ok: false, status: 'BLOCKED', error: 'JARVIS_INTEGRATION_CAPABILITY_UNKNOWN', execution_authorized: false };
  }

  if (containsSecret(input.payload || {})) {
    return { ok: false, status: 'BLOCKED', error: 'JARVIS_INTEGRATION_SECRET_PAYLOAD_BLOCKED', execution_authorized: false };
  }

  if (clean(input?.source_system, 120).toLowerCase() === 'hamyren') {
    return { ok: false, status: 'BLOCKED', error: 'JARVIS_HAMYREN_PRIVATE_FLOW_BLOCKED', execution_authorized: false };
  }

  if (capability.effect === JARVIS_INTEGRATION_EFFECT.BLOCKED) {
    return { ok: false, status: 'BLOCKED', capability, execution_authorized: false, approval_required: true };
  }

  if (capability.effect === JARVIS_INTEGRATION_EFFECT.READ || capability.effect === JARVIS_INTEGRATION_EFFECT.PREPARE) {
    return { ok: true, status: 'ALLOWED', capability, execution_authorized: true, approval_required: false };
  }

  if (capability.effect === JARVIS_INTEGRATION_EFFECT.SAFE_INTERNAL_WRITE) {
    const bounded = input.bounded_workspace === true
      && clean(input.workspace, 400).startsWith('/workspace/projects/')
      && input.protected_branch !== true
      && input.production === false;

    return bounded
      ? { ok: true, status: 'AUTHORIZED', capability, execution_authorized: true, approval_required: false }
      : { ok: true, status: 'PREPARE_ONLY', capability, execution_authorized: false, approval_required: true };
  }

  if (capability.effect === JARVIS_INTEGRATION_EFFECT.APPROVAL_REQUIRED) {
    if (input.production === true || capability.scope === 'DNS' || capability.scope === 'BILLING' || capability.scope === 'CREDENTIALS') {
      return {
        ok: true,
        status: input.explicit_approval === true ? 'AUTHORIZED' : 'AWAITING_APPROVAL',
        capability,
        execution_authorized: input.explicit_approval === true,
        approval_required: true
      };
    }

    return {
      ok: true,
      status: input.explicit_approval === true ? 'AUTHORIZED' : 'AWAITING_APPROVAL',
      capability,
      execution_authorized: input.explicit_approval === true,
      approval_required: true
    };
  }

  return { ok: false, status: 'BLOCKED', error: 'JARVIS_INTEGRATION_POLICY_INVALID', execution_authorized: false };
}

export function jarvisIntegrationLivenessClaimV1(capabilityId = 'claude_code.analyze') {
  const registry = createJarvisIntegrationRegistryV1();
  const capability = (registry.capabilities || []).find((item) => item.id === clean(capabilityId, 180)) || null;
  return {
    schema: 'aurentara.jarvis.integration-layer.liveness-claim.v1',
    capability_id: capability?.id || null,
    provider: capability?.provider || null,
    registered: Boolean(capability),
    proves_runtime_liveness: false,
    proves_availability: false,
    proves_busy_state: false,
    note: 'The integration registry proves policy and routing only. Command Center system status must come from a genuine live probe.'
  };
}

export function jarvisIntegrationManifestV1() {
  const registry = createJarvisIntegrationRegistryV1();
  return {
    schema: registry.schema,
    provider_count: registry.providers.length,
    capability_count: registry.capabilities.length,
    providers: registry.providers,
    remote_truth_provider: 'GITHUB',
    coding_specialist: 'CLAUDE_CODE',
    default_remote_write: 'OFF',
    registry_proves_runtime_liveness: false,
    production_actions_enabled: false,
    billing_actions_enabled: false,
    hamyren_private_data_flow: false,
    credentials_embedded: false
  };
}
