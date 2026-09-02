import { buildHamyrenCustomerJourneyV1 } from './customer-journey-commercial-routing-v1.js';
import { estimateBuildCreditsV1, customerSafeBuildCreditPresentationV1 } from '../customer-product/build-credit-entitlement-v1.js';

const clone = (value) => structuredClone(value ?? null);

export function prepareHamyrenBuildCreditJourneyV1(input = {}) {
  const journey = input.journey || buildHamyrenCustomerJourneyV1(input);
  const policyDecision = journey?.capability_path?.decision || input.policy_decision || null;
  const estimate = estimateBuildCreditsV1({ ...input, policy_decision: policyDecision });
  let customer = customerSafeBuildCreditPresentationV1(estimate);

  if (journey.outcome === 'AURENTARA_PROFESSIONAL' || estimate.aurentara_required) {
    customer = {
      route: 'AURENTARA_PROFESSIONAL',
      message: 'This project needs AURENTARA professional implementation.',
      build_credits_required: null,
      review_required: true
    };
  } else if (journey.outcome === 'SELF_SERVICE_NOT_AVAILABLE') {
    customer = {
      ...customer,
      route: 'SELF_SERVICE_NOT_AVAILABLE',
      message: `${customer.message} Customer Self-Service execution is not currently enabled.`
    };
  }

  return {
    schema_version: 'hamyren-aurentara.build-credit-journey-adapter.v1',
    journey: clone(journey),
    economic_preflight: estimate,
    customer_build_credit: customer,
    canonical_capability_policy_reused: true,
    canonical_customer_journey_reused: true,
    second_journey_created: false,
    execution_authorized: false,
    production_deploy: false
  };
}

export function customerSafeHamyrenBuildCreditJourneyV1(result = {}) {
  const journey = result.journey || {};
  return {
    schema_version: 'hamyren-aurentara.customer-build-credit-view.v1',
    outcome: journey.outcome || null,
    current_state: journey.current_state || null,
    customer_review: clone(journey.customer_review || null),
    build_credit: clone(result.customer_build_credit || null),
    billing_enabled: false,
    checkout_enabled: false,
    production_deploy: false
  };
}

export function buildCreditJourneyIntegrationManifestV1() {
  return {
    version: 'hamyren-aurentara.build-credit-journey-integration.v1',
    canonical_journey: 'hamyren-aurentara.customer-journey.v1',
    canonical_capability_policy: 'hamyren-aurentara-capability-policy.v1',
    raw_costs_customer_visible: false,
    internal_risk_scores_customer_visible: false,
    provider_logs_customer_visible: false,
    public_pack_prices: false,
    execution_authorized: false,
    production_deploy: false
  };
}
