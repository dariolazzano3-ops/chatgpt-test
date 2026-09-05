import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { applyProjectIntakeUxV2 } from '../src/operator-project-intake-ux-v2.js';

const scope = 'gelato-donatello:gelato-donatello-website-v1';
const base = '<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--line:#ddd;--muted:#666}.card{padding:16px}.source-cards{display:grid;gap:10px}.source-tools{display:flex;gap:8px;flex-wrap:wrap}.btn{min-height:40px}.field{display:grid;gap:6px}input,select,textarea,button{font:inherit;max-width:100%;box-sizing:border-box}</style></head><body><div class="card source-intake-v1" data-project-source-intake="true" data-scope="' + scope + '"><div class="eyebrow">PROJECT SOURCES</div><h2>Project Sources</h2><div class="source-upload-grid"></div><details class="details"><summary>Weitere Source Actions</summary></details><div data-source-status>Loading…</div><div class="source-cards" data-source-cards></div></div><script id="aurentara-project-source-storage-v1-ui"></script></body></html>';
const enhanced = await applyProjectIntakeUxV2(new Response(base, { headers: { 'content-type': 'text/html; charset=utf-8' } }));
const html = await enhanced.text();

const sources = [];
const facts = [];
let runtimeRevision = 1;
let uploadCalls = 0;
let failThirdOnce = true;

function payload() {
  return {
    ok: true,
    identity: { scope_key: scope, customer_id: 'gelato-donatello', project_id: 'gelato-donatello-website-v1' },
    runtime_revision: runtimeRevision,
    storage: {
      max_files_per_request: 12,
      max_total_bytes: 50 * 1024 * 1024,
      max_file_bytes: 20 * 1024 * 1024,
      max_image_bytes: 15 * 1024 * 1024,
      max_text_bytes: 2 * 1024 * 1024
    },
    workspace: {
      sections: {
        project_sources: structuredClone(sources),
        project_knowledge: structuredClone(facts),
        content_readiness: { status: 'READY_WITH_WARNINGS' }
      },
      knowledge_review: {
        status: sources.length ? 'CHANGES_PENDING' : 'NOT_STARTED',
        source_count: sources.length,
        conflict_count: 0
      }
    },
    project_scoped: true,
    production_deploy: false,
    external_writes: false,
    variable_cost_eur: 0
  };
}

function addImage(index, purpose) {
  const id = 'src-browser-image-' + index;
  if (sources.some((source) => source.source_id === id)) return;
  sources.push({
    source_id: id,
    source_type: 'IMAGE_VISUAL',
    display_name: ['menu-screenshot.jpg', 'gelato-product.jpg', 'flyer.jpg'][index - 1],
    mime_type: 'image/jpeg',
    ownership_status: 'CUSTOMER_ASSERTED',
    storage_ref: 'private://browser/' + id + '.jpg',
    image_purpose: purpose,
    ingestion_status: 'IMPORTED',
    knowledge_approved: false
  });
  runtimeRevision += 1;
}

function addNote(value) {
  const id = 'src-browser-note';
  const source = {
    source_id: id,
    source_type: 'MANUAL_INPUT',
    display_name: 'Manuelle Information',
    ownership_status: 'CUSTOMER_ASSERTED',
    source_metadata: { manual_text: value },
    ingestion_status: 'IMPORTED',
    knowledge_approved: false
  };
  const existing = sources.findIndex((item) => item.source_id === id);
  if (existing >= 0) sources[existing] = source;
  else sources.push(source);
  const fact = {
    fact_id: 'fact-browser-note',
    field_path: 'content.summary',
    value,
    verification_status: 'UNVERIFIED',
    source_refs: [id]
  };
  const f = facts.findIndex((item) => item.fact_id === fact.fact_id);
  if (f >= 0) facts[f] = fact;
  else facts.push(fact);
  runtimeRevision += 1;
}

const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

