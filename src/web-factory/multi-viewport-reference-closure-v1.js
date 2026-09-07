import { REFERENCE_VIEWPORTS, verifyApprovedReferenceLock } from './reference-studio-v1.js';
import { runApprovedReferenceVisualClosure } from './visual-closure-loop-v1.js';

export const J8_VIEWPORT_REQUIREMENTS = Object.freeze({
  '1440_DESKTOP': Object.freeze({ width: 1440, role: 'DESKTOP' }),
  '1024_TABLET': Object.freeze({ width: 1024, role: 'TABLET' }),
  '390_MOBILE': Object.freeze({ width: 390, role: 'MOBILE' }),
  '320_SMALL_MOBILE': Object.freeze({ width: 320, role: 'SMALL_MOBILE' })
});

export const J8_VIEWPORT_ORDER = Object.freeze([
  '1440_DESKTOP',
  '1024_TABLET',
  '390_MOBILE',
  '320_SMALL_MOBILE'
]);

export const J8_DEFAULT_MAX_CONVERGENCE_CYCLES = 3;
export const J8_HARD_MAX_CONVERGENCE_CYCLES = 6;

const arr = (v) => Array.isArray(v) ? v : [];
const obj = (v) => v && typeof v === 'object' && !Array.isArray(v) ? structuredClone(v) : null;
const clean = (v, max = 1000) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const finite = (v, fallback = null) => Number.isFinite(Number(v)) ? Number(v) : fallback;
const clone = (v) => v == null ? v : structuredClone(v);

function resolveCycles(value) {
  const requested = Math.floor(finite(value, J8_DEFAULT_MAX_CONVERGENCE_CYCLES));
  return Math.max(1, Math.min(J8_HARD_MAX_CONVERGENCE_CYCLES, requested));
}

function blocking(status, issues = [], extra = {}) {
  return {
    schema: 'riosystems.j8-multi-viewport-reference-set-verification.v1',
    status,
    issues,
    blocking_issues: issues,
    ...extra,
    production_deploy: false,
    public_launch: false,
    dns_change: false,
    billing_activation: false,
    automatic_paid_activation: false,
    external_writes: false
  };
}

function viewportId(target = {}) {
  return clean(target.viewport_id || target.reference?.viewport, 80).toUpperCase();
}

function targetSummary(target = {}) {
  const id = viewportId(target);
  return {
    viewport_id: id,
    viewport: clone(target.viewport),
    reference_id: target.reference?.reference_id || null,
    reference_hash: target.reference?.hash || null,
    locked_regions: [...arr(target.locked_regions)],
    constraints: clone(target.constraints || {})
  };
}

