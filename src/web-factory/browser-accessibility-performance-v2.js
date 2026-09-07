export const J9_BROWSER_CHECKS = Object.freeze([
  'navigation',
  'mobile_navigation',
  'cta',
  'forms',
  'anchors',
  'buttons',
  'dialogs',
  'accordions',
  'gallery',
  'carousel',
  'video',
  'keyboard_navigation',
  'focus_states',
  '404',
  'external_links',
  'scroll_behavior',
  'sticky_navigation',
  'orientation_changes'
]);

export const J9_BROWSER_MATRIX = Object.freeze({
  CHROMIUM: Object.freeze({ requirement: 'REQUIRED' }),
  WEBKIT: Object.freeze({ requirement: 'RECOMMENDED' }),
  FIREFOX: Object.freeze({ requirement: 'PROFILE_DEPENDENT' })
});

export const J9_DEVICE_MATRIX = Object.freeze([
  'DESKTOP',
  'LAPTOP',
  'TABLET',
  'IPHONE',
  'SMALL_MOBILE'
]);

export const J9_ACCESSIBILITY_STATES = Object.freeze([
  'AUTOMATED_PASS',
  'HUMAN_REVIEW_PENDING',
  'FULL_ACCEPTED'
]);

export const J9_A11Y_REQUIRED_CHECKS = Object.freeze([
  'keyboard_navigation',
  'visible_focus',
  'heading_hierarchy',
  'landmarks',
  'labels',
  'contrast',
  'alt_text',
  'reduced_motion',
  'touch_target_size',
  'zoom_behavior'
]);

export const J9_HUMAN_A11Y_CHECKS = Object.freeze([
  'keyboard',
  'focus',
  'form_errors',
  'navigation',
  'semantic_basics',
  'screenreader_basics',
  'zoom_reflow',
  'touch_interaction'
]);

export const J9_LIGHTHOUSE_MINIMUMS = Object.freeze({
  performance: 0.90,
  accessibility: 0.95,
  best_practices: 0.95
});

export const J9_PERFORMANCE_BUDGETS = Object.freeze({
  total_assets_bytes: 5 * 1024 * 1024,
  javascript_warning_bytes: 300 * 1024
});

export const J9_FIELD_CWV_GOOD = Object.freeze({
  lcp_ms: 2500,
  inp_ms: 200,
  cls: 0.1,
  percentile: 75
});

export const J9_FIELD_CWV_POOR = Object.freeze({
  lcp_ms: 4000,
  inp_ms: 500,
  cls: 0.25,
  percentile: 75
});

const arr = (v) => Array.isArray(v) ? v : [];
const clean = (v, max = 1000) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const finite = (v, fallback = null) => Number.isFinite(Number(v)) ? Number(v) : fallback;
const clone = (v) => v == null ? v : structuredClone(v);

function normalizeStatus(v) {
  const value = clean(typeof v === 'object' ? (v?.status ?? v?.state) : v, 80).toUpperCase();
  if (['PASS', 'FAIL', 'NOT_APPLICABLE', 'NOT_VERIFIED'].includes(value)) return value;
  if (v === true) return 'PASS';
  if (v === false) return 'FAIL';
  return 'NOT_VERIFIED';
}

function issue(code, severity = 'BLOCK', extra = {}) {
  return { code, severity, ...extra };
}

