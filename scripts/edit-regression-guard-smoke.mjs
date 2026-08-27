import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const qaSource = await fs.readFile(new URL('./qa-repair-loop.mjs', import.meta.url), 'utf8');

for (const marker of [
  'regression_rio_assistant',
  'regression_factory_status',
  'regression_preview',
  'regression_workshop',
  "status: 'WORKSHOP_REQUIRED'"
]) {
  assert.ok(qaSource.includes(marker), `qa-repair-loop missing guard marker: ${marker}`);
}

function explicitRemovalRequested(prompt, aliases) {
  const destructive = /\b(entfern(?:e|en|t)|lösch(?:e|en|t)|remove|delete|abschaff(?:en|e)|deaktivier(?:en|e))\b/i.test(prompt);
  return destructive && aliases.some((alias) => prompt.toLowerCase().includes(alias.toLowerCase()));
}

function criticalEditFeatureChecks(request, baselineFiles, candidateFiles) {
  if (String(request.mode || '').toLowerCase() !== 'edit') return [];

  const baselineHtml = baselineFiles['index.html'] || '';
  const baselineWorker = baselineFiles['_worker.js'] || '';
  const html = candidateFiles['index.html'] || '';
  const worker = candidateFiles['_worker.js'] || '';
  const prompt = String(request.prompt || '');

  const features = [
    {
      id: 'regression_rio_assistant',
      aliases: ['rio', 'assistant', 'chat'],
      baselinePresent: /id=["']assistant-form["']/.test(baselineHtml) && /\/api\/rio\/chat/.test(baselineWorker),
      candidatePresent: /id=["']assistant-form["']/.test(html) && /\/api\/rio\/chat/.test(worker)
    },
    {
      id: 'regression_factory_status',
      aliases: ['status', 'aktueller status'],
      baselinePresent: /class=["'][^"']*status-panel/.test(baselineHtml) && /\/api\/factory\/status/.test(baselineWorker),
      candidatePresent: /class=["'][^"']*status-panel/.test(html) && /\/api\/factory\/status/.test(worker)
    },
    {
      id: 'regression_preview',
      aliases: ['preview', 'vorschau'],
      baselinePresent: /class=["'][^"']*preview-panel/.test(baselineHtml) && /id=["']preview-link["']/.test(baselineHtml),
      candidatePresent: /class=["'][^"']*preview-panel/.test(html) && /id=["']preview-link["']/.test(html)
    },
    {
      id: 'regression_workshop',
      aliases: ['werkstatt', 'workshop'],
      baselinePresent: /id=["']workshop-panel["']/.test(baselineHtml) || /id=["']step-workshop["']/.test(baselineHtml),
      candidatePresent: /id=["']workshop-panel["']/.test(html) || /id=["']step-workshop["']/.test(html)
    }
  ];

  return features
    .filter((feature) => feature.baselinePresent && !explicitRemovalRequested(prompt, feature.aliases))
    .map((feature) => ({ id: feature.id, ok: feature.candidatePresent }));
}

const baseline = {
  'index.html': `
    <section class="assistant-panel"><form id="assistant-form"></form></section>
    <article class="status-panel"></article>
    <article id="workshop-panel"><div id="step-workshop"></div></article>
    <article class="preview-panel"><a id="preview-link"></a></article>`,
  '_worker.js': `if (url.pathname==='/api/rio/chat'){} if (url.pathname==='/api/factory/status'){}`
};

const healthyCandidate = structuredClone(baseline);
const rioMissingCandidate = {
  ...baseline,
  'index.html': baseline['index.html'].replace('<form id="assistant-form"></form>', ''),
  '_worker.js': baseline['_worker.js'].replace("if (url.pathname==='/api/rio/chat'){}", '')
};

const normalEdit = criticalEditFeatureChecks({ mode: 'edit', prompt: 'Optimiere die mobile Navigation.' }, baseline, rioMissingCandidate);
assert.equal(normalEdit.find((check) => check.id === 'regression_rio_assistant')?.ok, false, 'missing RIO must be blocked on normal EDIT');
assert.equal(normalEdit.filter((check) => !check.ok).length, 1, 'only the removed RIO feature should fail in this fixture');

const healthyEdit = criticalEditFeatureChecks({ mode: 'edit', prompt: 'Optimiere die mobile Navigation.' }, baseline, healthyCandidate);
assert.ok(healthyEdit.every((check) => check.ok), 'healthy EDIT must preserve all protected features');

const explicitRemoval = criticalEditFeatureChecks({ mode: 'edit', prompt: 'Entferne den RIO Chat vollständig.' }, baseline, rioMissingCandidate);
assert.ok(!explicitRemoval.some((check) => check.id === 'regression_rio_assistant'), 'explicit RIO removal must not be treated as accidental regression');

const evolve = criticalEditFeatureChecks({ mode: 'evolve', prompt: 'Neue Struktur.' }, baseline, rioMissingCandidate);
assert.equal(evolve.length, 0, 'regression guard is scoped to EDIT mode');

console.log(JSON.stringify({
  ok: true,
  guard: 'critical-edit-feature-regression',
  cases: {
    accidental_rio_removal: 'blocked',
    healthy_edit: 'passed',
    explicit_rio_removal: 'allowed',
    evolve_mode: 'not_scoped'
  }
}, null, 2));
