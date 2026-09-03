import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { validateWebsiteMission } from './contracts.js';
import { planWebsite } from './planner.js';
import { createDesignSystem, renderDesignCss } from './design-system.js';
import { createContentContract } from './content.js';
import { composeComponents, renderComponents, renderFooter, renderHeader, componentRegistryManifest } from './components.js';
import { runWebsiteQa } from './qa.js';
import { runAutomaticRepairLoop } from './repair.js';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const redactKeys = /secret|password|token|credential|api[_-]?key/i;

function safeLogPayload(payload) {
  if (Array.isArray(payload)) return payload.map(safeLogPayload);
  if (!payload || typeof payload !== 'object') return payload;
  return Object.fromEntries(Object.entries(payload).map(([key, value]) => [key, redactKeys.test(key) ? '[REDACTED]' : safeLogPayload(value)]));
}

function buildIdFor(mission, now) {
  const digest = createHash('sha256').update(JSON.stringify({ mission, now })).digest('hex').slice(0, 12);
  return `wf1-${mission.project_slug}-${digest}`;
}

function createObserver(buildId, now) {
  const events = [];
  let sequence = 0;
  return {
    emit(type, payload = {}) {
      sequence += 1;
      events.push({ sequence, build_id: buildId, at: now, event: type, payload: safeLogPayload(payload) });
    },
    events
  };
}

function canonicalBase(mission) {
  const raw = String(mission.existing_domain || '').trim().replace(/\/+$/, '');
  if (/^https:\/\/[a-z0-9.-]+(?::\d+)?(?:\/.*)?$/i.test(raw)) return { strategy: 'existing_https_domain', base: raw };
  return { strategy: 'deferred_until_approved_domain', base: `https://preview.invalid/${mission.project_slug}` };
}

function pageFile(projectRoot, page) {
  return page.path === '/' ? `${projectRoot}/index.html` : `${projectRoot}/${page.path.replace(/^\//, '').replace(/\/$/, '')}/index.html`;
}

function assetPrefix(page) {
  return page.path === '/' ? './' : '../';
}

function renderJsonLd(mission, canonical) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: mission.business_name,
    url: canonical.base,
    areaServed: mission.seo_location,
    knowsAbout: mission.services
  };
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

function renderPage({ mission, blueprint, page, content, canonical }) {
  const prefix = assetPrefix(page);
  const title = page.id === 'home' ? mission.business_name : `${page.label} · ${mission.business_name}`;
  const description = String(content.subheadline || mission.brand_positioning).slice(0, 155);
  const canonicalHref = `${canonical.base}${page.path === '/' ? '/' : page.path}`.replace(/([^:]\/)\/+?/g, '$1');
  const body = renderComponents(page, content, mission);
  return `<!doctype html>
<html lang="${esc(mission.language)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <meta name="description" content="${esc(description)}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${esc(canonicalHref)}">
  <meta name="riosystems:canonical-strategy" content="${esc(canonical.strategy)}">
  <link rel="canonical" href="${esc(canonicalHref)}">
  <link rel="stylesheet" href="${prefix}assets/styles.css">
  <title>${esc(title)}</title>
  <script type="application/ld+json">${renderJsonLd(mission, canonical)}</script>
  <script src="${prefix}assets/site.js" defer></script>
</head>
<body>
${renderHeader({ mission, blueprint, page })}
<main id="main-content">
${body}
</main>
${renderFooter({ mission, page })}
</body>
</html>`;
}

function renderSiteJs() {
  return `document.querySelectorAll('.nav-toggle').forEach((button)=>{button.addEventListener('click',()=>{const id=button.getAttribute('aria-controls');const nav=document.getElementById(id);if(!nav)return;const open=button.getAttribute('aria-expanded')==='true';button.setAttribute('aria-expanded',String(!open));nav.dataset.open=String(!open);});});`;
}

function renderRobots() {
  return 'User-agent: *\nDisallow: /\n';
}