export function verifyMultiViewportReferenceSet(input = {}) {
  const issues = [];
  const targets = arr(input.targets);
  const byViewport = new Map();
  const referenceIds = new Set();

  for (const target of targets) {
    const id = viewportId(target);
    if (!J8_VIEWPORT_REQUIREMENTS[id]) {
      issues.push({ code: 'J8_VIEWPORT_UNSUPPORTED', severity: 'BLOCK', viewport_id: id || null });
      continue;
    }
    if (byViewport.has(id)) {
      issues.push({ code: 'J8_VIEWPORT_DUPLICATE', severity: 'BLOCK', viewport_id: id });
      continue;
    }
    byViewport.set(id, target);

    const expectedWidth = J8_VIEWPORT_REQUIREMENTS[id].width;
    const width = finite(target.viewport?.width, null);
    const height = finite(target.viewport?.height, null);
    const dpr = finite(target.viewport?.device_pixel_ratio ?? target.viewport?.deviceScaleFactor ?? 1, null);
    if (width !== expectedWidth) issues.push({ code: 'J8_VIEWPORT_WIDTH_MISMATCH', severity: 'BLOCK', viewport_id: id, expected: expectedWidth, actual: width });
    if (!(height > 0)) issues.push({ code: 'J8_VIEWPORT_HEIGHT_REQUIRED', severity: 'BLOCK', viewport_id: id });
    if (!(dpr > 0)) issues.push({ code: 'J8_VIEWPORT_DPR_REQUIRED', severity: 'BLOCK', viewport_id: id });

    if (!target.reference) {
      issues.push({ code: 'J8_APPROVED_REFERENCE_REQUIRED', severity: 'BLOCK', viewport_id: id });
    } else {
      const lock = verifyApprovedReferenceLock(target.reference);
      if (!lock.ok) issues.push({ code: 'J8_APPROVED_REFERENCE_LOCK_REQUIRED', severity: 'BLOCK', viewport_id: id, reference_status: lock.status });
      if (clean(target.reference.viewport, 80) !== id) issues.push({ code: 'J8_REFERENCE_VIEWPORT_MISMATCH', severity: 'BLOCK', viewport_id: id, actual: target.reference.viewport || null });
      const refId = clean(target.reference.reference_id, 320);
      if (!refId) issues.push({ code: 'J8_REFERENCE_ID_REQUIRED', severity: 'BLOCK', viewport_id: id });
      else if (referenceIds.has(refId)) issues.push({ code: 'J8_REFERENCE_REUSE_FORBIDDEN', severity: 'BLOCK', viewport_id: id, reference_id: refId });
      else referenceIds.add(refId);
    }

    if (!clean(target.reference_path, 1000)) issues.push({ code: 'J8_REFERENCE_PNG_PATH_REQUIRED', severity: 'BLOCK', viewport_id: id });
    if (!target.reference_geometry?.components) issues.push({ code: 'J8_REFERENCE_GEOMETRY_REQUIRED', severity: 'BLOCK', viewport_id: id });
    if (!Array.isArray(target.locked_regions)) issues.push({ code: 'J8_LOCK_SET_REQUIRED', severity: 'BLOCK', viewport_id: id });
    if (!obj(target.constraints) || Object.keys(target.constraints).length === 0) issues.push({ code: 'J8_VIEWPORT_CONSTRAINTS_REQUIRED', severity: 'BLOCK', viewport_id: id });
    if (!Array.isArray(target.regions) || target.regions.length === 0) issues.push({ code: 'J8_REFERENCE_REGIONS_REQUIRED', severity: 'BLOCK', viewport_id: id });
  }

  for (const id of J8_VIEWPORT_ORDER) {
    if (!byViewport.has(id)) issues.push({ code: 'J8_REQUIRED_VIEWPORT_MISSING', severity: 'BLOCK', viewport_id: id });
  }

  if (targets.length !== J8_VIEWPORT_ORDER.length) {
    issues.push({ code: 'J8_EXACT_VIEWPORT_SET_REQUIRED', severity: 'BLOCK', expected: J8_VIEWPORT_ORDER.length, actual: targets.length });
  }

  const orderedTargets = J8_VIEWPORT_ORDER.map((id) => byViewport.get(id)).filter(Boolean);
  return blocking(issues.length ? 'BLOCK' : 'PASS', issues, {
    required_viewports: [...J8_VIEWPORT_ORDER],
    targets: orderedTargets.map(targetSummary),
    independent_reference_per_viewport: true,
    blind_desktop_scaling_allowed: false,
    shared_final_commit_required: true
  });
}

function mergeFunctionalAndConstraint(base = {}, constraint = {}) {
  if (!['PASS', 'FAIL'].includes(String(base.status))) throw new Error('J8_FUNCTIONAL_REGRESSION_STATUS_REQUIRED');
  if (!['PASS', 'FAIL'].includes(String(constraint.status))) throw new Error('J8_VIEWPORT_CONSTRAINT_GATE_STATUS_REQUIRED');
  const responsiveFail = base.responsive_status === 'FAIL' || constraint.responsive_status === 'FAIL' || constraint.status === 'FAIL';
  const accessibilityFail = base.accessibility_status === 'FAIL' || constraint.accessibility_status === 'FAIL';
  return {
    status: base.status === 'PASS' && constraint.status === 'PASS' && !responsiveFail && !accessibilityFail ? 'PASS' : 'FAIL',
    responsive_status: responsiveFail ? 'FAIL' : 'PASS',
    accessibility_status: accessibilityFail ? 'FAIL' : 'PASS',
    evidence: {
      base: clone(base.evidence || {}),
      viewport_constraints: clone(constraint)
    }
  };
}

