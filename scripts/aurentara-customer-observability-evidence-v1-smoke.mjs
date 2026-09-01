import assert from 'node:assert/strict';
import {
  evaluateLaunchGateEvidence,
  verifyAlertSignalPathEvidence,
  verifyObservabilityNotificationEvidence
} from '../src/customer-product/launch-gate-audit-v1.js';

const nowMs = Date.parse('2026-09-01T12:00:00.000Z');
const signal = {
  schema: 'aurentara.customer.cloudflare-signal-sink-e2e.v1',
  observed_at: '2026-09-01T11:59:00.000Z',
  status: 'PASS',
  verified_route_from_deployment_truth: true,
  worker_tail_connected: true,
  probe_request_count: 1000,
  exact_closed_worker_response_count: 1000,
  customer_surface_remained_off: true,
  observability_channel_seen: true,
  customer_request_event_seen: true,
  raw_tail_returned: false,
  request_headers_returned: false,
  account_id_returned: false,
  token_returned: false,
  real_customer_data: false,
  customer_content_transmitted: false,
  paid_provider_calls: false,
  production_deploy: false,
  variable_cost_eur: 0
};
const notification = {
  schema: 'aurentara.customer.cloudflare-observability-notification-policy.v1',
  observed_at: '2026-09-01T11:59:05.000Z',
  status: 'PASS',
  alert_type: 'workers_observability_alert',
  enabled: true,
  firing_failed_filter: true,
  email_mechanism_ready: true,
  email_address_returned: false,
  webhook_url_returned: false,
  account_id_returned: false,
  token_returned: false,
  customer_surface_activated: false,
  real_customer_data: false,
  paid_provider_calls: false,
  variable_cost_eur: 0
};

const verifySignal = (value) => verifyAlertSignalPathEvidence(value, { now_ms: nowMs });
const verifyNotification = (value) => verifyObservabilityNotificationEvidence(value, { now_ms: nowMs });

assert.equal(verifySignal(signal).ok, true);
assert.equal(verifyNotification(notification).ok, true);
assert.equal(verifySignal({}).ok, false);
assert.equal(verifyNotification({}).ok, false);
assert.equal(verifySignal({ ...signal, observed_at: '2026-09-01T11:30:00.000Z' }).ok, false);
assert.equal(verifyNotification({ ...notification, observed_at: '2026-09-01T11:30:00.000Z' }).ok, false);
assert.equal(verifySignal({ ...signal, verified_route_from_deployment_truth: false }).ok, false);
assert.equal(verifySignal({ ...signal, exact_closed_worker_response_count: 0 }).ok, false);
assert.equal(verifySignal({ ...signal, observability_channel_seen: false }).ok, false);
assert.equal(verifySignal({ ...signal, customer_request_event_seen: false }).ok, false);
assert.equal(verifySignal({ ...signal, real_customer_data: true }).ok, false);
assert.equal(verifySignal({ ...signal, paid_provider_calls: true }).ok, false);
assert.equal(verifySignal({ ...signal, production_deploy: true }).ok, false);
assert.equal(verifySignal({ ...signal, variable_cost_eur: 0.01 }).ok, false);
assert.equal(verifyNotification({ ...notification, enabled: false }).ok, false);
assert.equal(verifyNotification({ ...notification, firing_failed_filter: false }).ok, false);
assert.equal(verifyNotification({ ...notification, email_mechanism_ready: false }).ok, false);
assert.equal(verifyNotification({ ...notification, real_customer_data: true }).ok, false);
assert.equal(verifyNotification({ ...notification, paid_provider_calls: true }).ok, false);

const cloudflareBase = {
  worker_settings_verified: true,
  official_retrieval_binding_live: true,
  official_source_fetch_verified: true,
  distributed_rate_binding_live: true,
  observability_binding_live: true,
  alert_signal_path_verified: true,
  notification_policy_verified: true
};

const withAllObservability = evaluateLaunchGateEvidence({ cloudflare: cloudflareBase });
assert.equal(withAllObservability.technical.production_observability_active, true);

const withoutSignal = evaluateLaunchGateEvidence({
  cloudflare: { ...cloudflareBase, alert_signal_path_verified: false }
});
assert.equal(withoutSignal.technical.production_observability_active, false);

const withoutNotification = evaluateLaunchGateEvidence({
  cloudflare: { ...cloudflareBase, notification_policy_verified: false }
});
assert.equal(withoutNotification.technical.production_observability_active, false);

console.log(JSON.stringify({
  suite: 'AURENTARA CUSTOMER OBSERVABILITY EVIDENCE V1',
  status: 'PASS',
  valid_signal_evidence_accepted: true,
  valid_notification_evidence_accepted: true,
  incomplete_evidence_rejected: true,
  stale_evidence_rejected: true,
  route_truth_required: true,
  closed_surface_required: true,
  live_signal_required: true,
  notification_policy_required: true,
  paid_calls_forbidden: true,
  real_customer_data_forbidden: true,
  variable_cost_eur: 0
}, null, 2));
