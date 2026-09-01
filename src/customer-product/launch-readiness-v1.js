import { customerAiFoundationManifest } from '../customer-ai/contracts-v1.js';
import { customerChatRuntimeManifest } from '../customer-ai/chat-contracts-v1.js';
import { trustedResearchRuntimeManifest } from '../customer-ai/trusted-runtime-v1.js';
import { customerProductSurfaceManifest } from './surface-v1.js';
import { customerEconomicsManifest } from './economics-v1.js';
import { customerAbuseGuardManifest } from './abuse-guard-v1.js';
import { customerRedTeamManifest } from './red-team-v1.js';

export const CONTROLLED_LAUNCH_PROFILES_V1 = Object.freeze({
  FREE_CONTROLLED_PILOT: 'FREE_CONTROLLED_PILOT',
  PAID_FOUNDER_LAUNCH: 'PAID_FOUNDER_LAUNCH'
});

const PASS = 'PASS';
const OPERATOR_GATE = 'OPERATOR_GATE';
const PREPROD_REQUIRED = 'PREPROD_REQUIRED';

function bool(value) { return value === true; }
function gate(id, status, reason, action, evidence = null) {
  return { id, status, reason, operator_action_required: status === OPERATOR_GATE, exact_action: action || null, evidence };
}

export function controlledLaunchReadinessManifest() {
  return {
    version: 'aurentara.personal-business-ai.controlled-launch-readiness.v1',
    production_activation_performed: false,
    evaluates_profiles: Object.values(CONTROLLED_LAUNCH_PROFILES_V1),
    statuses: [PASS, PREPROD_REQUIRED, OPERATOR_GATE],
    pass_policy: 'NO_REQUIRED_GATE_MAY_BE_PREPROD_REQUIRED_OR_OPERATOR_GATE',
    operator_control_plane_shared: false,
    safety_over_launch_speed: true
  };
}

