import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createOperatorRuntime } from '../src/operator-runtime-v1.js';
import { createMemoryOperatorRuntimeStore } from '../src/operator-runtime-store-v1.js';
import { createOperatorRuntimeApiService } from '../src/operator-runtime-api-v1.js';
import { withProjectSourceIntakeRuntimeService } from '../src/operator-project-source-intake-runtime-v1.js';
import { handleOperatorDashboard } from '../src/operator-project-source-intake-storage-dashboard-v1.js';
import { applyProjectSourceHumanAcceptanceUi } from '../src/operator-project-source-intake-human-acceptance-ui-v1.js';

const operatorId = 'operator:source-browser@example.test';
const project = {
  customer_id: 'gelato-donatello',
  project_id: 'gelato-donatello-website-v1',
  scope_key: 'gelato-donatello:gelato-donatello-website-v1',
  name: 'Gelato Donatello',
  industry: 'gelateria',
  country: 'DE',
  language: 'de',
  state: 'ACTIVE',
  blocked: false,
  production_deploy: false
};

const created = createOperatorRuntime({
  operator_id: operatorId,
  portfolio: { operator_id: operatorId, projects: [project], production_deploy: false }
});
assert.equal(created.ok, true);
const store = createMemoryOperatorRuntimeStore([created.runtime]);
const core = createOperatorRuntimeApiService({ operator_id: operatorId, store });
const service = withProjectSourceIntakeRuntimeService({ service: core, store, operator_id: operatorId });
const authorize = async () => ({ ok: true, status: 200, operator_id: operatorId, email: 'source-browser@example.test' });

const shellResponse = await handleOperatorDashboard(
  new Request('https://operator.example.test/operator'),
  {},
  {},
  { runtime_service: service, authorize }
);
assert.equal(shellResponse.status, 200);
const enhancedResponse = await applyProjectSourceHumanAcceptanceUi(shellResponse);
const fullHtml = await enhancedResponse.text();

function extractTag(id, tag) {
  const pattern = new RegExp('<' + tag + '[^>]*id="' + id + '"[^>]*>[\\s\\S]*?<\\/' + tag + '>');
  const match = fullHtml.match(pattern);
  assert.ok(match, 'missing generated ' + tag + '#' + id);
  return match[0];
}

const storageStyle = extractTag('aurentara-project-source-storage-v1-style', 'style');
const storageScript = extractTag('aurentara-project-source-storage-v1-ui', 'script');
const humanStyle = extractTag('aurentara-project-source-human-acceptance-ui-v1-style', 'style');
const humanScript = extractTag('aurentara-project-source-human-acceptance-ui-v1', 'script');