export function evaluateJ9BrowserMatrix(input = {}) {
  const profiles = input.profiles || {};
  const issues = [];
  const warnings = [];
  const normalized = {};

  for (const [browser, policy] of Object.entries(J9_BROWSER_MATRIX)) {
    const profile = profiles[browser] || profiles[browser.toLowerCase()] || null;
    if (!profile) {
      if (policy.requirement === 'REQUIRED') issues.push(issue('J9_REQUIRED_BROWSER_MISSING', 'BLOCK', { browser }));
      else warnings.push(issue('J9_BROWSER_PROFILE_NOT_RUN', 'WARNING', { browser, requirement: policy.requirement }));
      normalized[browser] = { requirement: policy.requirement, status: 'NOT_VERIFIED', devices: [] };
      continue;
    }

    const deviceResults = [];
    const suppliedDevices = profile.devices || {};
    for (const device of J9_DEVICE_MATRIX) {
      const raw = suppliedDevices[device] || suppliedDevices[device.toLowerCase()] || null;
      if (!raw) {
        if (policy.requirement === 'REQUIRED') issues.push(issue('J9_REQUIRED_DEVICE_MISSING', 'BLOCK', { browser, device }));
        deviceResults.push({ device, status: 'NOT_VERIFIED', checks: [] });
        continue;
      }

      const checks = J9_BROWSER_CHECKS.map((check) => {
        const rawCheck = raw.checks?.[check] ?? raw[check];
        const status = normalizeStatus(rawCheck);
        const reason = clean(rawCheck?.reason, 500) || null;
        if (status === 'NOT_APPLICABLE' && !reason) {
          if (policy.requirement === 'REQUIRED') issues.push(issue('J9_NOT_APPLICABLE_REASON_REQUIRED', 'BLOCK', { browser, device, check }));
        } else if (!['PASS', 'NOT_APPLICABLE'].includes(status) && policy.requirement === 'REQUIRED') {
          issues.push(issue('J9_BROWSER_CHECK_FAILED', 'BLOCK', { browser, device, check, status }));
        }
        return { check, status, reason };
      });
      const status = checks.every((x) => ['PASS', 'NOT_APPLICABLE'].includes(x.status)) ? 'PASS' : 'FAIL';
      deviceResults.push({
        device,
        viewport: clone(raw.viewport || null),
        status,
        checks,
        evidence: clone(raw.evidence || {})
      });
    }

    const browserStatus = deviceResults.length === J9_DEVICE_MATRIX.length && deviceResults.every((x) => x.status === 'PASS')
      ? 'PASS'
      : 'FAIL';
    if (browserStatus !== 'PASS' && policy.requirement === 'RECOMMENDED') {
      warnings.push(issue('J9_RECOMMENDED_BROWSER_NOT_FULL_PASS', 'WARNING', { browser }));
    }
    normalized[browser] = {
      requirement: policy.requirement,
      status: browserStatus,
      devices: deviceResults
    };
  }

  return {
    schema: 'riosystems.j9-browser-matrix-report.v2',
    status: issues.length ? 'FAIL' : 'PASS',
    required_browser: 'CHROMIUM',
    profiles: normalized,
    blocking_issues: issues,
    warnings,
    browser_checks: [...J9_BROWSER_CHECKS],
    device_matrix: [...J9_DEVICE_MATRIX]
  };
}

export function evaluateJ9Accessibility(input = {}) {
  const issues = [];
  const axeCritical = Math.max(0, finite(input.axe?.critical ?? input.axe_critical, 0));
  const axeSerious = Math.max(0, finite(input.axe?.serious ?? input.axe_serious, 0));
  if (axeCritical !== 0) issues.push(issue('J9_AXE_CRITICAL_VIOLATIONS', 'BLOCK', { actual: axeCritical, maximum: 0 }));
  if (axeSerious !== 0) issues.push(issue('J9_AXE_SERIOUS_VIOLATIONS', 'BLOCK', { actual: axeSerious, maximum: 0 }));

  const checks = J9_A11Y_REQUIRED_CHECKS.map((check) => {
    const raw = input.checks?.[check];
    const status = normalizeStatus(raw);
    if (status !== 'PASS') issues.push(issue('J9_ACCESSIBILITY_CHECK_FAILED', 'BLOCK', { check, status }));
    return { check, status, evidence: clone(raw?.evidence || null) };
  });

  const automatedPass = issues.length === 0;
  const human = input.human_review || null;
  const humanChecks = J9_HUMAN_A11Y_CHECKS.map((check) => {
    const raw = human?.checks?.[check] ?? human?.[check];
    return { check, status: normalizeStatus(raw), evidence: clone(raw?.evidence || null) };
  });
  const humanIdentity = clean(human?.reviewed_by, 240);
  const humanTimestamp = clean(human?.reviewed_at, 100);
  const humanPass = Boolean(humanIdentity && humanTimestamp && humanChecks.every((x) => x.status === 'PASS'));

  let state = automatedPass ? 'AUTOMATED_PASS' : 'FAIL';
  if (automatedPass && !humanPass) state = 'HUMAN_REVIEW_PENDING';
  if (automatedPass && humanPass) state = 'FULL_ACCEPTED';

  return {
    schema: 'riosystems.j9-accessibility-report.v2',
    status: automatedPass ? 'PASS' : 'FAIL',
    state,
    target: 'WCAG 2.2 AA',
    certification_claimed: false,
    automated_pass_does_not_replace_human_review: true,
    axe: { critical: axeCritical, serious: axeSerious, maximum_each: 0 },
    checks,
    human_review: {
      status: humanPass ? 'PASS' : 'PENDING',
      reviewed_by: humanIdentity || null,
      reviewed_at: humanTimestamp || null,
      checks: humanChecks
    },
    blocking_issues: issues
  };
}

