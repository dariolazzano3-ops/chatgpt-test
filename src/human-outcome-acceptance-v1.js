const clone = (value) => structuredClone(value ?? null);

const HUMAN_OUTCOME_CHECKS = Object.freeze([
  ['technical_implementation', 'TECHNICAL IMPLEMENTATION'],
  ['technical_integration', 'TECHNICAL INTEGRATION'],
  ['final_dom_presence', 'FINAL DOM PRESENCE'],
  ['human_visibility', 'HUMAN VISIBILITY'],
  ['human_reachability', 'HUMAN REACHABILITY'],
  ['primary_interaction', 'PRIMARY INTERACTION'],
  ['expected_result', 'EXPECTED RESULT'],
  ['desktop_acceptance', 'DESKTOP ACCEPTANCE'],
  ['composition_regression', 'COMPOSITION REGRESSION'],
  ['safety_regression', 'SAFETY REGRESSION']
]);

function state(value) {
  if (value === true) return 'PASS';
  if (value === false) return 'FAIL';
  return 'MISSING';
}

function normalizeEvidence(input = {}) {
  const evidence = {};
  for (const [id] of HUMAN_OUTCOME_CHECKS) evidence[id] = state(input[id]);
  evidence.mobile_acceptance = input.mobile_required === false ? 'NOT_APPLICABLE' : state(input.mobile_acceptance);
  return evidence;
}

function requiredIds(mobileRequired) {
  const ids = HUMAN_OUTCOME_CHECKS.map(([id]) => id);
  if (mobileRequired) ids.push('mobile_acceptance');
  return ids;
}

export function evaluateHumanOutcomeAcceptance(input = {}) {
  const mobileRequired = input.mobile_required !== false;
  const evidence = normalizeEvidence({ ...input, mobile_required: mobileRequired });
  const required = requiredIds(mobileRequired);
  const failed = required.filter((id) => evidence[id] === 'FAIL');
  const missing = required.filter((id) => evidence[id] === 'MISSING');
  const technicalPass = evidence.technical_implementation === 'PASS' && evidence.technical_integration === 'PASS';
  const safetyPass = evidence.safety_regression === 'PASS';

  let verdict = 'TECHNICAL_ACCEPTANCE_FAILED';
  if (technicalPass && failed.length === 0 && missing.length === 0 && safetyPass) verdict = 'ACCEPTED';
  else if (technicalPass && failed.length === 0 && missing.length > 0 && safetyPass) verdict = 'TECHNICALLY_ACCEPTED_HUMAN_ACCEPTANCE_PENDING';
  else if (technicalPass && !safetyPass) verdict = 'SAFETY_BLOCKED';
  else if (technicalPass && failed.length > 0) verdict = 'HUMAN_OUTCOME_FAILED';

  return {
    schema: 'aurentara.real-human-outcome-acceptance.v1',
    human_facing: input.human_facing !== false,
    verdict,
    human_outcome_accepted: verdict === 'ACCEPTED',
    mobile_required: mobileRequired,
    evidence,
    failed,
    missing,
    rules: {
      final_composed_browser_is_authoritative: true,
      self_reported_integration_is_supporting_evidence_only: true,
      full_acceptance_requires_human_outcome: true,
      full_acceptance_fail_closed: true,
      desktop_pass_cannot_override_mobile_fail: mobileRequired,
      production_deploy_required: false
    },
    production_deploy: false,
    external_writes: false
  };
}

export function sealHumanFacingAcceptance(input = {}) {
  if (input.human_facing === false) {
    return {
      ok: input.technical_accepted === true && input.safety_accepted !== false,
      verdict: input.technical_accepted === true ? 'TECHNICALLY_ACCEPTED_NON_HUMAN' : 'TECHNICAL_ACCEPTANCE_FAILED',
      human_outcome_required: false,
      human_outcome: null,
      production_deploy: false
    };
  }
  const humanOutcome = evaluateHumanOutcomeAcceptance({
    technical_implementation: input.technical_accepted === true,
    technical_integration: input.technical_accepted === true,
    safety_regression: input.safety_accepted !== false,
    ...(input.human_outcome || {})
  });
  return {
    ok: input.technical_accepted === true && input.safety_accepted !== false && humanOutcome.human_outcome_accepted === true,
    verdict: input.technical_accepted !== true
      ? 'TECHNICAL_ACCEPTANCE_FAILED'
      : input.safety_accepted === false
        ? 'SAFETY_BLOCKED'
        : humanOutcome.verdict,
    human_outcome_required: true,
    human_outcome: humanOutcome,
    production_deploy: false
  };
}

export function humanOutcomeAcceptanceManifest() {
  return {
    schema: 'aurentara.real-human-outcome-acceptance.v1',
    required_checks: HUMAN_OUTCOME_CHECKS.map(([id, label]) => ({ id, label })),
    mobile_check: 'mobile_acceptance',
    full_acceptance_fail_closed: true,
    final_composed_browser_is_authoritative: true,
    supports_human_facing: ['dashboard','operator','project_workspace','customer_product','hamyren','interactive_feature'],
    replaces_existing_test_platform: false,
    production_deploy: false
  };
}
