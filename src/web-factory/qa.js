function issue(category, code, message, severity = 'blocking', file = null) {
  return { category, code, message, severity, file };
}

const htmlFiles = (artifact) => Object.entries(artifact.files || {}).filter(([name]) => name.endsWith('.html'));
const cssText = (artifact) => Object.entries(artifact.files || {}).find(([name]) => name.endsWith('/assets/styles.css'))?.[1] || '';

function countMatches(value, regex) {
  return [...String(value).matchAll(regex)].length;
}

function headingLevels(html) {
  return [...html.matchAll(/<h([1-6])\b/gi)].map((match) => Number(match[1]));
}

function labelsCoverInputs(html) {
  const ids = [...html.matchAll(/<(?:input|textarea|select)\b[^>]*\bid="([^"]+)"[^>]*>/gi)].map((m) => m[1]);
  const fors = new Set([...html.matchAll(/<label\b[^>]*\bfor="([^"]+)"[^>]*>/gi)].map((m) => m[1]));
  return ids.filter((id) => !fors.has(id));
}

function imgAltProblems(html) {
  return [...html.matchAll(/<img\b[^>]*>/gi)].filter((match) => !/\balt="[^"]*"/i.test(match[0])).length;
}

function unsafeInlineScripts(html) {
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter((match) => {
    const attrs = match[1] || '';
    const body = (match[2] || '').trim();
    if (/\bsrc=/i.test(attrs)) return false;
    if (/type="application\/ld\+json"/i.test(attrs)) return false;
    return body.length > 0;
  });
}

function externalExecutableResources(html) {
  const candidates = [...html.matchAll(/<(script|img|iframe|link)\b[^>]*(?:src|href)="(https?:\/\/[^\"]+)"[^>]*>/gi)];
  return candidates.filter((match) => {
    if (match[1].toLowerCase() === 'link' && /rel="canonical"/i.test(match[0])) return false;
    return true;
  });
}

function secretPatterns(text) {
  const patterns = [
    /\bAKIA[0-9A-Z]{16}\b/,
    /\bsk-[A-Za-z0-9_-]{20,}\b/,
    /(?:api[_-]?key|secret|password|token)\s*[:=]\s*["'][^"']{8,}["']/i,
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/
  ];
  return patterns.filter((regex) => regex.test(text));
}

function contrastRatio(hexA, hexB) {
  const parse = (hex) => {
    const clean = String(hex).replace('#', '');
    if (!/^[0-9a-f]{6}$/i.test(clean)) return null;
    const rgb = [0, 2, 4].map((i) => parseInt(clean.slice(i, i + 2), 16) / 255);
    return rgb.map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  };
  const a = parse(hexA); const b = parse(hexB);
  if (!a || !b) return null;
  const lum = (rgb) => 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

export function runWebsiteQa(artifact) {
  const issues = [];
  const warn = (category, code, message, file = null) => issues.push(issue(category, code, message, 'warning', file));
  const block = (category, code, message, file = null) => issues.push(issue(category, code, message, 'blocking', file));
  const files = artifact.files || {};
  const html = htmlFiles(artifact);

  if (html.length < 5) block('structure', 'MULTI_PAGE_REQUIRED', `Expected at least 5 HTML pages, received ${html.length}`);
  for (const [file, source] of html) {
    if (!/^<!doctype html>/i.test(source.trim())) block('structure', 'DOCTYPE_MISSING', 'HTML doctype is required', file);
    if (!/<html\b[^>]*\blang="[^"]+"/i.test(source)) block('accessibility', 'LANG_MISSING', 'html lang attribute is required', file);
    if (!/<header\b/i.test(source) || !/<main\b/i.test(source) || !/<footer\b/i.test(source)) block('structure', 'LANDMARK_MISSING', 'header, main and footer landmarks are required', file);
    const h1s = countMatches(source, /<h1\b/gi);
    if (h1s !== 1) block('accessibility', 'H1_COUNT_INVALID', `Expected exactly one h1, received ${h1s}`, file);
    const levels = headingLevels(source);
    for (let i = 1; i < levels.length; i += 1) if (levels[i] - levels[i - 1] > 1) warn('accessibility', 'HEADING_LEVEL_JUMP', `Heading level jumps from h${levels[i - 1]} to h${levels[i]}`, file);
    if (!/<meta\b[^>]*name="viewport"/i.test(source)) block('responsive', 'VIEWPORT_MISSING', 'Viewport meta is required', file);
    if (!/<meta\b[^>]*name="robots"[^>]*content="noindex,nofollow"/i.test(source)) block('seo', 'STAGING_NOINDEX_MISSING', 'Staging pages must be noindex,nofollow', file);
    if (!/<title>[^<]{4,}<\/title>/i.test(source)) block('seo', 'TITLE_MISSING', 'A page title is required', file);
    const description = source.match(/<meta\b[^>]*name="description"[^>]*content="([^"]+)"/i)?.[1] || '';
    if (description.length < 40) warn('seo', 'META_DESCRIPTION_SHORT', 'Meta description should be at least 40 characters', file);
    if (!/<meta\b[^>]*property="og:title"/i.test(source) || !/<meta\b[^>]*property="og:description"/i.test(source)) block('seo', 'OPEN_GRAPH_BASELINE_MISSING', 'OpenGraph title and description are required', file);
    const unlabeled = labelsCoverInputs(source);
    if (unlabeled.length) block('accessibility', 'FORM_LABEL_MISSING', `Missing labels for: ${unlabeled.join(', ')}`, file);
    if (imgAltProblems(source)) block('accessibility', 'IMAGE_ALT_MISSING', 'Every image requires an alt attribute', file);
    if (unsafeInlineScripts(source).length) block('security', 'UNSAFE_INLINE_SCRIPT', 'Executable inline scripts are forbidden', file);
    if (externalExecutableResources(source).length) block('security', 'UNAPPROVED_EXTERNAL_RESOURCE', 'External executable/media resources are forbidden by default', file);
    if (secretPatterns(source).length) block('security', 'SECRET_PATTERN_DETECTED', 'Possible secret detected in generated HTML', file);
    if (/<a\b[^>]*href="#"/i.test(source)) warn('content', 'PLACEHOLDER_LINK', 'Placeholder links should be resolved before production', file);
    const currentLink = source.match(/<a\b[^>]*href="([^"]+)"[^>]*aria-current="page"[^>]*>/i);
    if (currentLink && currentLink[1] !== './') block('structure', 'ARIA_CURRENT_LINK_INVALID', `Current navigation link must resolve to the current page, received ${currentLink[1]}`, file);
  }

  const css = cssText(artifact);
  if (!/@media\(max-width:/i.test(css)) block('responsive', 'BREAKPOINT_RULES_MISSING', 'Responsive breakpoint rules are required');
  if (!/max-width:100%/i.test(css)) block('responsive', 'MEDIA_MAX_WIDTH_MISSING', 'Responsive media max-width baseline is required');
  if (!/min-height:var\(--target\)/i.test(css)) block('responsive', 'CONTROL_TARGET_BASELINE_MISSING', 'Interactive controls need a deterministic minimum target size');
  if (/(?:^|[;{])\s*width:\s*[1-9]\d{3,}px/i.test(css)) block('responsive', 'FIXED_WIDE_LAYOUT', 'Large fixed widths can cause overflow');

  const colors = artifact.design_system?.tokens?.colors || {};
  const textContrast = contrastRatio(colors.text, colors.background);
  const accentContrast = contrastRatio(colors.accent_text, colors.accent);
  if (textContrast !== null && textContrast < 4.5) block('accessibility', 'TEXT_CONTRAST_LOW', `Text/background contrast ${textContrast.toFixed(2)} is below 4.5`);
  if (accentContrast !== null && accentContrast < 4.5) block('accessibility', 'ACCENT_CONTRAST_LOW', `Accent control contrast ${accentContrast.toFixed(2)} is below 4.5`);

  const allText = Object.values(files).join('\n');
  if (secretPatterns(allText).length) block('security', 'SECRET_PATTERN_DETECTED_GLOBAL', 'Possible secret detected in generated artifact');
  if (!files[`${artifact.project_root}/robots.txt`]?.includes('Disallow: /')) block('seo', 'ROBOTS_STAGING_BLOCK_MISSING', 'Staging robots.txt must disallow crawling');
  if (!files[`${artifact.project_root}/sitemap.xml`]) block('seo', 'SITEMAP_MISSING', 'Sitemap capability artifact is required');
  if (!files[`${artifact.project_root}/_headers`]) block('security', 'SECURITY_HEADERS_MISSING', 'Cloudflare Pages security headers are required');

  if (artifact.environment !== 'staging') block('deployment', 'STAGING_ENVIRONMENT_REQUIRED', 'Web Factory V1 is staging-only');
  if (artifact.production_deploy !== false) block('deployment', 'PRODUCTION_FORBIDDEN', 'Production deployment must remain disabled');
  if (artifact.real_customer_data !== false) block('security', 'REAL_CUSTOMER_DATA_FORBIDDEN', 'Real customer data is forbidden in this build path');
  if (Number(artifact.variable_cost_eur) !== 0) block('deployment', 'VARIABLE_COST_NOT_ZERO', 'Deterministic V1 build must have 0 EUR variable cost');
  if (artifact.paid_fallback_allowed !== false) block('deployment', 'PAID_FALLBACK_FORBIDDEN', 'Automatic paid fallback must be disabled');
  if (!String(artifact.project_root || '').startsWith('projects/') || String(artifact.project_root).includes('..')) block('structure', 'PROJECT_ISOLATION_INVALID', 'Project root must be an isolated projects/<slug> path');
  for (const file of Object.keys(files)) if (!file.startsWith(`${artifact.project_root}/`)) block('structure', 'PROJECT_FILE_ESCAPE', `File escaped project boundary: ${file}`, file);

  const blockingIssues = issues.filter((item) => item.severity === 'blocking');
  const warnings = issues.filter((item) => item.severity === 'warning');
  const categoryNames = ['structure', 'content', 'responsive', 'seo', 'accessibility', 'security', 'deployment'];
  const categories = Object.fromEntries(categoryNames.map((category) => {
    const categoryIssues = issues.filter((item) => item.category === category);
    return [category, {
      status: categoryIssues.some((item) => item.severity === 'blocking') ? 'FAIL' : 'PASS',
      blocking_issues: categoryIssues.filter((item) => item.severity === 'blocking').length,
      warnings: categoryIssues.filter((item) => item.severity === 'warning').length
    }];
  }));
  const score = Math.max(0, 100 - blockingIssues.length * 12 - warnings.length * 2);
  return {
    schema: 'riosystems.web-qa.v1',
    status: blockingIssues.length ? 'FAIL' : 'PASS',
    score,
    blocking_issues: blockingIssues,
    warnings,
    categories
  };
}