const pageHtml = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
:root{--line:#ddd;--muted:#666}.card{padding:16px}.btn{min-height:40px}.field{display:grid;gap:6px}.details{margin-top:12px}.source-tools{display:flex;gap:8px;flex-wrap:wrap}
</style>
${storageStyle}
${humanStyle}
</head>
<body>
<div id="project-detail"></div>
<script>
window.esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
window.setError=e=>{window.__sourceError=String(e?.message||e||'')};
window.renderProjectDetail=function(){};
window.open=(url)=>{window.__lastOpened=String(url);return null};
</script>
${storageScript}
${humanScript}
<script>window.renderProjectDetail({project:{scope_key:${JSON.stringify(project.scope_key)}}});</script>
</body>
</html>`;

const payload = {
  identity: {
    operator_id: operatorId,
    customer_id: project.customer_id,
    project_id: project.project_id,
    scope_key: project.scope_key
  },
  workspace: {
    sections: {
      project_sources: [
        {
          source_id: 'image-source',
          source_type: 'IMAGE_VISUAL',
          display_name: 'Gelato Hero',
          mime_type: 'image/png',
          storage_ref: 'supabase://project-source-intake-private/fake/image.png',
          ownership_status: 'OWNED_CONFIRMED',
          rights_status: 'OWNED_CONFIRMED'
        },
        {
          source_id: 'html-source',
          source_type: 'FILE_DOCUMENT',
          display_name: 'Unsichere HTML-Datei',
          mime_type: 'text/html',
          storage_ref: 'supabase://project-source-intake-private/fake/page.html',
          ownership_status: 'CUSTOMER_ASSERTED',
          rights_status: 'CUSTOMER_ASSERTED'
        }
      ],
      content_readiness: { status: 'READY_WITH_WARNINGS' },
      project_knowledge: []
    }
  }
};

async function runViewport(name, viewport) {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext({ viewport });
  await context.route('https://source.test/operator', route => route.fulfill({
    status: 200,
    contentType: 'text/html; charset=utf-8',
    body: pageHtml
  }));
  await context.route('https://source.test/operator/api/project-source-intake**', route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(payload)
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify({ ok: true })
    });
  });

  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));
  await page.goto('https://source.test/operator', { waitUntil: 'domcontentloaded' });

  await page.waitForSelector('[data-polished-source-card]');
  assert.equal(await page.locator('[data-polished-source-card]').count(), 2, name);

  const imageCard = page.locator('[data-polished-source-card][data-source-id="image-source"]');
  assert.equal(await imageCard.getByRole('button', { name: 'Ansehen' }).isVisible(), true);
  assert.equal(await imageCard.getByRole('button', { name: 'Herunterladen' }).isVisible(), true);
  assert.match(await imageCard.innerText(), /🔒 Privat gespeichert/);

  await imageCard.getByRole('button', { name: 'Ansehen' }).click();
  let opened = await page.evaluate(() => window.__lastOpened || '');
  assert.match(opened, /\/operator\/api\/project-source-intake\/preview\?/);
  assert.match(opened, /scope_key=/);

  await page.evaluate(() => { window.__lastOpened = ''; });
  await imageCard.getByRole('button', { name: 'Herunterladen' }).click();
  opened = await page.evaluate(() => window.__lastOpened || '');
  assert.match(opened, /\/operator\/api\/project-source-intake\/object\?/);
  assert.doesNotMatch(opened, /\/preview\?/);

  const htmlCard = page.locator('[data-polished-source-card][data-source-id="html-source"]');
  await page.evaluate(() => { window.__lastOpened = ''; });
  await htmlCard.getByRole('button', { name: 'Ansehen' }).click();
  assert.equal(await page.evaluate(() => window.__lastOpened || ''), '');
  assert.match(await page.locator('[data-source-local-status]').innerText(), /keine sichere Vorschau verfügbar/i);

  const category = page.locator('[data-source-manual-category]');
  assert.equal(await category.isVisible(), true);
  const labels = await category.locator('option').allInnerTexts();
  for (const label of ['Leistung / Angebot','Produkt','Preis','Öffnungszeiten','Telefon','E-Mail','Adresse','Beschreibung','Sonstige Information']) {
    assert.ok(labels.includes(label), name + ' missing category ' + label);
  }
  await category.selectOption('PRICE');
  assert.match(await page.locator('[data-source-manual-technical]').innerText(), /business\.pricing/);
  assert.equal(await page.locator('[data-source-field]').count(), 0, 'technical field_path must not be primary input');

  const sourceRoot = page.locator('[data-project-source-intake]');
  assert.equal(await sourceRoot.isVisible(), true);
  const box = await sourceRoot.boundingBox();
  assert.ok(box && box.width <= viewport.width + 1, name + ' source UI must fit viewport');
  assert.equal((await page.locator('body').innerText()).includes('[object Object]'), false);
  assert.deepEqual(pageErrors, []);

  await browser.close();
  return {
    name,
    preview: 'PASS',
    download: 'PASS',
    unsafe_preview: 'PASS',
    manual_categories: 'PASS'
  };
}

const desktop = await runViewport('desktop', { width: 1440, height: 1000 });
const iphone = await runViewport('iphone', { width: 390, height: 844 });

console.log(JSON.stringify({
  ok: true,
  suite: 'project-source-human-ux-browser-v1',
  desktop,
  iphone,
  one_source_intake_ui: true,
  public_url_created: false,
  variable_cost_eur: 0,
  paid_provider_calls: 0,
  production_deploy: false
}, null, 2));
