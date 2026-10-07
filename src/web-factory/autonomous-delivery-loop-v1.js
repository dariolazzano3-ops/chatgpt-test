export const AUTONOMOUS_DELIVERY_LOOP_SCHEMA = 'riosystems.autonomous-delivery-loop.v1';
export const AUTONOMOUS_DELIVERY_LOOP_MAX_CYCLES = 4;

export const AUTONOMOUS_DELIVERY_LOOP_PHASES = Object.freeze([
  'BUILD',
  'TECHNICAL_QA',
  'VISUAL_CLOSURE',
  'BROWSER_ACCEPTANCE',
  'PRIVATE_PREVIEW',
  'OWNER_REVIEW'
]);

const FORBIDDEN_BRANCHES = new Set(['main', 'master', 'factory-control']);
const isForbiddenBranch = (value) => FORBIDDEN_BRANCHES.has(clean(value, 240).toLowerCase().replace(/^refs\/heads\//, ''));
const REQUIRED_ADAPTERS = Object.freeze([
  'build',
  'technical_qa',
  'visual_closure',
  'browser_acceptance',
  'repair',
  'private_preview'
]);
const FORBIDDEN_POLICY_FLAGS = Object.freeze([
  'production_deploy',
  'public_launch',
  'dns_change',
  'billing_activation',
  'automatic_merge',
  'automatic_paid_activation',
  'external_customer_writes'
]);

const clean = (value, max = 1000) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const arr = (value) => Array.isArray(value) ? value : [];
const clone = (value) => value == null ? value : structuredClone(value);
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function normalizedPolicy(input = {}) {
  return {
    production_deploy: input.production_deploy === true,
    public_launch: input.public_launch === true,
    dns_change: input.dns_change === true,
    billing_activation: input.billing_activation === true,
    automatic_merge: input.automatic_merge === true,
    automatic_paid_activation: input.automatic_paid_activation === true,
    external_customer_writes: input.external_customer_writes === true,
    private_preview_deploy: input.private_preview_deploy !== false,
    max_variable_cost_eur: Math.max(0, finite(input.max_variable_cost_eur, 0))
  };
}

function resultCost(result = {}) {
  return Math.max(0, finite(result.variable_cost_eur ?? result.actual_cost_eur, 0));
}

function passStatus(result = {}) {
  return ['PASS', 'COMPLETED', 'READY', 'VERIFIED', 'ACCEPTED'].includes(clean(result.status, 80).toUpperCase());
}

function validateChangedFiles(result = {}, projectPath = '') {
  const changed = arr(result.changed_files).map((item) => clean(item, 800)).filter(Boolean);
  const outside = changed.filter((item) => item !== projectPath && !item.startsWith(projectPath + '/'));
  return { changed_files: changed, outside_project_files: outside, ok: outside.length === 0 };
}

function summarizeGate(result = {}) {
  return {
    schema: result.schema || null,
    status: result.status || null,
    evidence_ref: result.evidence_ref || result.acceptance_ref || result.artifact_ref || null,
    blocking_issues: clone(result.blocking_issues || result.issues || []),
    variable_cost_eur: resultCost(result)
  };
}

function stopResult(base, status, reason, extra = {}) {
  return {
    schema: AUTONOMOUS_DELIVERY_LOOP_SCHEMA,
    ok: false,
    status,
    reason,
    project_scope: base.project_scope,
    mission_id: base.mission_id,
    target_branch: base.target_branch,
    project_path: base.project_path,
    current_commit_sha: base.current_commit_sha || null,
    cycles_completed: base.cycles_completed || 0,
    total_variable_cost_eur: base.total_variable_cost_eur || 0,
    history: clone(base.history || []),
    human_decision_required: status === 'HUMAN_DECISION_REQUIRED',
    next_action: status === 'HUMAN_DECISION_REQUIRED' ? {
      code: 'OWNER_DECISION_REQUIRED',
      label: 'Owner decision required'
    } : null,
    production_deploy: false,
    public_launch: false,
    dns_change: false,
    billing_activation: false,
    automatic_merge: false,
    external_customer_writes: false,
    ...extra
  };
}

export function autonomousDeliveryLoopManifest() {
  return {
    schema: 'riosystems.autonomous-delivery-loop-manifest.v1',
    name: 'RIOSYSTEMS Web Factory Autonomous Delivery Loop',
    phases: [...AUTONOMOUS_DELIVERY_LOOP_PHASES],
    pipeline: [
      'MISSION',
      'BUILD',
      'TECHNICAL_QA',
      'J7_VISUAL_CLOSURE',
      'J9_BROWSER_ACCEPTANCE',
      'BOUNDED_REPAIR',
      'PRIVATE_PREVIEW',
      'OWNER_REVIEW'
    ],
    required_adapters: [...REQUIRED_ADAPTERS],
    max_cycles: AUTONOMOUS_DELIVERY_LOOP_MAX_CYCLES,
    visual_engine: 'riosystems.j7-visual-closure-result.v1',
    browser_acceptance_engine: 'riosystems.j9-browser-accessibility-performance-acceptance.v2',
    repair_actor: 'CLAUDE_CODE_OR_EQUIVALENT_BOUND_EXECUTOR',
    source_of_truth: 'GIT_COMMIT',
    private_preview_before_owner_review: true,
    owner_review_required_before_delivery: true,
    automatic_merge: false,
    production_deploy: false,
    public_launch: false,
    dns_change: false,
    billing_activation: false,
    automatic_paid_activation: false,
    external_customer_writes: false
  };
}

export function validateAutonomousDeliveryLoopRequest(input = {}, adapters = {}) {
  const projectScope = clean(input.project_scope, 320);
  const missionId = clean(input.mission_id, 180);
  const projectPath = clean(input.project_path, 500);
  const targetBranch = clean(input.target_branch, 240);
  const policy = normalizedPolicy(input.policy || {});
  const issues = [];

  if (!projectScope) issues.push('PROJECT_SCOPE_REQUIRED');
  if (!missionId) issues.push('MISSION_ID_REQUIRED');
  if (!projectPath.startsWith('projects/')) issues.push('PROJECT_PATH_REQUIRED');
  if (!targetBranch) issues.push('TARGET_BRANCH_REQUIRED');
  if (isForbiddenBranch(targetBranch)) issues.push('CANONICAL_BRANCH_WRITE_FORBIDDEN');

  for (const flag of FORBIDDEN_POLICY_FLAGS) {
    if (policy[flag] === true) issues.push('UNSAFE_POLICY:' + flag);
  }
  if (policy.private_preview_deploy !== true) issues.push('PRIVATE_PREVIEW_DEPLOY_REQUIRED');

  for (const adapter of REQUIRED_ADAPTERS) {
    if (typeof adapters[adapter] !== 'function') issues.push('ADAPTER_REQUIRED:' + adapter);
  }

  const requestedCycles = Math.floor(finite(input.max_cycles, 3));
  const maxCycles = Math.max(1, Math.min(AUTONOMOUS_DELIVERY_LOOP_MAX_CYCLES, requestedCycles));

  return {
    ok: issues.length === 0,
    status: issues.length ? 'BLOCK' : 'PASS',
    issues,
    project_scope: projectScope || null,
    mission_id: missionId || null,
    project_path: projectPath || null,
    target_branch: targetBranch || null,
    max_cycles: maxCycles,
    policy
  };
}

export async function runAutonomousDeliveryLoop(input = {}, adapters = {}) {
  const validation = validateAutonomousDeliveryLoopRequest(input, adapters);
  const base = {
    project_scope: validation.project_scope,
    mission_id: validation.mission_id,
    project_path: validation.project_path,
    target_branch: validation.target_branch,
    current_commit_sha: null,
    cycles_completed: 0,
    total_variable_cost_eur: 0,
    history: []
  };

  if (!validation.ok) {
    return stopResult(base, 'BLOCKED', 'INVALID_AUTONOMOUS_DELIVERY_LOOP_REQUEST', {
      validation,
      human_decision_required: false
    });
  }

  const maxCost = validation.policy.max_variable_cost_eur;
  const context = {
    project_scope: validation.project_scope,
    mission_id: validation.mission_id,
    project_path: validation.project_path,
    target_branch: validation.target_branch,
    reference: clone(input.reference || null),
    requirements: clone(input.requirements || {}),
    quality_level: clean(input.quality_level || 'PREMIUM', 80),
    policy: clone(validation.policy)
  };

  const charge = (phase, result) => {
    base.total_variable_cost_eur += resultCost(result);
    if (base.total_variable_cost_eur > maxCost + 1e-9) {
      return stopResult(base, 'BLOCKED', 'VARIABLE_COST_CEILING_EXCEEDED', {
        failed_phase: phase,
        max_variable_cost_eur: maxCost
      });
    }
    return null;
  };

  let build;
  try {
    build = await adapters.build({ ...clone(context) });
  } catch (error) {
    return stopResult(base, 'BLOCKED', 'BUILD_ADAPTER_FAILED', { error: clean(error?.message, 500) });
  }
  const buildCostBlock = charge('BUILD', build || {});
  if (buildCostBlock) return buildCostBlock;

  const buildFiles = validateChangedFiles(build || {}, validation.project_path);
  const buildCommit = clean(build?.commit_sha || build?.head_sha, 180);
  base.history.push({ phase: 'BUILD', ...summarizeGate(build || {}), commit_sha: buildCommit || null });

  if (!passStatus(build || {}) || !buildCommit || !buildFiles.ok) {
    return stopResult(base, 'BLOCKED', !buildFiles.ok ? 'BUILD_ESCAPED_PROJECT_SCOPE' : 'BUILD_FAILED', {
      build: summarizeGate(build || {}),
      outside_project_files: buildFiles.outside_project_files
    });
  }
  base.current_commit_sha = buildCommit;

  for (let cycle = 1; cycle <= validation.max_cycles; cycle += 1) {
    base.cycles_completed = cycle;

    let technical;
    try {
      technical = await adapters.technical_qa({ ...clone(context), cycle, commit_sha: base.current_commit_sha });
    } catch (error) {
      return stopResult(base, 'BLOCKED', 'TECHNICAL_QA_ADAPTER_FAILED', { error: clean(error?.message, 500) });
    }
    const technicalCostBlock = charge('TECHNICAL_QA', technical || {});
    if (technicalCostBlock) return technicalCostBlock;
    base.history.push({ phase: 'TECHNICAL_QA', cycle, ...summarizeGate(technical || {}), commit_sha: base.current_commit_sha });

    if (!passStatus(technical || {})) {
      const repaired = await repairAndAdvance({ reason: 'TECHNICAL_QA_FAILED', evidence: technical, cycle }, context, base, adapters, maxCost);
      if (!repaired.ok) return repaired.result;
      continue;
    }

    let visual;
    try {
      visual = await adapters.visual_closure({ ...clone(context), cycle, commit_sha: base.current_commit_sha });
    } catch (error) {
      return stopResult(base, 'BLOCKED', 'VISUAL_CLOSURE_ADAPTER_FAILED', { error: clean(error?.message, 500) });
    }
    const visualCostBlock = charge('VISUAL_CLOSURE', visual || {});
    if (visualCostBlock) return visualCostBlock;

    const visualSchemaOk = visual?.schema === 'riosystems.j7-visual-closure-result.v1';
    const visualPass = visualSchemaOk && clean(visual?.status, 80).toUpperCase() === 'PASS' && visual?.human_decision_required !== true;
    const visualCommit = clean(visual?.final_candidate?.commit_sha || visual?.final_commit_sha || base.current_commit_sha, 180);
    base.history.push({
      phase: 'VISUAL_CLOSURE',
      cycle,
      ...summarizeGate(visual || {}),
      commit_sha: visualCommit || base.current_commit_sha,
      iterations: finite(visual?.iterations, 0)
    });

    if (!visualPass) {
      return stopResult(base, 'HUMAN_DECISION_REQUIRED', visualSchemaOk ? clean(visual?.reason || 'VISUAL_CLOSURE_NOT_ACCEPTED', 240) : 'J7_VISUAL_CLOSURE_EVIDENCE_REQUIRED', {
        visual_closure: summarizeGate(visual || {})
      });
    }
    base.current_commit_sha = visualCommit || base.current_commit_sha;

    let browser;
    try {
      browser = await adapters.browser_acceptance({ ...clone(context), cycle, commit_sha: base.current_commit_sha });
    } catch (error) {
      return stopResult(base, 'BLOCKED', 'BROWSER_ACCEPTANCE_ADAPTER_FAILED', { error: clean(error?.message, 500) });
    }
    const browserCostBlock = charge('BROWSER_ACCEPTANCE', browser || {});
    if (browserCostBlock) return browserCostBlock;

    const browserSchemaOk = browser?.schema === 'riosystems.j9-browser-accessibility-performance-acceptance.v2';
    const automatedAccessibilityPass = clean(browser?.accessibility?.status, 80).toUpperCase() === 'PASS';
    const fullAccessibilityAccepted = browser?.full_accessibility_accepted === true;
    const humanAccessibilityReviewPending = browser?.human_accessibility_review_pending === true;
    const privatePreviewAccessibilityReady = automatedAccessibilityPass
      && (fullAccessibilityAccepted || humanAccessibilityReviewPending);
    const browserPass = browserSchemaOk
      && clean(browser?.status, 80).toUpperCase() === 'PASS'
      && privatePreviewAccessibilityReady;

    base.history.push({
      phase: 'BROWSER_ACCEPTANCE',
      cycle,
      ...summarizeGate(browser || {}),
      commit_sha: base.current_commit_sha,
      automated_accessibility_pass: automatedAccessibilityPass,
      full_accessibility_accepted: fullAccessibilityAccepted,
      human_accessibility_review_pending: humanAccessibilityReviewPending,
      private_preview_accessibility_ready: privatePreviewAccessibilityReady
    });

    if (!browserPass) {
      const reason = browserSchemaOk ? 'J9_ACCEPTANCE_FAILED' : 'J9_ACCEPTANCE_EVIDENCE_REQUIRED';
      const repaired = await repairAndAdvance({ reason, evidence: browser, cycle }, context, base, adapters, maxCost);
      if (!repaired.ok) return repaired.result;
      continue;
    }

    let preview;
    try {
      preview = await adapters.private_preview({ ...clone(context), cycle, commit_sha: base.current_commit_sha });
    } catch (error) {
      return stopResult(base, 'BLOCKED', 'PRIVATE_PREVIEW_ADAPTER_FAILED', { error: clean(error?.message, 500) });
    }
    const previewCostBlock = charge('PRIVATE_PREVIEW', preview || {});
    if (previewCostBlock) return previewCostBlock;

    const previewUrl = clean(preview?.url || preview?.preview_url, 1000);
    const previewCommit = clean(preview?.source_commit_sha, 180);
    const previewSafe = /^https:\/\//i.test(previewUrl)
      && preview?.private_access_verified === true
      && preview?.public_access !== true
      && preview?.production_deploy !== true
      && preview?.dns_change !== true
      && previewCommit === base.current_commit_sha;

    base.history.push({
      phase: 'PRIVATE_PREVIEW',
      cycle,
      status: previewSafe ? 'PASS' : 'FAIL',
      preview_url: previewUrl || null,
      source_commit_sha: previewCommit || null,
      private_access_verified: preview?.private_access_verified === true,
      variable_cost_eur: resultCost(preview || {})
    });

    if (!previewSafe) {
      return stopResult(base, 'BLOCKED', 'PRIVATE_PREVIEW_SAFETY_VERIFICATION_FAILED', {
        private_preview: {
          url: previewUrl || null,
          source_commit_sha: previewCommit || null,
          private_access_verified: preview?.private_access_verified === true,
          public_access: preview?.public_access === true,
          production_deploy: preview?.production_deploy === true,
          dns_change: preview?.dns_change === true
        }
      });
    }

    return {
      schema: AUTONOMOUS_DELIVERY_LOOP_SCHEMA,
      ok: true,
      status: 'PRIVATE_PREVIEW_READY',
      project_scope: validation.project_scope,
      mission_id: validation.mission_id,
      target_branch: validation.target_branch,
      project_path: validation.project_path,
      final_commit_sha: base.current_commit_sha,
      cycles_completed: cycle,
      total_variable_cost_eur: base.total_variable_cost_eur,
      private_preview: {
        url: previewUrl,
        source_commit_sha: previewCommit,
        private_access_verified: true
      },
      accessibility: {
        automated_pass: automatedAccessibilityPass,
        full_accessibility_accepted: fullAccessibilityAccepted,
        human_review_pending: humanAccessibilityReviewPending
      },
      history: clone(base.history),
      human_decision_required: false,
      next_action: {
        code: 'REVIEW_PRIVATE_PREVIEW',
        label: 'Review private preview'
      },
      automatic_merge: false,
      production_deploy: false,
      public_launch: false,
      dns_change: false,
      billing_activation: false,
      external_customer_writes: false
    };
  }

  return stopResult(base, 'HUMAN_DECISION_REQUIRED', 'BOUNDED_DELIVERY_CYCLES_EXHAUSTED');
}

async function repairAndAdvance(failure = {}, context = {}, base = {}, adapters = {}, maxCost = 0) {
  let repair;
  try {
    repair = await adapters.repair({
      ...clone(context),
      cycle: failure.cycle,
      commit_sha: base.current_commit_sha,
      reason: failure.reason,
      evidence: clone(failure.evidence || null)
    });
  } catch (error) {
    return { ok: false, result: stopResult(base, 'BLOCKED', 'REPAIR_ADAPTER_FAILED', { error: clean(error?.message, 500) }) };
  }

  base.total_variable_cost_eur += resultCost(repair || {});
  const changed = validateChangedFiles(repair || {}, base.project_path);
  const repairCommit = clean(repair?.commit_sha || repair?.head_sha, 180);
  base.history.push({
    phase: 'BOUNDED_REPAIR',
    cycle: failure.cycle,
    reason: failure.reason,
    ...summarizeGate(repair || {}),
    commit_sha: repairCommit || null,
    changed_files: changed.changed_files
  });

  if (base.total_variable_cost_eur > maxCost + 1e-9) {
    return { ok: false, result: stopResult(base, 'BLOCKED', 'VARIABLE_COST_CEILING_EXCEEDED', { failed_phase: 'BOUNDED_REPAIR', max_variable_cost_eur: maxCost }) };
  }
  if (!passStatus(repair || {}) || !repairCommit || !changed.ok) {
    return { ok: false, result: stopResult(base, 'HUMAN_DECISION_REQUIRED', !changed.ok ? 'REPAIR_ESCAPED_PROJECT_SCOPE' : 'REPAIR_FAILED', { outside_project_files: changed.outside_project_files }) };
  }

  base.current_commit_sha = repairCommit;
  return { ok: true };
}