function assetTotals(items = []) {
  const categories = { javascript: 0, css: 0, images: 0, video: 0, fonts: 0, other: 0 };
  const list = arr(items).map((item, index) => {
    const bytes = Math.max(0, finite(item.bytes, 0));
    const category = Object.hasOwn(categories, item.category) ? item.category : 'other';
    categories[category] += bytes;
    return {
      id: clean(item.id || item.path || ('asset-' + (index + 1)), 500),
      category,
      bytes,
      third_party: item.third_party === true
    };
  });
  return {
    items: list,
    categories,
    total_bytes: Object.values(categories).reduce((sum, value) => sum + value, 0),
    third_party_scripts: list.filter((item) => item.category === 'javascript' && item.third_party)
  };
}

export function evaluateJ9Performance(input = {}) {
  const issues = [];
  const warnings = [];
  const assets = assetTotals(input.assets);

  if (assets.total_bytes > J9_PERFORMANCE_BUDGETS.total_assets_bytes) {
    issues.push(issue('J9_TOTAL_ASSET_BUDGET_EXCEEDED', 'BLOCK', {
      actual_bytes: assets.total_bytes,
      maximum_bytes: J9_PERFORMANCE_BUDGETS.total_assets_bytes
    }));
  }
  if (assets.categories.javascript > J9_PERFORMANCE_BUDGETS.javascript_warning_bytes) {
    warnings.push(issue('J9_JAVASCRIPT_BUDGET_WARNING', 'WARNING', {
      actual_bytes: assets.categories.javascript,
      warning_above_bytes: J9_PERFORMANCE_BUDGETS.javascript_warning_bytes
    }));
  }
  if (assets.third_party_scripts.length) {
    warnings.push(issue('J9_THIRD_PARTY_SCRIPT_WARNING', 'WARNING', {
      count: assets.third_party_scripts.length,
      scripts: assets.third_party_scripts.map((x) => x.id)
    }));
  }

  const profileBudgets = input.category_budgets || {};
  for (const category of ['css', 'images', 'video']) {
    const maximum = finite(profileBudgets?.[category]?.maximum_bytes ?? profileBudgets?.[category], null);
    if (maximum != null && assets.categories[category] > maximum) {
      issues.push(issue('J9_CATEGORY_BUDGET_EXCEEDED', 'BLOCK', {
        category,
        actual_bytes: assets.categories[category],
        maximum_bytes: maximum,
        source: 'EXPLICIT_PROFILE_BUDGET'
      }));
    }
  }

  const lighthouse = {
    performance: finite(input.lighthouse?.performance, null),
    accessibility: finite(input.lighthouse?.accessibility, null),
    best_practices: finite(input.lighthouse?.best_practices ?? input.lighthouse?.['best-practices'], null)
  };
  for (const [category, minimum] of Object.entries(J9_LIGHTHOUSE_MINIMUMS)) {
    const score = lighthouse[category];
    if (score == null) issues.push(issue('J9_LIGHTHOUSE_SCORE_REQUIRED', 'BLOCK', { category, minimum }));
    else if (score < minimum) issues.push(issue('J9_LIGHTHOUSE_SCORE_BELOW_MINIMUM', 'BLOCK', { category, actual: score, minimum }));
  }

  const field = input.field_cwv || {};
  const hasRealField = field.real_field_evidence === true && clean(field.evidence_ref, 500);
  const fieldMetrics = {
    lcp_ms: finite(field.lcp_ms, null),
    inp_ms: finite(field.inp_ms, null),
    cls: finite(field.cls, null),
    percentile: finite(field.percentile, 75)
  };
  let fieldStatus = 'NOT_VERIFIED';
  if (hasRealField) {
    const allPresent = fieldMetrics.lcp_ms != null && fieldMetrics.inp_ms != null && fieldMetrics.cls != null;
    const good = allPresent
      && fieldMetrics.percentile === J9_FIELD_CWV_GOOD.percentile
      && fieldMetrics.lcp_ms <= J9_FIELD_CWV_GOOD.lcp_ms
      && fieldMetrics.inp_ms <= J9_FIELD_CWV_GOOD.inp_ms
      && fieldMetrics.cls <= J9_FIELD_CWV_GOOD.cls;
    fieldStatus = good ? 'PASS' : 'FAIL';
  }

  return {
    schema: 'riosystems.j9-performance-report.v2',
    status: issues.length ? 'FAIL' : 'PASS',
    budgets: {
      total_assets_bytes: J9_PERFORMANCE_BUDGETS.total_assets_bytes,
      javascript_warning_bytes: J9_PERFORMANCE_BUDGETS.javascript_warning_bytes,
      category_budgets: clone(profileBudgets)
    },
    assets,
    lighthouse: {
      ...lighthouse,
      minimums: clone(J9_LIGHTHOUSE_MINIMUMS),
      status: Object.entries(J9_LIGHTHOUSE_MINIMUMS).every(([k, min]) => lighthouse[k] != null && lighthouse[k] >= min) ? 'PASS' : 'FAIL'
    },
    field_cwv: {
      status: fieldStatus,
      field_cwv_claimed: hasRealField && fieldStatus !== 'NOT_VERIFIED',
      real_field_evidence: Boolean(hasRealField),
      evidence_ref: clean(field.evidence_ref, 500) || null,
      metrics: fieldMetrics,
      good_thresholds: clone(J9_FIELD_CWV_GOOD),
      poor_thresholds: clone(J9_FIELD_CWV_POOR),
      prelaunch_lab_is_not_field_cwv: true
    },
    blocking_issues: issues,
    warnings
  };
}

