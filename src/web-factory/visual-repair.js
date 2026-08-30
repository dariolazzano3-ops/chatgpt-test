import { evaluateVisualFidelity } from './visual-fidelity.js';
import { renderVisualDesignOverlay } from './visual-style.js';

const REPAIRABLE_PREFIXES = [
  'layout.container_width',
  'layout.hero_min_height',
  'layout.grid_columns',
  'layout.navigation_behavior',
  'layout.section_alignment',
  'spacing.section',
  'spacing.grid_gap',
  'colors.',
  'typography.body_family',
  'typography.heading_family',
  'typography.heading_scale',
  'radius.card',
  'radius.button',
  'shadows.card',
  'components.',
  'pages.',
  'responsive'
];

function isRepairable(path) {
  return REPAIRABLE_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix));
}

function setSimplePath(target, path, value) {
  const parts = path.split('.');
  let cursor = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    if (!cursor[parts[i]] || typeof cursor[parts[i]] !== 'object') cursor[parts[i]] = {};
    cursor = cursor[parts[i]];
  }
  cursor[parts.at(-1)] = structuredClone(value);
}

function setImplementationPath(implementation, path, value) {
  if (path === 'responsive') {
    implementation.responsive = structuredClone(value);
    return;
  }
  const component = path.match(/^components\.([^\.]+)\.geometry$/);
  if (component) {
    const item = (implementation.components || []).find((entry) => String(entry.component) === component[1]);
    if (item) item.geometry = structuredClone(value);
    return;
  }
  const page = path.match(/^pages\.([^\.]+)\.section_order$/);
  if (page) {
    const item = (implementation.pages || []).find((entry) => String(entry.id) === page[1]);
    if (item) item.section_order = structuredClone(value);
    return;
  }
  setSimplePath(implementation, path, value);
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

    const beforeState = structuredClone(implementation);
    const applied = [];
    for (const difference of repairable) {
      setImplementationPath(implementation, difference.path, difference.expected);
      applied.push({ path: difference.path, from: difference.actual, to: difference.expected });
    }
    if (cssFile && applied.length) artifact.files[cssFile] = replaceOverlay(artifact.files[cssFile], implementation);
    const afterState = structuredClone(implementation);

    history.push({
      attempt,
      detected: repairable.map((item) => item.path),
      applied,
      before_state: beforeState,
      after_state: afterState,
      deterministic: true
    });
    report = evaluateVisualFidelity(reference, implementation, options);
  }

  return {
    schema: 'riosystems.visual-repair-result.v1',
    artifact,
    implementation,
    fidelity_report: report,
    repair_history: history,
    attempts: history.length,
    max_attempts: maxAttempts,
    exhausted: report.status !== 'PASS' && history.length >= maxAttempts,
    fail_closed: report.status !== 'PASS'
  };
}
