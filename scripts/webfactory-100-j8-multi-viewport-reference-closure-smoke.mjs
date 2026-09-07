import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import {
  createReferenceBrief,
  createSketchGenerationContract,
  createCandidateReferenceContract,
  approveReference,
  verifyApprovedReferenceLock
} from '../src/web-factory/reference-studio-v1.js';
import {
  runMultiViewportReferenceClosure,
  verifyMultiViewportReferenceSet,
  multiViewportReferenceClosureManifest,
  J8_VIEWPORT_ORDER,
  J8_VIEWPORT_REQUIREMENTS,
  J8_DEFAULT_MAX_CONVERGENCE_CYCLES,
  J8_HARD_MAX_CONVERGENCE_CYCLES
} from '../src/web-factory/multi-viewport-reference-closure-v1.js';
import { compareVisualImages, compareGeometrySnapshots } from '../src/visual-foundry/visual-comparator.js';
import { evaluateSemanticImplementation } from '../src/visual-foundry/semantic-gate.js';

const projectPath = 'projects/j8-multi-viewport-fixture';
const sizes = {
  '1440_DESKTOP': { width: 1440, height: 760, device_pixel_ratio: 1 },
  '1024_TABLET': { width: 1024, height: 760, device_pixel_ratio: 1 },
  '390_MOBILE': { width: 390, height: 700, device_pixel_ratio: 1 },
  '320_SMALL_MOBILE': { width: 320, height: 640, device_pixel_ratio: 1 }
};
const layoutMode = {
  '1440_DESKTOP': 'DESKTOP_THREE_COLUMN',
  '1024_TABLET': 'TABLET_TWO_COLUMN',
  '390_MOBILE': 'MOBILE_STACK',
  '320_SMALL_MOBILE': 'SMALL_MOBILE_COMPACT_STACK'
};

function viewportCss(id, exact) {
  const exactCss = {
    '1440_DESKTOP': 'main{padding:54px 72px}h1{font-size:64px}.grid{grid-template-columns:repeat(3,1fr);gap:24px}.card{height:190px}',
    '1024_TABLET': 'main{padding:46px 44px}h1{font-size:52px}.grid{grid-template-columns:repeat(2,1fr);gap:20px}.card{height:176px}.card:last-child{grid-column:1/-1}',
    '390_MOBILE': 'main{padding:28px 20px}h1{font-size:38px}.grid{grid-template-columns:1fr;gap:14px}.card{height:112px}',
    '320_SMALL_MOBILE': 'main{padding:22px 16px}h1{font-size:32px}.grid{grid-template-columns:1fr;gap:10px}.card{height:86px}'
  }[id];
  if (exact) return exactCss;
  return 'main{padding:24px 18px}h1{font-size:44px}.grid{grid-template-columns:repeat(2,1fr);gap:8px}.card{height:138px}.card:nth-child(2){transform:translateX(18px);background:#e35d3f!important}';
}

