import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateBuildCreditsV1 } from '../src/customer-product/build-credit-entitlement-v1.js';

test('8 Credit modular estimate is review-required and AURENTARA-required', () => {
  const estimate = estimateBuildCreditsV1({
    activity: 'implementation',
    capability: 'web',
    complexity: 'low',
    module_credit_allocations: [3, 3, 2],
    modular: true,
    standardized_template_available: true
  });
  assert.equal(estimate.credit_estimate, 8);
  assert.equal(estimate.review_required, true);
  assert.equal(estimate.aurentara_required, true);
});
