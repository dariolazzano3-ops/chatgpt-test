import { evaluateVisualFidelity } from './visual-fidelity.js';
import { renderVisualDesignOverlay } from './visual-style.js';

const REPAIRABLE_PREFIXES = [
  'layout.container_width',
  'layout.hero_min_height',
  'spacing.section',
  'spacing.grid_gap',
  'colors.',
  'typography.body_family',
  'typography.heading_family',
  'radius.card',
  'radius.button',
  'shadows.card'
];

function isRepairable(path) {
  return REPAIRABLE_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix));
}

function setPath(target, path, value) {
  const parts = path.split('.');
  let cursor = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    if (!cursor[parts[i]] || typeof cursor[parts[i]] !== 'object') cursor[parts[i]] = {};
    cursor = cursor[parts[i]];
  }
  cursor[parts.at(-1)] = structuredClone(value);
}

function replaceOverlay(css, implementation) {
  const marker = '/* RIOSYSTEMS structured visual reconstruction overlay */';
  const base = String(css || '').includes(marker) ? String(css).split(marker)[0].trimEnd() : String(css || '').trimEnd();
  return `${base}\n${renderVisualDesignOverlay(implementation)}`;
}

export function runVisualRepairLoop(input = {}, reference = {}, options = {}) {
  const maxAttempts = Math.min(5, Math.max(0, Number(options.max_attempts ?? 3)));
  const artifact = { ...input.artifact, files: { ...(input.artifact?.files || {}) } };
  const implementation = structuredClone(input.implementation || {});
  const history = [];
  const cssFile = Object.keys(artifact.files).find((file) => file.endsWith('/assets/styles.css'));
  let report = evaluateVisualFidelity(reference, implementation, options);

  for (let attempt = 1; attempt <= maxAttempts && report.status !== 'PASS'; attempt += 1) {
    const repairable = report.blocking_differences.filter((difference) => difference.path && isRepairable(difference.path));
    if (!repairable.length) break;

    const applied = [];
    for (const difference of repairable) {
      setPath(implementation, difference.path, difference.expected);
      applied.push({ path: difference.path, from: difference.actual, to: difference.expected });
    }
    if (cssFile && applied.length) artifact.files[cssFile] = replaceOverlay(artifact.files[cssFile], implementation);

    history.push({ attempt, detected: repairable.map((item) => item.path), applied });
    report = evaluateVisualFidelity(reference, implementation, options);
  }

  return {
    schema: 'riosystems.visual-repair-result.v1',
    artifact,
    implementation,
    fidelity_report: report,
    repair_history: history,
    attempts: history.length,
    exhausted: report.status !== 'PASS' && history.length >= maxAttempts,
    fail_closed: report.status !== 'PASS'
  };
}
