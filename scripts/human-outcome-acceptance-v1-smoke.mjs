import assert from 'node:assert/strict';
import { evaluateHumanOutcomeAcceptance, sealHumanFacingAcceptance, humanOutcomeAcceptanceManifest } from '../src/human-outcome-acceptance-v1.js';

const pass = {
  human_facing: true,
  technical_implementation: true,
  technical_integration: true,
  final_dom_presence: true,
  human_visibility: true,
  human_reachability: true,
  primary_interaction: true,
  expected_result: true,
  desktop_acceptance: true,
  mobile_acceptance: true,
  mobile_required: true,
  composition_regression: true,
  safety_regression: true
};

const accepted = evaluateHumanOutcomeAcceptance(pass);
assert.equal(accepted.verdict, 'ACCEPTED');
assert.equal(accepted.human_outcome_accepted, true);

const selfReportedOnly = evaluateHumanOutcomeAcceptance({
  technical_implementation: true,
  technical_integration: true,
  safety_regression: true,
  mobile_required: true
});
assert.equal(selfReportedOnly.verdict, 'TECHNICALLY_ACCEPTED_HUMAN_ACCEPTANCE_PENDING');
assert.equal(selfReportedOnly.human_outcome_accepted, false);
assert.ok(selfReportedOnly.missing.includes('final_dom_presence'));
assert.ok(selfReportedOnly.missing.includes('mobile_acceptance'));

const hidden = evaluateHumanOutcomeAcceptance({ ...pass, human_visibility: false });
assert.equal(hidden.verdict, 'HUMAN_OUTCOME_FAILED');
assert.ok(hidden.failed.includes('human_visibility'));

const overlayBlocked = evaluateHumanOutcomeAcceptance({ ...pass, human_reachability: false });
assert.equal(overlayBlocked.verdict, 'HUMAN_OUTCOME_FAILED');
assert.ok(overlayBlocked.failed.includes('human_reachability'));

const rerenderLostHandler = evaluateHumanOutcomeAcceptance({ ...pass, primary_interaction: false });
assert.equal(rerenderLostHandler.verdict, 'HUMAN_OUTCOME_FAILED');
assert.ok(rerenderLostHandler.failed.includes('primary_interaction'));

const mobileFail = evaluateHumanOutcomeAcceptance({ ...pass, mobile_acceptance: false });
assert.equal(mobileFail.verdict, 'HUMAN_OUTCOME_FAILED');
assert.equal(mobileFail.human_outcome_accepted, false);

const safetyFail = evaluateHumanOutcomeAcceptance({ ...pass, safety_regression: false });
assert.equal(safetyFail.verdict, 'SAFETY_BLOCKED');
assert.equal(safetyFail.human_outcome_accepted, false);

const sealedMissingHuman = sealHumanFacingAcceptance({
  human_facing: true,
  technical_accepted: true,
  safety_accepted: true,
  human_outcome: {
    technical_implementation: true,
    technical_integration: true,
    safety_regression: true,
    mobile_required: true
  }
});
assert.equal(sealedMissingHuman.ok, false);
assert.equal(sealedMissingHuman.verdict, 'TECHNICALLY_ACCEPTED_HUMAN_ACCEPTANCE_PENDING');

const nonHuman = sealHumanFacingAcceptance({
  human_facing: false,
  technical_accepted: true,
  safety_accepted: true
});
assert.equal(nonHuman.ok, true);
assert.equal(nonHuman.human_outcome_required, false);

const manifest = humanOutcomeAcceptanceManifest();
assert.equal(manifest.full_acceptance_fail_closed, true);
assert.equal(manifest.final_composed_browser_is_authoritative, true);
assert.equal(manifest.replaces_existing_test_platform, false);

console.log(JSON.stringify({
  ok: true,
  suite: 'real-human-outcome-acceptance-v1',
  accepted: accepted.verdict,
  supporting_evidence_only: selfReportedOnly.verdict,
  hidden_element: hidden.verdict,
  overlay_blocked: overlayBlocked.verdict,
  rerender_handler_lost: rerenderLostHandler.verdict,
  mobile_failure: mobileFail.verdict,
  safety_failure: safetyFail.verdict,
  fail_closed_seal: sealedMissingHuman.verdict,
  production_deploy: false,
  external_writes: false,
  paid_provider_calls: 0
}, null, 2));
