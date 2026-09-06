import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

export const VISUAL_ACCEPTANCE_NOT_EVALUATED = 'VISUAL_ACCEPTANCE_NOT_EVALUATED';

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function parsePngDimensions(buffer) {
  const signature = '89504e470d0a1a0a';
  if (buffer.length < 24 || buffer.subarray(0, 8).toString('hex') !== signature) {
    throw new Error('REFERENCE_PNG_INVALID');
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function normalizeViewport(input = {}) {
  const width = Number(input.width || 1440);
  const height = Number(input.height || 1100);
  const deviceScaleFactor = Number(input.device_pixel_ratio || input.deviceScaleFactor || 1);
  if (!Number.isInteger(width) || width < 320 || width > 4096) throw new Error('VIEWPORT_WIDTH_INVALID');
  if (!Number.isInteger(height) || height < 320 || height > 4096) throw new Error('VIEWPORT_HEIGHT_INVALID');
  if (!Number.isFinite(deviceScaleFactor) || deviceScaleFactor < 1 || deviceScaleFactor > 4) throw new Error('DEVICE_PIXEL_RATIO_INVALID');
  return { width, height, deviceScaleFactor };
}

export async function captureRuntimeScreenshot(input = {}) {
  const url = String(input.url || '');
  if (!/^https?:\/\//i.test(url)) throw new Error('RUNTIME_URL_INVALID');

  const viewport = normalizeViewport(input.viewport);
  const browser = await chromium.launch({ headless: true });
  try {
    const browserVersion = browser.version();
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.deviceScaleFactor,
      locale: input.locale || 'en-US',
      timezoneId: input.timezone || 'UTC',
      reducedMotion: 'reduce'
    });
    const page = await context.newPage();
    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: Number(input.timeout_ms || 60000) });
    if (!response || response.status() < 200 || response.status() >= 400) {
      throw new Error(`RUNTIME_RENDER_HTTP_${response?.status() || 0}`);
    }
    await page.addStyleTag({ content: `
      *, *::before, *::after {
        animation-delay: 0s !important;
        animation-duration: 0s !important;
        transition-delay: 0s !important;
        transition-duration: 0s !important;
        caret-color: transparent !important;
      }
    ` });
    await page.evaluate(() => document.fonts?.ready);
    await page.screenshot({ path: input.output_path, fullPage: input.full_page !== false });
    await context.close();
    return { browser: 'chromium', browser_version: browserVersion, viewport };
  } finally {
    await browser.close();
  }
}

export async function buildWave0EvidencePack(input = {}) {
  const referencePath = path.resolve(String(input.reference_path || ''));
  const runtimePath = path.resolve(String(input.runtime_screenshot_path || ''));
  const reference = await fs.readFile(referencePath).catch(() => null);
  if (!reference) throw new Error('APPROVED_REFERENCE_MISSING');
  const runtime = await fs.readFile(runtimePath).catch(() => null);
  if (!runtime) throw new Error('RUNTIME_SCREENSHOT_MISSING');

  const referenceDimensions = parsePngDimensions(reference);
  const runtimeDimensions = parsePngDimensions(runtime);
  const referenceHash = sha256(reference);
  const runtimeHash = sha256(runtime);
  const dimensionsEqual = referenceDimensions.width === runtimeDimensions.width && referenceDimensions.height === runtimeDimensions.height;
  const binaryIdentical = dimensionsEqual && referenceHash === runtimeHash;

  const comparison = {
    schema: 'riosystems.visual-foundry.wave0-comparison.v1',
    status: binaryIdentical ? 'EXACT_BINARY_MATCH' : 'REFERENCE_DIFFERENCE_DETECTED',
    dimensions_equal: dimensionsEqual,
    reference_dimensions: referenceDimensions,
    runtime_dimensions: runtimeDimensions,
    reference_hash: referenceHash,
    runtime_hash: runtimeHash,
    exact_binary_match: binaryIdentical,
    objective_pixel_similarity_measured: false,
    perceptual_similarity_measured: false,
    geometry_similarity_measured: false,
    visual_acceptance: VISUAL_ACCEPTANCE_NOT_EVALUATED,
    reason: 'Wave 0 proves the reproducible reference-to-render evidence path. Full visual acceptance remains disabled until the deterministic comparator is implemented.'
  };

  return {
    schema: 'riosystems.visual-foundry.evidence-pack.v1',
    wave: 0,
    generated_at: new Date().toISOString(),
    project_id: String(input.project_id || ''),
    reference: {
      reference_id: String(input.reference_id || ''),
      version: String(input.reference_version || ''),
      status: String(input.reference_status || 'APPROVED'),
      source_path: referencePath,
      hash: referenceHash,
      dimensions: referenceDimensions
    },
    implementation: {
      commit_sha: String(input.commit_sha || ''),
      runtime_url: String(input.runtime_url || ''),
      screenshot_path: runtimePath,
      screenshot_hash: runtimeHash,
      dimensions: runtimeDimensions
    },
    render_environment: input.render_environment || null,
    comparison,
    functional_acceptance: 'NOT_PART_OF_WAVE_0',
    visual_acceptance: VISUAL_ACCEPTANCE_NOT_EVALUATED,
    responsive_acceptance: 'NOT_PART_OF_WAVE_0',
    human_visual_approval: 'NOT_REQUESTED',
    production_deploy: false,
    external_writes: false,
    fake_success_prevented: true
  };
}

export async function runWave0Baseline(input = {}) {
  const outDir = path.resolve(input.output_dir || 'artifacts/visual-foundry/wave0');
  await fs.mkdir(outDir, { recursive: true });
  const runtimePath = path.join(outDir, 'runtime.png');
  const renderEnvironment = await captureRuntimeScreenshot({
    url: input.runtime_url,
    output_path: runtimePath,
    viewport: input.viewport,
    locale: input.locale,
    timezone: input.timezone,
    timeout_ms: input.timeout_ms,
    full_page: input.full_page
  });
  const evidence = await buildWave0EvidencePack({
    ...input,
    runtime_screenshot_path: runtimePath,
    render_environment: renderEnvironment
  });
  await fs.writeFile(path.join(outDir, 'comparison.json'), JSON.stringify(evidence.comparison, null, 2));
  await fs.writeFile(path.join(outDir, 'evidence-pack.json'), JSON.stringify(evidence, null, 2));
  return evidence;
}