function html(id, exact) {
  const mode = exact ? layoutMode[id] : 'BLIND_DESKTOP_SCALE';
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
  *{box-sizing:border-box}html,body{margin:0;width:100%;min-height:100%;overflow-x:hidden;background:#f4efe5;color:#151515;font-family:Arial,sans-serif}
  main{min-height:100vh}h1{margin:0;line-height:.98;letter-spacing:-.045em}.eyebrow{font-size:13px;text-transform:uppercase;letter-spacing:.14em;margin-bottom:12px}.grid{display:grid;margin-top:34px}
  .card{border:2px solid #151515;border-radius:18px;box-shadow:0 8px 0 rgba(0,0,0,.12)}.card:nth-child(1){background:#20252a}.card:nth-child(2){background:#d5aa63}.card:nth-child(3){background:#c9d1c7}
  footer{height:42px;margin-top:28px;border-top:2px solid #151515;padding-top:12px;font-size:12px}
  ${viewportCss(id, exact)}
  </style></head><body data-layout="${mode}"><main><p class="eyebrow">J8 Multi-Viewport Closure</p><h1 data-visual-id="hero">Own reference. Own constraints.</h1><section class="grid" aria-label="Responsive reference fixture"><article class="card" data-visual-id="card-a" aria-label="Card A"></article><article class="card" data-visual-id="card-b" aria-label="Card B"></article><article class="card" data-visual-id="card-c" aria-label="Card C"></article></section><footer data-visual-id="footer">Protected region remains stable.</footer></main></body></html>`;
}

async function geometrySnapshot(page) {
  return page.evaluate(() => ({
    schema: 'riosystems.dom-geometry-snapshot.v1',
    components: [...document.querySelectorAll('[data-visual-id]')].map((el) => {
      const r = el.getBoundingClientRect();
      return {
        component_id: el.getAttribute('data-visual-id'),
        status: 'MEASURED',
        geometry: {
          x: Math.round(r.x * 1000) / 1000,
          y: Math.round(r.y * 1000) / 1000,
          width: Math.round(r.width * 1000) / 1000,
          height: Math.round(r.height * 1000) / 1000
        }
      };
    })
  }));
}

async function typographySnapshot(page) {
  return page.evaluate(() => {
    const s = getComputedStyle(document.querySelector('[data-visual-id="hero"]'));
    return {
      font_family: s.fontFamily,
      font_size: s.fontSize,
      line_height: s.lineHeight,
      font_weight: s.fontWeight,
      letter_spacing: s.letterSpacing
    };
  });
}

function typographyScore(reference, actual) {
  const keys = Object.keys(reference);
  return keys.filter((key) => String(reference[key]) === String(actual[key])).length / keys.length;
}

function bounds(snapshot, id) {
  const item = snapshot.components.find((component) => component.component_id === id);
  assert.ok(item, 'missing geometry ' + id);
  return item.geometry;
}

async function hashReferenceAsset({ reference_path }) {
  return { sha256: createHash('sha256').update(await readFile(reference_path)).digest('hex') };
}

function classificationFor(delta) {
  const metric = String(delta?.evidence?.metric || '').toLowerCase();
  let visual_type = 'background';
  if (delta.category === 'GEOMETRY') visual_type = ['x', 'y', 'left', 'top', 'right', 'bottom'].includes(metric) ? 'position' : ['width', 'height'].includes(metric) ? 'size' : 'spacing';
  else if (delta.category === 'COLOR') visual_type = 'color';
  else if (delta.category === 'TYPOGRAPHY') visual_type = 'typography';
  else if (delta.category === 'RESPONSIVE') visual_type = 'responsive';
  else if (delta.category === 'ASSET') visual_type = 'asset';
  return {
    delta_id: delta.delta_id,
    visual_type,
    root_cause: 'J8_VIEWPORT_SPECIFIC_' + visual_type.toUpperCase(),
    repair_target: projectPath + '/assets/responsive.css'
  };
}

assert.deepEqual(J8_VIEWPORT_ORDER, ['1440_DESKTOP', '1024_TABLET', '390_MOBILE', '320_SMALL_MOBILE']);
for (const id of J8_VIEWPORT_ORDER) assert.equal(J8_VIEWPORT_REQUIREMENTS[id].width, sizes[id].width);
assert.equal(J8_DEFAULT_MAX_CONVERGENCE_CYCLES, 3);
assert.ok(J8_HARD_MAX_CONVERGENCE_CYCLES <= 6);

const temp = await mkdtemp(path.join(os.tmpdir(), 'jaguar-j8-'));
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 760 }, deviceScaleFactor: 1 });
  const state = Object.fromEntries(J8_VIEWPORT_ORDER.map((id) => [id, false]));
  const references = {};
  const targets = [];

  for (let index = 0; index < J8_VIEWPORT_ORDER.length; index++) {
    const id = J8_VIEWPORT_ORDER[index];
    const viewport = sizes[id];
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.setContent(html(id, true), { waitUntil: 'load' });
    const referencePath = path.join(temp, id.toLowerCase() + '-reference.png');
    const referenceGeometry = await geometrySnapshot(page);
    const referenceTypography = await typographySnapshot(page);
    await page.screenshot({ path: referencePath, fullPage: false, animations: 'disabled' });
    const referenceHash = createHash('sha256').update(await readFile(referencePath)).digest('hex');

    const knowledge = {
      knowledge_id: 'j8-knowledge-v1',
      scope_key: 'customer:j8:multi-viewport-fixture',
      revision: '1',
      business_name: 'J8 Fixture',
      industry: 'local services',
      primary_goal: 'Multi-viewport reference closure',
      target_audience: 'Operator',
      required_sections: ['hero', 'cards'],
      facts: [{ key: 'business_name', value: 'J8 Fixture', status: 'CONFIRMED', source: 'operator' }]
    };
    const brief = createReferenceBrief({
      reference_id: 'j8-' + id.toLowerCase() + '-reference-v1',
      project_knowledge: knowledge,
      project_scope: knowledge.scope_key,
      knowledge_revision: '1',
      viewport: id,
      design_intent: { purpose: 'Independent ' + id + ' reference, never desktop scaling.' }
    }, { now: `2026-09-07T10:${20 + index}:00.000Z` });
    const sketch = createSketchGenerationContract(brief.reference, {
      layout_hypotheses: ['Viewport-specific ' + layoutMode[id]]
    }, { now: `2026-09-07T10:${24 + index}:00.000Z` });
    const candidate = createCandidateReferenceContract(sketch.reference, {
      render_asset_ref: 'reference://j8/' + id.toLowerCase() + '/reference-v1.png',
      render_asset_hash: referenceHash,
      mime_type: 'image/png',
      width: viewport.width,
      height: viewport.height,
      unresolved_items: []
    }, { now: `2026-09-07T10:${28 + index}:00.000Z` });
    const approved = approveReference(candidate.reference, {
      approved_by: 'operator-dario',
      approval_kind: 'HUMAN'
    }, { now: `2026-09-07T10:${32 + index}:00.000Z` });
    assert.equal(approved.ok, true);
    assert.equal(verifyApprovedReferenceLock(approved.reference).ok, true);

    const regions = [
      { region_id: 'hero', critical: true, ...bounds(referenceGeometry, 'hero') },
      { region_id: 'card-b', critical: true, ...bounds(referenceGeometry, 'card-b') },
      { region_id: 'footer', critical: true, ...bounds(referenceGeometry, 'footer') }
    ];
    references[id] = { typography: referenceTypography };
    targets.push({
      viewport_id: id,
      viewport,
      project_path: projectPath,
      reference: approved.reference,
      reference_path: referencePath,
      reference_asset_ref: 'reference://j8/' + id.toLowerCase() + '/reference-v1.png',
      reference_geometry: referenceGeometry,
      regions,
      locked_regions: ['footer'],
      constraints: {
        layout_mode: layoutMode[id],
        max_horizontal_overflow_px: 0,
        desktop_scaling_forbidden: true
      },
      max_repair_rounds: 2
    });
  }

  const verification = verifyMultiViewportReferenceSet({ targets });
  assert.equal(verification.status, 'PASS');
  assert.equal(verification.targets.length, 4);
  assert.equal(new Set(verification.targets.map((target) => target.reference_id)).size, 4);
  assert.equal(verification.blind_desktop_scaling_allowed, false);

  const missing = verifyMultiViewportReferenceSet({ targets: targets.slice(0, 3) });
  assert.equal(missing.status, 'BLOCK');
  assert.ok(missing.blocking_issues.some((issue) => issue.code === 'J8_REQUIRED_VIEWPORT_MISSING'));

  const reused = structuredClone(targets);
  reused[1].reference.reference_id = reused[0].reference.reference_id;
  const reusedCheck = verifyMultiViewportReferenceSet({ targets: reused });
  assert.equal(reusedCheck.status, 'BLOCK');
  assert.ok(reusedCheck.blocking_issues.some((issue) => issue.code === 'J8_REFERENCE_REUSE_FORBIDDEN'));

  let commitCounter = 0;
  const adapterFactory = {
    async for_viewport({ viewport_id }) {
      const viewport = sizes[viewport_id];
      return {
        hash_reference_asset: hashReferenceAsset,
        visual_foundry_compare: compareVisualImages,
        visual_foundry_compare_geometry: compareGeometrySnapshots,
        async capture({ iteration, commit_sha }) {
          await page.setViewportSize({ width: viewport.width, height: viewport.height });
          await page.setContent(html(viewport_id, state[viewport_id]), { waitUntil: 'load' });
          const actualPath = path.join(temp, `${viewport_id.toLowerCase()}-${commit_sha}-${iteration}.png`);
          await page.screenshot({ path: actualPath, fullPage: false, animations: 'disabled' });
          return {
            actual_path: actualPath,
            diff_path: path.join(temp, `${viewport_id.toLowerCase()}-${commit_sha}-${iteration}-diff.png`),
            page
          };
        },
        async geometry_snapshot() {
          return geometrySnapshot(page);
        },
        async typography_score() {
          return typographyScore(references[viewport_id].typography, await typographySnapshot(page));
        },
        async functional_regression() {
          const overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
          return {
            status: overflow === 0 ? 'PASS' : 'FAIL',
            responsive_status: overflow === 0 ? 'PASS' : 'FAIL',
            accessibility_status: 'PASS',
            evidence: { horizontal_overflow_px: overflow }
          };
        },
        async root_cause({ deltas }) {
          return { classifications: deltas.map(classificationFor) };
        },
        async repair({ iteration, plan }) {
          state[viewport_id] = true;
          return {
            changed_files: [projectPath + '/assets/responsive.css'],
            proposal_id: `${viewport_id}-repair-${iteration}`,
            phase: plan.phase,
            viewport_id
          };
        },
        async commit() {
          commitCounter += 1;
          return { commit_sha: 'j8-shared-commit-' + commitCounter };
        },
        async revert() {
          state[viewport_id] = false;
          return { status: 'REVERTED' };
        }
      };
    },
    async constraint_gate({ capture, constraints }) {
      const evidence = await capture.page.evaluate(() => ({
        layout_mode: document.body.getAttribute('data-layout'),
        overflow_px: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)
      }));
      const pass = evidence.layout_mode === constraints.layout_mode && evidence.overflow_px <= constraints.max_horizontal_overflow_px;
      return {
        schema: 'riosystems.j8-viewport-constraint-gate.v1',
        status: pass ? 'PASS' : 'FAIL',
        responsive_status: pass ? 'PASS' : 'FAIL',
        accessibility_status: 'PASS',
        expected_layout_mode: constraints.layout_mode,
        actual_layout_mode: evidence.layout_mode,
        horizontal_overflow_px: evidence.overflow_px,
        blind_desktop_scaling_detected: evidence.layout_mode === 'BLIND_DESKTOP_SCALE'
      };
    }
  };

  const result = await runMultiViewportReferenceClosure({
    initial_commit: 'j8-initial',
    targets,
    max_convergence_cycles: 3,
    max_repair_rounds: 2
  }, adapterFactory);

  assert.equal(result.status, 'PASS');
  assert.equal(result.convergence_cycles, 2);
  assert.equal(result.final_commit, 'j8-shared-commit-4');
  assert.equal(result.stable_same_commit, true);
  assert.equal(result.all_required_viewports_pass, true);
  assert.equal(result.independent_reference_per_viewport, true);
  assert.equal(result.blind_desktop_scaling_allowed, false);
  assert.equal(result.human_decision_required, false);
  assert.equal(result.history[0].status, 'REVALIDATION_REQUIRED');
  assert.equal(result.history[0].viewport_reports.filter((report) => report.iterations > 0).length, 4);
  assert.equal(result.history[1].status, 'STABLE_PASS');
  assert.ok(result.history[1].viewport_reports.every((report) => report.iterations === 0));
  assert.ok(result.viewport_reports.every((report) => report.final_commit === result.final_commit));
  assert.ok(result.viewport_reports.every((report) => report.reference.reference_id));
  assert.ok(result.viewport_reports.every((report) => report.locks));
  assert.ok(result.viewport_reports.every((report) => report.constraints.layout_mode));
  assert.ok(result.viewport_reports.every((report) => report.screenshot.actual_path));
  assert.ok(result.viewport_reports.every((report) => report.metrics.schema === 'riosystems.visual-measurement-report.v1'));
  assert.ok(result.viewport_reports.every((report) => Array.isArray(report.delta_report.deltas)));
  assert.ok(result.viewport_reports.every((report) => report.acceptance.visual.status === 'PASS'));
  assert.ok(result.viewport_reports.every((report) => report.acceptance.semantic.status === 'PASS'));
  assert.ok(result.viewport_reports.every((report) => report.acceptance.functional.status === 'PASS'));
  assert.ok(result.viewport_reports.every((report) => report.metrics.pixel_difference.percent === 0));
  assert.ok(result.viewport_reports.every((report) => report.metrics.perceptual.score === 1));

  const manifest = multiViewportReferenceClosureManifest();
  assert.deepEqual(manifest.required_viewports.map((item) => item.viewport_id), J8_VIEWPORT_ORDER);
  assert.deepEqual(manifest.per_viewport_evidence, ['REFERENCE', 'LOCKS', 'CONSTRAINTS', 'SCREENSHOT', 'METRICS', 'DELTA_REPORT', 'ACCEPTANCE']);
  assert.equal(manifest.independent_reference_per_viewport, true);
  assert.equal(manifest.independent_locks_per_viewport, true);
  assert.equal(manifest.independent_constraints_per_viewport, true);
  assert.equal(manifest.blind_desktop_scaling_allowed, false);
  assert.equal(manifest.shared_final_commit_required, true);
  assert.equal(manifest.stable_zero_repair_revalidation_required, true);
  assert.equal(manifest.visual_closure_engine, 'J7_FULL_VISUAL_CLOSURE_LOOP_V1');
  assert.equal(manifest.production_deploy, false);
  assert.equal(manifest.public_launch, false);
  assert.equal(manifest.dns_change, false);
  assert.equal(manifest.billing_activation, false);
  assert.equal(manifest.automatic_paid_activation, false);
  assert.equal(manifest.external_writes, false);

  console.log(JSON.stringify({
    ok: true,
    suite: 'webfactory-100-j8-multi-viewport-reference-closure',
    required_viewports: J8_VIEWPORT_ORDER,
    separate_approved_references: 'PASS',
    separate_locks: 'PASS',
    separate_constraints: 'PASS',
    real_browser_screenshots: 'PASS',
    visual_foundry_metrics: 'PASS',
    delta_reports: 'PASS',
    per_viewport_acceptance: 'PASS',
    blind_desktop_scaling_rejected: 'PASS',
    shared_final_commit: result.final_commit,
    stable_revalidation_cycle: result.convergence_cycles,
    final_pixel_difference_percent: result.viewport_reports.map((report) => [report.viewport_id, report.metrics.pixel_difference.percent]),
    final_ssim: result.viewport_reports.map((report) => [report.viewport_id, report.metrics.perceptual.score]),
    production_deploy: false,
    public_launch: false,
    external_writes: false
  }, null, 2));
} finally {
  if (browser) await browser.close().catch(() => {});
  await rm(temp, { recursive: true, force: true });
}
