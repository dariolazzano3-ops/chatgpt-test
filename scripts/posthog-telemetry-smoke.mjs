import assert from "node:assert/strict";
import {
  captureFactoryTelemetry,
  factoryTelemetryDescriptor,
  posthogTelemetryContract,
  telemetryConfiguration
} from "../src/posthog-telemetry.js";

const baseEnv = {
  POSTHOG_TELEMETRY_ENABLED: "true",
  POSTHOG_PROJECT_TOKEN: "phc_test_only",
  RIOSYSTEMS_ENV: "test"
};

assert.equal(telemetryConfiguration({}).enabled, false);
assert.equal(telemetryConfiguration({ POSTHOG_TELEMETRY_ENABLED: "true" }).enabled, false);
assert.equal(telemetryConfiguration(baseEnv).enabled, true);
assert.equal(posthogTelemetryContract.person_profiles_created, false);
assert.equal(posthogTelemetryContract.sensitive_fields_collected, false);

const ignored = factoryTelemetryDescriptor(
  new Request("https://factory.example/factory/diagnostics?secret=query", { method: "GET" }),
  new Response("ok", { status: 200 }),
  baseEnv
);
assert.equal(ignored, null);

const request = new Request("https://factory.example/factory/plan?customer=private", {
  method: "POST",
  headers: {
    authorization: "Bearer should-never-appear",
    "user-agent": "private-agent"
  },
  body: JSON.stringify({ prompt: "sensitive prompt", customer_id: "customer-123" })
});
const response = new Response(JSON.stringify({ status: "PLANNED" }), { status: 200 });
const descriptor = factoryTelemetryDescriptor(request, response, baseEnv);

assert.ok(descriptor);
assert.equal(descriptor.endpoint, "https://eu.i.posthog.com/i/v0/e/");
assert.equal(descriptor.payload.event, "riosystems_factory_operation");
assert.equal(descriptor.payload.distinct_id, "riosystems-control-plane");
assert.equal(descriptor.payload.properties.$process_person_profile, false);
assert.equal(descriptor.payload.properties.operation, "plan");
assert.equal(descriptor.payload.properties.route, "/factory/plan");
assert.equal(descriptor.payload.properties.status_code, 200);
assert.equal(descriptor.payload.properties.outcome, "success");

const serializedProperties = JSON.stringify(descriptor.payload.properties);
for (const forbidden of [
  "sensitive prompt",
  "customer-123",
  "private",
  "should-never-appear",
  "private-agent",
  "authorization",
  "user-agent",
  "customer_id"
]) {
  assert.equal(serializedProperties.includes(forbidden), false, `forbidden telemetry value leaked: ${forbidden}`);
}

let capturedRequest = null;
const fakeFetch = async (url, options) => {
  capturedRequest = { url, options };
  return new Response("ok", { status: 200 });
};
const captured = await captureFactoryTelemetry(request, response, baseEnv, fakeFetch);
assert.equal(captured.sent, true);
assert.equal(capturedRequest.url, "https://eu.i.posthog.com/i/v0/e/");
assert.equal(capturedRequest.options.method, "POST");

const sentPayload = JSON.parse(capturedRequest.options.body);
assert.equal(sentPayload.api_key, "phc_test_only");
assert.deepEqual(sentPayload.properties, descriptor.payload.properties);

const transportFailure = await captureFactoryTelemetry(
  request,
  response,
  baseEnv,
  async () => {
    throw new Error("simulated network failure");
  }
);
assert.deepEqual(transportFailure, { sent: false, reason: "transport_error" });

const failedResponseDescriptor = factoryTelemetryDescriptor(
  new Request("https://factory.example/factory/materialize", { method: "POST" }),
  new Response("failed", { status: 502 }),
  baseEnv
);
assert.equal(failedResponseDescriptor.payload.properties.outcome, "failure");
assert.equal(failedResponseDescriptor.payload.properties.status_code, 502);

console.log("PostHog core telemetry privacy smoke passed");