export function evaluateControlledLaunchReadiness(input = {}) {
  const profile = Object.values(CONTROLLED_LAUNCH_PROFILES_V1).includes(input.profile)
    ? input.profile : CONTROLLED_LAUNCH_PROFILES_V1.FREE_CONTROLLED_PILOT;
  const foundation = customerAiFoundationManifest();
  const chat = customerChatRuntimeManifest();
  const research = trustedResearchRuntimeManifest();
  const surface = customerProductSurfaceManifest();
  const economics = customerEconomicsManifest();
  const abuse = customerAbuseGuardManifest();
  const redTeam = customerRedTeamManifest();

  const gates = [
    gate('foundation_tenant_memory', foundation.customer_data_plane === 'separate_from_operator_control_plane' && foundation.privacy?.memory_correction ? PASS : PREPROD_REQUIRED,
      'Tenant/business memory foundation and privacy contracts must exist.', null, foundation.version),
    gate('customer_chat_context', chat.bounded_context && chat.customer_operator_plane_separation ? PASS : PREPROD_REQUIRED,
      'Customer conversation reasoning must use bounded tenant-safe context.', null, chat.version),
    gate('trusted_research_policy', research.current_and_high_stakes_fail_closed_without_evidence && research.citations_required_when_research_required ? PASS : PREPROD_REQUIRED,
      'Current/high-stakes claims must be evidence-gated.', null, research.version),
    gate('customer_operator_separation', surface.customer_operator_plane_separation && surface.operator_route_exposed === false ? PASS : PREPROD_REQUIRED,
      'Customer Product must never expose private Operator Control.', null, surface.version),
    gate('fair_use_economics', economics.unlimited_compute === false && economics.source_of_truth_cost_engine === 'riosystems.cost-ledger.v1' ? PASS : PREPROD_REQUIRED,
      'Customer compute must be bounded and reuse canonical cost control.', null, economics.version),
    gate('mandatory_red_team', bool(input.red_team_passed) && Number(input.red_team_passed_cases || 0) >= Number(redTeam.required_cases?.length || 0) ? PASS : PREPROD_REQUIRED,
      'All mandatory synthetic adversarial cases must pass on the launch candidate.', 'Run and pass the mandatory Customer Red Team gate.', `${input.red_team_passed_cases || 0}/${redTeam.required_cases.length}`),
    gate('local_abuse_guard', abuse.local_burst_guard_active ? PASS : PREPROD_REQUIRED,
      'A local pre-inference abuse guard must exist before launch configuration work.', null, abuse.version),

    gate('identity_adapter_contract', bool(input.identity_adapter_contract_ready) ? PASS : PREPROD_REQUIRED,
      'Production identity activation needs a provider-neutral principal/session/tenant contract before credentials are connected.', 'Build and test the Production identity adapter contract without activating a provider.', null),
    gate('durable_store_contract', bool(input.durable_store_contract_ready) ? PASS : PREPROD_REQUIRED,
      'Production persistence needs a verified Customer runtime-store adapter contract before migrations are applied.', 'Build and test the durable Customer data-store contract against synthetic storage.', null),
    gate('trusted_retrieval_adapter_contract', bool(input.trusted_retrieval_adapter_contract_ready) ? PASS : PREPROD_REQUIRED,
      'Live Trusted Research activation needs a retrieval-adapter contract that feeds Block 03 without bypassing source policy.', 'Build and test a provider-neutral trusted retrieval adapter contract with deterministic fixtures.', null),
    gate('distributed_rate_adapter_contract', bool(input.distributed_rate_adapter_contract_ready) ? PASS : PREPROD_REQUIRED,
      'The local abuse guard needs an external/distributed enforcement adapter boundary before Production configuration.', 'Build and test a distributed rate-limit adapter contract without activating an external service.', null),
    gate('deletion_executor_contract', bool(input.deletion_executor_contract_ready) ? PASS : PREPROD_REQUIRED,
      'Production hard deletion needs an auditable purge executor contract before it can touch durable customer data.', 'Build and test the purge executor contract on synthetic tenant/business data.', null),
    gate('observability_contract', bool(input.observability_contract_ready) ? PASS : PREPROD_REQUIRED,
      'Production monitoring needs a redacted event/metric contract before an external sink is connected.', 'Build and test redacted Customer observability events and alert-signal contracts.', null),

    gate('production_customer_identity', bool(input.production_customer_identity_active) ? PASS : OPERATOR_GATE,
      'Guest synthetic identity cannot protect real customer accounts.', 'Activate and verify the approved Production customer authentication/session system with tenant membership enforcement.', null),
    gate('durable_customer_data_plane', bool(input.durable_customer_data_plane_active) ? PASS : OPERATOR_GATE,
      'Current Customer runtime defaults are synthetic/in-memory and SQL contracts are not applied.', 'Apply the reviewed Production customer data-plane migrations/storage configuration and verify tenant-isolated persistence.', null),
    gate('real_customer_ai_processing', bool(input.real_customer_ai_processing_approved) ? PASS : OPERATOR_GATE,
      'Block 02 intentionally rejects customer/sensitive data before provider inference.', 'Approve the chosen existing AI provider configuration for real customer data, privacy terms and bounded Production cost policy.', null),
    gate('live_trusted_retrieval', bool(input.live_trusted_retrieval_active) ? PASS : OPERATOR_GATE,
      'Trusted Research policy exists but live retrieval is intentionally inactive.', 'Activate an approved trusted retrieval path/provider and verify freshness/source/citation behavior with Production privacy and cost controls.', null),
    gate('distributed_rate_limit', bool(input.distributed_rate_limit_active) ? PASS : OPERATOR_GATE,
      'The V1 abuse guard is isolate-local and cannot enforce a global public limit.', 'Enable and verify a distributed edge/runtime rate limit for Customer routes before public traffic.', null),
    gate('production_deletion_executor', bool(input.production_deletion_executor_active) ? PASS : OPERATOR_GATE,
      'Foundation has export/deletion planning, but no Production hard-delete executor.', 'Activate and verify audited Production deletion across customer records, conversation data, caches/vector scopes and storage.', null),
    gate('production_observability', bool(input.production_observability_active) ? PASS : OPERATOR_GATE,
      'Public operation requires durable error, abuse, cost and availability visibility.', 'Activate the approved Production observability/alert path with customer-data redaction and verify alerts.', null),
    gate('legal_privacy_review', bool(input.legal_privacy_review_complete) ? PASS : OPERATOR_GATE,
      'Public customer data processing requires reviewed privacy/terms/retention disclosures.', 'Complete the required legal/privacy review for the actual launch configuration and customer data flows.', null),
    gate('public_customer_surface', bool(input.public_customer_surface_active) ? PASS : OPERATOR_GATE,
      'The integrated Customer Surface is deliberately dormant by default.', 'Authorize and activate the Customer Surface in Production, including any required domain/DNS/access changes.', null)
  ];

  if (profile === CONTROLLED_LAUNCH_PROFILES_V1.PAID_FOUNDER_LAUNCH) {
    gates.push(gate('payment_adapter_contract', bool(input.payment_adapter_contract_ready) ? PASS : PREPROD_REQUIRED,
      'Paid launch needs a subscription-state adapter contract before Stripe/payment credentials are connected.', 'Build and test a provider-neutral payment lifecycle adapter contract using synthetic events.', null));
    gates.push(gate('payment_provider', bool(input.payment_provider_active) ? PASS : OPERATOR_GATE,
      'Paid Founder launch requires real subscription/payment lifecycle.', 'Approve and activate Stripe/payment provider, checkout/webhooks and billing lifecycle for the €19.90 Founder plan.', null));
  }

  const blockers = gates.filter((item) => item.status !== PASS);
  const operatorGates = blockers.filter((item) => item.status === OPERATOR_GATE);
  const preprod = blockers.filter((item) => item.status === PREPROD_REQUIRED);
  const passed = gates.filter((item) => item.status === PASS);
  const percent = Math.round((passed.length / gates.length) * 100);

  return {
    ok: blockers.length === 0,
    schema: 'aurentara.customer.controlled-launch-readiness-result.v1',
    profile,
    evaluated_at: new Date().toISOString(),
    readiness_percent: percent,
    passed_gates: passed.length,
    total_gates: gates.length,
    gates,
    blocker_ids: blockers.map((item) => item.id),
    preproduction_required_ids: preprod.map((item) => item.id),
    operator_gate_ids: operatorGates.map((item) => item.id),
    next_state: preprod.length ? 'CONTINUE_PREPRODUCTION_BUILD' : operatorGates.length ? 'OPERATOR_ACTIVATION_REQUIRED' : 'CONTROLLED_LAUNCH_READY',
    production_activation_performed: false,
    customer_operator_plane_separation_preserved: true
  };
}
