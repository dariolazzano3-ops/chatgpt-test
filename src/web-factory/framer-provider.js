const STATES = new Set(['not_configured', 'free_ready', 'connected', 'design_verified', 'paid_required']);

export function deriveFramerProviderStatus(input = {}) {
  let status = 'not_configured';
  if (input.paid_required === true) status = 'paid_required';
  else if (input.design_verified === true) status = 'design_verified';
  else if (input.connection_verified === true) status = 'connected';
  else if (input.free_plan_ready === true) status = 'free_ready';

  return {
    schema: 'riosystems.web-provider-status.v1',
    provider_id: 'framer',
    role: 'visual_specialist',
    status,
    credentials_in_repo: false,
    paid_activation_authorized: false,
    production_hosting_default: false,
    variable_cost_ceiling_eur: 0
  };
}

export function assertFramerProviderStatus(status) {
  if (!STATES.has(status)) throw new Error(`INVALID_FRAMER_PROVIDER_STATUS:${status}`);
  return true;
}

export function framerFreeActivationChecklist(statusInput = {}) {
  const provider = deriveFramerProviderStatus(statusInput);
  return {
    schema: 'riosystems.framer-activation-checklist.v1',
    provider,
    target_plan: 'free',
    steps: [
      { id: 'account', requirement: 'Operator-controlled Framer account exists', satisfied: provider.status !== 'not_configured' },
      { id: 'connection', requirement: 'Provider connection or operator-mediated design handoff is verified', satisfied: ['connected', 'design_verified'].includes(provider.status) },
      { id: 'design-contract', requirement: 'Design output is transformed into the provider-neutral RIOSYSTEMS design contract', satisfied: provider.status === 'design_verified' },
      { id: 'rights', requirement: 'All assets/fonts/images used for reconstruction pass rights validation', satisfied: false },
      { id: 'cost', requirement: 'No paid activation is required for the selected design-stage operation', satisfied: provider.status !== 'paid_required' }
    ],
    secrets_storage: 'external_provider_connection_only',
    repository_credentials_allowed: false,
    paid_activation_allowed: false,
    production_hosting_default: false
  };
}