export function compileJ9Acceptance(input = {}) {
  const browser = evaluateJ9BrowserMatrix(input.browser || {});
  const accessibility = evaluateJ9Accessibility(input.accessibility || {});
  const performance = evaluateJ9Performance(input.performance || {});
  const blockers = [
    ...browser.blocking_issues.map((x) => ({ area: 'BROWSER', ...x })),
    ...accessibility.blocking_issues.map((x) => ({ area: 'ACCESSIBILITY', ...x })),
    ...performance.blocking_issues.map((x) => ({ area: 'PERFORMANCE', ...x }))
  ];

  return {
    schema: 'riosystems.j9-browser-accessibility-performance-acceptance.v2',
    status: blockers.length ? 'FAIL' : 'PASS',
    browser,
    accessibility,
    performance,
    blocking_issues: blockers,
    warnings: [...browser.warnings, ...performance.warnings],
    human_accessibility_review_pending: accessibility.state === 'HUMAN_REVIEW_PENDING',
    full_accessibility_accepted: accessibility.state === 'FULL_ACCEPTED',
    production_deploy: false,
    public_launch: false,
    dns_change: false,
    billing_activation: false,
    automatic_paid_activation: false,
    external_writes: false
  };
}

export function j9BrowserAccessibilityPerformanceManifest() {
  return {
    schema: 'riosystems.j9-browser-accessibility-performance-manifest.v2',
    browser_checks: [...J9_BROWSER_CHECKS],
    browser_matrix: clone(J9_BROWSER_MATRIX),
    device_matrix: [...J9_DEVICE_MATRIX],
    accessibility: {
      target: 'WCAG 2.2 AA',
      axe_critical_maximum: 0,
      axe_serious_maximum: 0,
      required_checks: [...J9_A11Y_REQUIRED_CHECKS],
      human_checks: [...J9_HUMAN_A11Y_CHECKS],
      states: [...J9_ACCESSIBILITY_STATES],
      certification_claimed: false,
      automated_pass_replaces_human_review: false
    },
    performance: {
      lighthouse_minimums: clone(J9_LIGHTHOUSE_MINIMUMS),
      total_assets_block_above_bytes: J9_PERFORMANCE_BUDGETS.total_assets_bytes,
      javascript_warning_above_bytes: J9_PERFORMANCE_BUDGETS.javascript_warning_bytes,
      css_images_video: 'MEASURED_WITH_EXPLICIT_PROFILE_BUDGET_WHEN_DEFINED',
      third_party_scripts: 'WARNING',
      lab_and_field_cwv_separate: true,
      field_good_thresholds: clone(J9_FIELD_CWV_GOOD),
      field_poor_thresholds: clone(J9_FIELD_CWV_POOR)
    },
    chromium_required: true,
    webkit_recommended: true,
    firefox_profile_dependent: true,
    production_deploy: false,
    public_launch: false,
    dns_change: false,
    billing_activation: false,
    automatic_paid_activation: false,
    external_writes: false
  };
}