function renderSitemap(blueprint, canonical) {
  const urls = blueprint.pages.map((page) => `  <url><loc>${esc(`${canonical.base}${page.path}`)}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function renderHeaders() {
  return `/*
  X-Robots-Tag: noindex, nofollow
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'none'; form-action 'self'; base-uri 'self'; frame-ancestors 'none'
`;
}

function createBaseArtifact(mission, blueprint, designSystem, content, buildId) {
  const projectRoot = `projects/${mission.project_slug}`;
  const canonical = canonicalBase(mission);
  const files = {};
  for (const page of blueprint.pages) files[pageFile(projectRoot, page)] = renderPage({ mission, blueprint, page, content: content.pages[page.id], canonical });
  files[`${projectRoot}/assets/styles.css`] = renderDesignCss(designSystem);
  files[`${projectRoot}/assets/site.js`] = renderSiteJs();
  files[`${projectRoot}/robots.txt`] = renderRobots();
  files[`${projectRoot}/sitemap.xml`] = renderSitemap(blueprint, canonical);
  files[`${projectRoot}/_headers`] = renderHeaders();
  files[`${projectRoot}/design-tokens.json`] = JSON.stringify(designSystem, null, 2);
  files[`${projectRoot}/content.json`] = JSON.stringify(content, null, 2);
  files[`${projectRoot}/website-blueprint.json`] = JSON.stringify(blueprint, null, 2);
  files[`${projectRoot}/project.json`] = JSON.stringify({
    schema: 'riosystems.web-staging-project.v1',
    project: { slug: mission.project_slug, business_name: mission.business_name, scope_key: mission.project_scope_key || null },
    generated_by: 'riosystems-native-web',
    environment: 'staging',
    project_context_bound: Boolean(mission.project_mission_context),
    synthetic_test_data_only: mission.synthetic_test_data_only,
    real_customer_data: false,
    external_integrations: false,
    forms_enabled: false,
    payments_enabled: false,
    robots: 'noindex,nofollow',
    hosting_target: 'cloudflare-pages-preview',
    expected_pages_project: 'chatgpt-factory-preview',
    deployment_authorized: false,
    custom_domain: false,
    dns_change: false,
    automatic_paid_overflow: false,
    production_deploy: false
  }, null, 2);

  return {
    schema: 'riosystems.web-build-artifact.v1',
    build_id: buildId,
    project: { slug: mission.project_slug, business_name: mission.business_name },
    project_root: projectRoot,
    project_scope_key: mission.project_scope_key || mission.project_mission_context?.project?.scope_key || null,
    project_mission_context: mission.project_mission_context ? structuredClone(mission.project_mission_context) : null,
    approved_project_assets: structuredClone(mission.approved_project_assets || []),
    used_project_asset_ids: [],
    environment: 'staging',
    hosting_target: 'cloudflare-pages-preview',
    expected_pages_project: 'chatgpt-factory-preview',
    canonical_strategy: canonical.strategy,
    pages: blueprint.pages.map(({ id, path: pagePath, label }) => ({ id, path: pagePath, label, file: pageFile(projectRoot, { path: pagePath }) })),
    design_system: designSystem,
    content_contract: content,
    component_registry: componentRegistryManifest(),
    components_used: [...new Set(blueprint.pages.flatMap((page) => ['Header', ...composeComponents(page, content.pages[page.id]).map(({ type }) => type), 'Footer']))],
    files,
    synthetic_test_data_only: mission.synthetic_test_data_only,
    real_customer_data: false,
    forms_enabled: false,
    payments_enabled: false,
    external_integrations: false,
    custom_domain: false,
    dns_change: false,
    production_deploy: false,
    paid_fallback_allowed: false,
    variable_cost_eur: 0
  };
}

function deploymentContract(artifact, qa) {
  return {
    schema: 'riosystems.web-deployment-artifact.v1',
    build_id: artifact.build_id,
    project_slug: artifact.project.slug,
    project_root: artifact.project_root,
    target: 'cloudflare-pages-preview',
    environment: 'staging',
    status: qa.status === 'PASS' ? 'READY_FOR_STAGING' : 'BLOCKED_BY_QA',
    qa_status: qa.status,
    noindex: true,
    synthetic_test_data_only: artifact.synthetic_test_data_only,
    real_customer_data: false,
    external_integrations: false,
    forms_enabled: false,
    payments_enabled: false,
    expected_pages_project: artifact.expected_pages_project,
    deployment_authorized: false,
    custom_domain: false,
    dns_change: false,
    variable_cost_eur: 0,
    automatic_paid_overflow: false,
    production_deploy: false
  };
}

function deliveryManifest(artifact, blueprint, qa, repairHistory, deployment, events) {
  return {
    schema: 'riosystems.web-delivery-manifest.v1',
    build_id: artifact.build_id,
    project: artifact.project,
    pages: blueprint.pages.map(({ id, path, purpose, conversion_goal, seo_intent }) => ({ id, path, purpose, conversion_goal, seo_intent })),
    design_system: { schema: artifact.design_system.schema, direction: artifact.design_system.direction },
    components_used: artifact.components_used,
    qa_result: qa,
    repair_history: repairHistory,
    deployment_status: deployment.status,
    deployment_contract: deployment,
    preview_url: null,
    production_status: 'DISABLED',
    warnings: qa.warnings,
    next_actions: qa.status === 'PASS'
      ? ['Cloudflare Pages preview may be deployed only through the separately approved zero-cost staging gate', 'Replace legal placeholders with operator-approved legal content before any production review']
      : ['Resolve blocking QA issues before any deployment'],
    observability: { event_count: events.length, events_file: `${artifact.project_root}/build-observability.json` },
    production_deploy: false
  };
}

export function buildWebsiteProject(input = {}, options = {}) {
  const validation = validateWebsiteMission(input);
  if (!validation.ok) {
    return { ok: false, status: 'REQUIREMENTS_REQUIRED', validation, production_deploy: false, variable_cost_eur: 0 };
  }

  const mission = validation.mission;
  const now = options.now || new Date().toISOString();
  const buildId = options.build_id || buildIdFor(mission, now);
  const observer = createObserver(buildId, now);
  observer.emit('mission_received', { schema: mission.schema, project_slug: mission.project_slug, project_scope_key: mission.project_scope_key || null });

  const blueprint = planWebsite(mission);
  observer.emit('plan_generated', { pages: blueprint.pages.map((page) => page.id) });
  const designSystem = createDesignSystem(mission);
  observer.emit('design_system_generated', { schema: designSystem.schema });
  const content = createContentContract(mission, blueprint);
  observer.emit('content_generated', { schema: content.schema, ai_provider_required: false, project_content_pack_bound: Boolean(mission.project_mission_context) });
  let artifact = createBaseArtifact(mission, blueprint, designSystem, content, buildId);
  observer.emit('components_selected', { components: artifact.components_used });
  observer.emit('pages_generated', { count: blueprint.pages.length, project_root: artifact.project_root });

  const initialQa = runWebsiteQa(artifact);
  observer.emit('qa_result', { phase: 'initial', status: initialQa.status, score: initialQa.score, blocking: initialQa.blocking_issues.length });
  const repair = runAutomaticRepairLoop(artifact, { max_attempts: options.max_repair_attempts ?? 3 });
  artifact = repair.artifact;
  for (const record of repair.repair_history) observer.emit('repair_applied', record);
  const finalQa = repair.qa_result;
  observer.emit('qa_result', { phase: 'final', status: finalQa.status, score: finalQa.score, blocking: finalQa.blocking_issues.length });

  const deployment = deploymentContract(artifact, finalQa);
  observer.emit('deployment_readiness', { status: deployment.status, target: deployment.target, production_deploy: false });
  observer.emit('final_status', { status: finalQa.status === 'PASS' ? 'VERIFIED_WEBSITE_DELIVERABLE' : 'BLOCKED_BY_QA' });
  const manifest = deliveryManifest(artifact, blueprint, finalQa, repair.repair_history, deployment, observer.events);

  artifact.files[`${artifact.project_root}/deployment-artifact.json`] = JSON.stringify(deployment, null, 2);
  artifact.files[`${artifact.project_root}/delivery-manifest.json`] = JSON.stringify(manifest, null, 2);
  artifact.files[`${artifact.project_root}/build-observability.json`] = JSON.stringify(observer.events, null, 2);
  artifact.qa_result = finalQa;
  artifact.repair_history = repair.repair_history;
  artifact.deployment = deployment;
  artifact.delivery_manifest = manifest;
  artifact.observability = observer.events;

  return {
    ok: finalQa.status === 'PASS',
    status: finalQa.status === 'PASS' ? 'VERIFIED_WEBSITE_DELIVERABLE' : 'BLOCKED_BY_QA',
    validation,
    blueprint,
    design_system: designSystem,
    content,
    artifact,
    qa_result: finalQa,
    repair_history: repair.repair_history,
    deployment,
    delivery_manifest: manifest,
    variable_cost_eur: 0,
    production_deploy: false
  };
}

export async function writeWebsiteArtifact(build, outputRoot) {
  if (!build?.ok || !build.artifact) throw new Error('VERIFIED_BUILD_REQUIRED');
  const root = path.resolve(outputRoot);
  const written = [];
  for (const [relative, contents] of Object.entries(build.artifact.files)) {
    const destination = path.resolve(root, relative);
    if (!destination.startsWith(`${root}${path.sep}`)) throw new Error(`PROJECT_BOUNDARY_ESCAPE:${relative}`);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, contents, 'utf8');
    written.push(relative);
  }
  return { ok: true, project_root: build.artifact.project_root, files_written: written.length, production_deploy: false };
}
