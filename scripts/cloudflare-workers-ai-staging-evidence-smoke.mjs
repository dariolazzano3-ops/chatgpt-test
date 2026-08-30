import assert from 'node:assert/strict';
import {
  cloudflareWorkersAiStagingEvidence,
  isCloudflareWorkersAiStagingVerified
} from '../src/cloudflare-workers-ai-staging-evidence.js';

const evidence = cloudflareWorkersAiStagingEvidence();
assert.equal(isCloudflareWorkersAiStagingVerified(), true);
assert.equal(evidence.provider_id, 'cloudflare-workers-ai-free');
assert.equal(evidence.environment, 'staging');
assert.equal(evidence.source.document, 'docs/AI_FACTORY_V1_CLOUDFLARE_EVIDENCE.md');
assert.equal(evidence.source.merge_pr, 242);
assert.equal(evidence.source.merge_commit, 'a0904d8bc337724086ef6aeeff1561a3c7fccb16');
assert.equal(evidence.inference.model, '@cf/zai-org/glm-4.7-flash');
assert.equal(evidence.inference.http_status, 200);
assert.equal(evidence.inference.api_success, true);
assert.equal(evidence.inference.prompt_tokens, 10);
assert.equal(evidence.inference.completion_tokens, 4);
assert.equal(evidence.inference.total_tokens, 14);
assert.equal(evidence.inference.neurons, 0.2006);
assert.equal(evidence.inference.errors_present, false);
assert.equal(evidence.cost_guard.workers_free_daily_neuron_allocation, 10000);
assert.equal(evidence.cost_guard.zero_cost_verified, true);
assert.equal(evidence.cost_guard.variable_cost_eur, 0);
assert.equal(evidence.cost_guard.automatic_paid_overflow, false);
assert.equal(evidence.cost_guard.openai_paid_fallback_used, false);
assert.equal(evidence.safety.synthetic_test_data_only, true);
assert.equal(evidence.safety.real_customer_data, false);
assert.equal(evidence.safety.customer_data_allowed, false);
assert.equal(evidence.safety.sensitive_data_allowed, false);
assert.equal(evidence.safety.secrets_embedded, false);
assert.equal(evidence.safety.production_deploy, false);
console.log('RIOSYSTEMS Cloudflare Workers AI staging evidence: OK');