async function runDesktop() {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.route('https://intake-v2.test/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/operator') return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
    if (url.pathname.endsWith('/preview')) return route.fulfill({ status: 200, contentType: 'image/png', body: tinyPng });
    if (url.pathname.endsWith('/project-source-intake') && request.method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', body: JSON.stringify(payload()) });
    }
    if (url.pathname.endsWith('/upload') && request.method() === 'POST') {
      uploadCalls += 1;
      if (uploadCalls === 3 && failThirdOnce) {
        failThirdOnce = false;
        return route.fulfill({ status: 500, contentType: 'application/json; charset=utf-8', body: JSON.stringify({ error: 'PROJECT_SOURCE_STORAGE_REQUEST_FAILED' }) });
      }
      const index = uploadCalls <= 3 ? uploadCalls : 3;
      const purpose = index === 1 ? 'INFORMATION_EXTRACTION' : index === 2 ? 'VISUAL_USAGE' : 'BOTH';
      addImage(index, purpose);
      return route.fulfill({ status: 201, contentType: 'application/json; charset=utf-8', body: JSON.stringify({ ok: true, count: 1, runtime_revision: runtimeRevision }) });
    }
    if (url.pathname.endsWith('/manual') && request.method() === 'POST') {
      const body = request.postDataJSON();
      addNote(String(body?.facts?.[0]?.value || ''));
      return route.fulfill({ status: 201, contentType: 'application/json; charset=utf-8', body: JSON.stringify({ ok: true, runtime_revision: runtimeRevision }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', body: JSON.stringify({ ok: true }) });
  });

  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  await page.goto('https://intake-v2.test/operator', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-source-basket-v2]');

  const fileInput = page.locator('[data-v2-files]');
  await fileInput.setInputFiles([
    { name: 'menu-screenshot.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('image-one') },
    { name: 'gelato-product.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('image-two') },
    { name: 'flyer.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('image-three') }
  ]);

  const selected = page.locator('[data-v2-selection-card]');
  assert.equal(await selected.count(), 3);
  assert.equal(await page.locator('.source-selection-thumb').count(), 3);
  assert.match(await selected.nth(0).innerText(), /menu-screenshot\.jpg/);
  assert.match(await selected.nth(1).innerText(), /gelato-product\.jpg/);
  assert.match(await selected.nth(2).innerText(), /flyer\.jpg/);
  assert.equal(await selected.nth(0).locator('select').inputValue(), 'INFORMATION_EXTRACTION');
  assert.equal(await selected.nth(1).locator('select').inputValue(), 'VISUAL_USAGE');
  await selected.nth(2).locator('select').selectOption('BOTH');

  await page.locator('[data-v2-upload]').click();
  await page.waitForFunction(() => document.querySelector('[data-v2-progress-label]')?.textContent?.includes('2 von 3 hochgeladen'));
  assert.equal(uploadCalls, 3);
  assert.equal(await page.locator('[data-v2-progress-bar]').getAttribute('value'), '3');
  assert.equal(await page.locator('.source-selection-state[data-state="success"]').count(), 2);
  assert.equal(await page.locator('.source-selection-state[data-state="error"]').count(), 1);
  assert.match(await page.locator('[data-v2-upload]').innerText(), /erneut versuchen/i);

  await page.locator('[data-v2-upload]').click();
  await page.waitForFunction(() => document.querySelectorAll('[data-v2-source-card]').length === 3);
  assert.equal(uploadCalls, 4);
  assert.equal(await page.locator('[data-v2-source-card]').count(), 3);
  assert.equal(await page.locator('.source-card-v2-media').count(), 3);
  assert.equal(await page.getByRole('button', { name: /^Ansehen$/i }).count(), 0);
  assert.equal(await page.locator('[data-v2-purpose]').count(), 3);

  await page.locator('[data-v2-note]').fill('Eisbecher Fantasimo jetzt neu auf der Karte');
  await page.locator('[data-v2-note-save]').click();
  await page.waitForFunction(() => document.body.innerText.includes('Eisbecher Fantasimo jetzt neu auf der Karte'));
  assert.equal(await page.locator('[data-v2-source-card]').count(), 4);
  assert.match(await page.locator('[data-v2-source-card="src-browser-note"]').innerText(), /Manuelle Information/);

  assert.deepEqual(pageErrors, []);
  await browser.close();
}

async function runMobile() {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.route('https://intake-v2-mobile.test/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/operator') return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
    if (url.pathname.endsWith('/preview')) return route.fulfill({ status: 200, contentType: 'image/png', body: tinyPng });
    if (url.pathname.endsWith('/project-source-intake') && request.method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', body: JSON.stringify(payload()) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', body: JSON.stringify({ ok: true }) });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto('https://intake-v2-mobile.test/operator', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-source-basket-v2]');
  await page.waitForFunction(() => document.querySelectorAll('[data-v2-source-card]').length === 4);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);
  assert.equal(await page.locator('[data-v2-upload]').isVisible(), true);
  const uploadBox = await page.locator('[data-v2-upload]').boundingBox();
  assert.ok(uploadBox && uploadBox.height >= 40);
  assert.equal(await page.locator('.source-card-v2-media').count(), 3);
  assert.deepEqual(errors, []);
  await browser.close();
}

await runDesktop();
await runMobile();

console.log(JSON.stringify({
  ok: true,
  suite: 'project-ferrari-intelligent-project-intake-ux-v2-browser',
  selection_previews: 'PASS',
  per_file_progress: 'PASS',
  partial_failure: 'PASS',
  retry: 'PASS',
  direct_image_cards: 'PASS',
  manual_note: 'PASS',
  desktop: 'PASS',
  mobile_390x844: 'PASS',
  production_deploy: false,
  external_writes: false
}, null, 2));