async function scopedAdapters(adapters, target, context) {
  if (typeof adapters.for_viewport !== 'function') throw new Error('J8_FOR_VIEWPORT_ADAPTER_REQUIRED');
  if (typeof adapters.constraint_gate !== 'function') throw new Error('J8_CONSTRAINT_GATE_ADAPTER_REQUIRED');
  const scoped = await adapters.for_viewport({
    viewport_id: context.viewport_id,
    target: clone(target),
    cycle: context.cycle,
    implementation_commit: context.implementation_commit
  });
  if (!scoped || typeof scoped !== 'object') throw new Error('J8_SCOPED_ADAPTERS_REQUIRED');
  if (typeof scoped.functional_regression !== 'function') throw new Error('J8_SCOPED_FUNCTIONAL_REGRESSION_REQUIRED');

  return {
    ...scoped,
    async functional_regression(runtimeContext = {}) {
      const base = await scoped.functional_regression(runtimeContext);
      const constraint = await adapters.constraint_gate({
        ...runtimeContext,
        viewport_id: context.viewport_id,
        target: clone(target),
        constraints: clone(target.constraints),
        cycle: context.cycle,
        implementation_commit: context.implementation_commit,
        base_functional: clone(base)
      });
      return mergeFunctionalAndConstraint(base, constraint);
    }
  };
}

function viewportClosureReport(target, result) {
  const finalCandidate = result?.final_candidate || null;
  return {
    viewport_id: viewportId(target),
    reference: {
      reference_id: target.reference?.reference_id || null,
      reference_hash: target.reference?.hash || null,
      viewport: target.reference?.viewport || null,
      render_asset_hash: target.reference?.artifact?.render_asset_hash || null,
      verification: clone(result?.reference_verification || null)
    },
    locks: clone(result?.region_locks || { regions: arr(target.locked_regions) }),
    constraints: clone(target.constraints),
    screenshot: clone(finalCandidate?.capture || null),
    metrics: clone(finalCandidate?.measurement || null),
    delta_report: {
      deltas: clone(finalCandidate?.raw_deltas || []),
      blocking_count: arr(finalCandidate?.raw_deltas).filter((d) => d?.blocking === true).length
    },
    acceptance: {
      visual: clone(finalCandidate?.visual_acceptance || null),
      semantic: clone(finalCandidate?.semantic || null),
      functional: clone(finalCandidate?.functional || null)
    },
    status: result?.status || 'UNKNOWN',
    reason: result?.reason || null,
    iterations: Number(result?.iterations || 0),
    final_commit: finalCandidate?.commit_sha || null,
    human_decision_required: result?.human_decision_required === true,
    comparator: result?.comparator || 'VISUAL_FOUNDRY_ONLY'
  };
}

