const clean = (value, max = 240) => String(value || '').trim().slice(0, max);

export function defineRealProviderCandidate(input = {}) {
  const id = clean(input.id);
  const capability = clean(input.capability);
  if (!id || !capability) return { ok: false, error: 'PROVIDER_ID_AND_CAPABILITY_REQUIRED' };
  return {
    ok: true,
    provider: {
      schema: 'riosystems.real-provider-candidate.v1',
      id,
      capability,
      kind: clean(input.kind || 'generic_api'),
      credential_ref: clean(input.credential_ref),
      endpoint: clean(input.endpoint, 500),
      paid: input.paid === true,
      estimated_monthly_cost_eur: Number(input.estimated_monthly_cost_eur || 0),
      free_tier_confirmed: input.free_tier_confirmed === true,
      external: true,
      external_write: input.external_write === true,
      production: false
    }
  };
}

export function evaluateRealProviderBridge(provider = {}, context = {}) {
  const blockers = [];
  if (!provider.id || !provider.capability) blockers.push({ code: 'PROVIDER_INVALID' });
  if (!provider.credential_ref) blockers.push({ code: 'CREDENTIAL_REFERENCE_REQUIRED' });
  if (provider.paid === true && context.cost_approved !== true) blockers.push({ code: 'PAID_PROVIDER_REQUIRES_USER_APPROVAL' });
  if (provider.external_write === true && context.external_write_approved !== true) blockers.push({ code: 'EXTERNAL_WRITE_REQUIRES_USER_APPROVAL' });
  if (context.production === true) blockers.push({ code: 'PRODUCTION_NOT_AUTHORIZED' });
  if (context.execute === true && context.supervised_execution_approved !== true) blockers.push({ code: 'SUPERVISED_EXECUTION_APPROVAL_REQUIRED' });
  return {
    ok: blockers.length === 0,
    stage: blockers.length ? 'WAITING_FOR_PROVIDER_ACTIVATION' : 'REAL_PROVIDER_STAGING_READY',
    blockers,
    user_action_required: blockers.some((item) => item.code.includes('USER_APPROVAL') || item.code === 'CREDENTIAL_REFERENCE_REQUIRED'),
    execution_mode: context.execute === true ? 'supervised' : 'dry_run',
    external_side_effects_allowed: context.execute === true && context.supervised_execution_approved === true && (provider.external_write !== true || context.external_write_approved === true),
    production_deploy: false
  };
}

export function buildMockToRealTransition(mockProvider = {}, realProvider = {}, context = {}) {
  const gate = evaluateRealProviderBridge(realProvider, context);
  return {
    ok: gate.ok,
    schema: 'riosystems.mock-to-real-transition.v1',
    capability: realProvider.capability || mockProvider.capability || null,
    from_provider: mockProvider.id || null,
    to_provider: realProvider.id || null,
    gate,
    fallback_to_mock: true,
    automatic_cutover: false,
    production_deploy: false
  };
}

export function realProviderBridgeManifest() {
  return {
    version: 'riosystems.real-provider-bridge.v1',
    credential_reference_only: true,
    paid_provider_user_approval_required: true,
    external_write_user_approval_required: true,
    dry_run_default: true,
    automatic_cutover: false,
    mock_fallback: true,
    production_deploy: false
  };
}
