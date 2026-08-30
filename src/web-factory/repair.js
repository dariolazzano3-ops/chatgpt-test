import { runWebsiteQa } from './qa.js';

function repairHtml(source, issue) {
  if (issue.code === 'VIEWPORT_MISSING') {
    return source.replace(/<meta charset="utf-8">/i, '<meta charset="utf-8">\n  <meta name="viewport" content="width=device-width,initial-scale=1">');
  }
  if (issue.code === 'STAGING_NOINDEX_MISSING') {
    return source.replace(/<meta name="viewport"[^>]*>/i, (match) => `${match}\n  <meta name="robots" content="noindex,nofollow">`);
  }
  if (issue.code === 'LANG_MISSING') return source.replace(/<html>/i, '<html lang="en">');
  return source;
}

export function runAutomaticRepairLoop(artifact, options = {}) {
  const maxAttempts = Math.min(5, Math.max(0, Number(options.max_attempts ?? 3)));
  const repaired = { ...artifact, files: { ...artifact.files } };
  const history = [];
  let qa = runWebsiteQa(repaired);

  for (let attempt = 1; attempt <= maxAttempts && qa.status !== 'PASS'; attempt += 1) {
    const repairable = qa.blocking_issues.filter((item) => ['VIEWPORT_MISSING', 'STAGING_NOINDEX_MISSING', 'LANG_MISSING'].includes(item.code) && item.file);
    if (!repairable.length) break;
    const applied = [];
    for (const item of repairable) {
      const before = repaired.files[item.file];
      const after = repairHtml(before, item);
      if (after !== before) {
        repaired.files[item.file] = after;
        applied.push({ code: item.code, file: item.file });
      }
    }
    history.push({ attempt, detected: repairable.map(({ code, file }) => ({ code, file })), applied });
    if (!applied.length) break;
    qa = runWebsiteQa(repaired);
  }

  return {
    artifact: repaired,
    qa_result: qa,
    repair_history: history,
    attempts: history.length,
    exhausted: qa.status !== 'PASS' && history.length >= maxAttempts,
    fail_closed: qa.status !== 'PASS'
  };
}