export async function runMultiViewportReferenceClosure(input = {}, adapters = {}) {
  const verification = verifyMultiViewportReferenceSet(input);
  if (verification.status !== 'PASS') {
    return {
      schema: 'riosystems.j8-multi-viewport-reference-closure-result.v1',
      status: 'BLOCKED_REFERENCE_SET',
      reference_set_verification: verification,
      human_decision_required: true,
      convergence_cycles: 0,
      history: [],
      production_deploy: false,
      public_launch: false,
      dns_change: false,
      billing_activation: false,
      automatic_paid_activation: false,
      external_writes: false
    };
  }

  let currentCommit = clean(input.initial_commit, 180);
  if (!currentCommit) throw new Error('J8_INITIAL_COMMIT_REQUIRED');
  const maxCycles = resolveCycles(input.max_convergence_cycles);
  const targets = J8_VIEWPORT_ORDER.map((id) => input.targets.find((target) => viewportId(target) === id));
  const history = [];

  for (let cycle = 1; cycle <= maxCycles; cycle++) {
    const cycleStartCommit = currentCommit;
    const reports = [];
    let repairedThisCycle = false;

    for (const target of targets) {
      const id = viewportId(target);
      const scoped = await scopedAdapters(adapters, target, {
        viewport_id: id,
        cycle,
        implementation_commit: currentCommit
      });
      const result = await runApprovedReferenceVisualClosure({
        ...clone(target),
        viewport_id: id,
        initial_commit: currentCommit,
        max_repair_rounds: target.max_repair_rounds ?? input.max_repair_rounds
      }, scoped);
      const report = viewportClosureReport(target, result);
      reports.push(report);

      if (result.status !== 'PASS') {
        history.push({
          cycle,
          cycle_start_commit: cycleStartCommit,
          cycle_end_commit: currentCommit,
          status: 'BLOCKED',
          blocking_viewport: id,
          viewport_reports: reports
        });
        return {
          schema: 'riosystems.j8-multi-viewport-reference-closure-result.v1',
          status: 'HUMAN_DECISION_REQUIRED',
          reason: result.reason || result.status,
          blocking_viewport: id,
          reference_set_verification: verification,
          initial_commit: clean(input.initial_commit, 180),
          final_commit: currentCommit,
          convergence_cycles: cycle,
          max_convergence_cycles: maxCycles,
          viewport_reports: reports,
          history,
          stable_same_commit: false,
          human_decision_required: true,
          comparator: 'VISUAL_FOUNDRY_ONLY',
          blind_desktop_scaling_allowed: false,
          production_deploy: false,
          public_launch: false,
          dns_change: false,
          billing_activation: false,
          automatic_paid_activation: false,
          external_writes: false
        };
      }

      const nextCommit = clean(result.final_candidate?.commit_sha || currentCommit, 180);
      if (Number(result.iterations || 0) > 0 || nextCommit !== currentCommit) repairedThisCycle = true;
      currentCommit = nextCommit;
    }

    const allZeroRepair = reports.every((report) => report.status === 'PASS' && report.iterations === 0);
    const allSameCommit = reports.every((report) => report.final_commit === currentCommit);
    const stable = allZeroRepair && allSameCommit && !repairedThisCycle;
    history.push({
      cycle,
      cycle_start_commit: cycleStartCommit,
      cycle_end_commit: currentCommit,
      status: stable ? 'STABLE_PASS' : 'REVALIDATION_REQUIRED',
      repaired_this_cycle: repairedThisCycle,
      viewport_reports: reports
    });

    if (stable) {
      return {
        schema: 'riosystems.j8-multi-viewport-reference-closure-result.v1',
        status: 'PASS',
        reference_set_verification: verification,
        initial_commit: clean(input.initial_commit, 180),
        final_commit: currentCommit,
        convergence_cycles: cycle,
        max_convergence_cycles: maxCycles,
        viewport_reports: reports,
        history,
        stable_same_commit: true,
        all_required_viewports_pass: true,
        independent_reference_per_viewport: true,
        blind_desktop_scaling_allowed: false,
        human_decision_required: false,
        comparator: 'VISUAL_FOUNDRY_ONLY',
        production_deploy: false,
        public_launch: false,
        dns_change: false,
        billing_activation: false,
        automatic_paid_activation: false,
        external_writes: false
      };
    }
  }

  return {
    schema: 'riosystems.j8-multi-viewport-reference-closure-result.v1',
    status: 'HUMAN_DECISION_REQUIRED',
    reason: 'MULTI_VIEWPORT_CONVERGENCE_NOT_STABLE',
    reference_set_verification: verification,
    initial_commit: clean(input.initial_commit, 180),
    final_commit: currentCommit,
    convergence_cycles: maxCycles,
    max_convergence_cycles: maxCycles,
    viewport_reports: clone(history.at(-1)?.viewport_reports || []),
    history,
    stable_same_commit: false,
    all_required_viewports_pass: false,
    independent_reference_per_viewport: true,
    blind_desktop_scaling_allowed: false,
    human_decision_required: true,
    comparator: 'VISUAL_FOUNDRY_ONLY',
    production_deploy: false,
    public_launch: false,
    dns_change: false,
    billing_activation: false,
    automatic_paid_activation: false,
    external_writes: false
  };
}

export function multiViewportReferenceClosureManifest() {
  return {
    schema: 'riosystems.j8-multi-viewport-reference-closure-manifest.v1',
    required_viewports: J8_VIEWPORT_ORDER.map((viewport_id) => ({
      viewport_id,
      ...J8_VIEWPORT_REQUIREMENTS[viewport_id]
    })),
    per_viewport_evidence: ['REFERENCE', 'LOCKS', 'CONSTRAINTS', 'SCREENSHOT', 'METRICS', 'DELTA_REPORT', 'ACCEPTANCE'],
    independent_reference_per_viewport: true,
    independent_locks_per_viewport: true,
    independent_constraints_per_viewport: true,
    blind_desktop_scaling_allowed: false,
    shared_final_commit_required: true,
    stable_zero_repair_revalidation_required: true,
    comparator: 'VISUAL_FOUNDRY_ONLY',
    visual_closure_engine: 'J7_FULL_VISUAL_CLOSURE_LOOP_V1',
    default_max_convergence_cycles: J8_DEFAULT_MAX_CONVERGENCE_CYCLES,
    hard_max_convergence_cycles: J8_HARD_MAX_CONVERGENCE_CYCLES,
    infinite_loop_allowed: false,
    production_deploy: false,
    public_launch: false,
    dns_change: false,
    billing_activation: false,
    automatic_paid_activation: false,
    external_writes: false
  };
}
