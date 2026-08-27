const FIXABLE_CODES = new Set(['GEOMETRIC_OVERFLOW', 'SCROLL_OVERFLOW']);
const MEDIA_TAGS = new Set(['img', 'video', 'canvas', 'svg']);

function cleanSelector(value = '') {
  const selector = String(value || '').trim();
  if (!selector || selector.length > 180) return '';
  if (!/^[a-zA-Z0-9_.#:-]+$/.test(selector)) return '';
  if (selector.includes('::')) return '';
  return selector;
}

function legacyIssues(report) {
  const issues = [];
  for (const result of report?.results || []) {
    const viewport = result?.viewport?.name || 'unknown';
    for (const message of result?.failures || []) {
      let code = 'UNKNOWN_QA_FAILURE';
      if (/geometric horizontal overflow/i.test(message)) code = 'GEOMETRIC_OVERFLOW';
      else if (/scroll overflow/i.test(message)) code = 'SCROLL_OVERFLOW';
      else if (/^HTTP status/i.test(message)) code = 'HTTP_STATUS';
      else if (/missing visible h1/i.test(message)) code = 'MISSING_H1';
      else if (/missing main element/i.test(message)) code = 'MISSING_MAIN';
      else if (/visible main sections/i.test(message)) code = 'TOO_FEW_SECTIONS';
      else if (/too little visible text/i.test(message)) code = 'TOO_LITTLE_TEXT';
      else if (/page error/i.test(message)) code = 'PAGE_ERROR';
      issues.push({ code, viewport, message, details: {} });
    }
  }
  return issues;
}

function normalizedIssues(report) {
  const structured = (report?.results || []).flatMap((result) =>
    (result?.issues || []).map((issue) => ({
      code: String(issue?.code || 'UNKNOWN_QA_FAILURE'),
      viewport: result?.viewport?.name || issue?.viewport || 'unknown',
      message: String(issue?.message || issue?.code || 'QA failure'),
      details: issue?.details && typeof issue.details === 'object' ? issue.details : {}
    }))
  );
  return structured.length ? structured : legacyIssues(report);
}

function culpritElements(issues) {
  return issues.flatMap((issue) => Array.isArray(issue?.details?.overflowElements) ? issue.details.overflowElements : []);
}

function profileForOverflowIssue(issue) {
  const elements = Array.isArray(issue?.details?.overflowElements) ? issue.details.overflowElements : [];
  if (issue.code === 'SCROLL_OVERFLOW' && elements.length === 0) return { type: 'VIEWPORT_CONTAINMENT', selectors: [] };

  const media = elements.filter((el) => MEDIA_TAGS.has(String(el?.tagName || '').toLowerCase()));
  if (media.length && media.length === elements.length) return { type: 'MEDIA_CONTAINMENT', selectors: [] };

  const nowrapSelectors = elements
    .filter((el) => String(el?.whiteSpace || '').includes('nowrap') && Number(el?.textLength || 0) > 0)
    .map((el) => cleanSelector(el?.selector))
    .filter(Boolean);
  if (nowrapSelectors.length) return { type: 'TEXT_WRAP', selectors: [...new Set(nowrapSelectors)].slice(0, 8) };

  const selectors = elements.map((el) => cleanSelector(el?.selector)).filter(Boolean);
  if (selectors.length) return { type: 'LAYOUT_CONTAINMENT', selectors: [...new Set(selectors)].slice(0, 8) };

  return issue.code === 'SCROLL_OVERFLOW'
    ? { type: 'VIEWPORT_CONTAINMENT', selectors: [] }
    : { type: 'UNSAFE_UNKNOWN_OVERFLOW', selectors: [] };
}

export function classifyQaReport(report) {
  const issues = normalizedIssues(report);
  const fixable = issues.length > 0 && issues.every((issue) => FIXABLE_CODES.has(issue.code));
  const profiles = fixable ? issues.map(profileForOverflowIssue) : [];
  const safeProfiles = profiles.filter((profile) => profile.type !== 'UNSAFE_UNKNOWN_OVERFLOW');
  const allProfilesSafe = profiles.length > 0 && safeProfiles.length === profiles.length;
  const repairProfiles = [];
  for (const profile of safeProfiles) {
    const key = `${profile.type}:${profile.selectors.join(',')}`;
    if (!repairProfiles.some((item) => `${item.type}:${item.selectors.join(',')}` === key)) repairProfiles.push(profile);
  }
  const signature = JSON.stringify(issues.map((issue) => ({
    code: issue.code,
    viewport: issue.viewport,
    selectors: (issue?.details?.overflowElements || []).map((el) => cleanSelector(el?.selector)).filter(Boolean).sort()
  })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));

  return {
    issues,
    failures: issues.map((issue) => ({ viewport: issue.viewport, message: issue.message, code: issue.code })),
    fixable: fixable && allProfilesSafe,
    repairProfiles,
    signature,
    culprit_count: culpritElements(issues).length
  };
}

function selectorRule(selectors, declarations) {
  const safe = [...new Set(selectors.map(cleanSelector).filter(Boolean))];
  if (!safe.length) return '';
  return `${safe.join(',\n')} {\n${declarations.map((line) => `  ${line}`).join('\n')}\n}`;
}

export function buildRepairCss(repairProfiles = []) {
  const blocks = [];
  for (const profile of repairProfiles) {
    if (profile.type === 'MEDIA_CONTAINMENT') {
      blocks.push('img, video, canvas, svg {\n  max-width: 100%;\n  height: auto;\n}');
    } else if (profile.type === 'TEXT_WRAP') {
      const rule = selectorRule(profile.selectors, ['min-width: 0;', 'max-width: 100%;', 'white-space: normal;', 'overflow-wrap: anywhere;']);
      if (rule) blocks.push(rule);
    } else if (profile.type === 'LAYOUT_CONTAINMENT') {
      const rule = selectorRule(profile.selectors, ['min-width: 0;', 'max-width: 100%;']);
      if (rule) blocks.push(rule);
    } else if (profile.type === 'VIEWPORT_CONTAINMENT') {
      blocks.push('html, body {\n  max-width: 100%;\n  overflow-x: clip;\n}');
    }
  }
  return [...new Set(blocks)].join('\n\n');
}
