import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const PREMIUM_STATIC_WEB_V1_ID = 'PREMIUM_STATIC_WEB_V1';

export const PREMIUM_STATIC_WEB_V1_TOOLCHAIN = Object.freeze({
  renderer: { id: 'astro', version: '7.3.1', mode: 'static' },
  styling: { id: 'riosystems-design-tokens-css', runtime: false },
  motion: { primary: 'native-css-web-animations', optional: 'gsap', version: '3.15.0' },
  images: { id: 'sharp', version: '0.35.4', formats: ['avif', 'webp', 'jpeg', 'png'] },
  browser_qa: { id: 'playwright', version: '1.55.0' },
  accessibility_qa: { id: '@axe-core/playwright', version: '4.13.0' },
  performance_qa: { id: 'lighthouse', version: '13.4.1' },
  visual_qa: { id: 'riosystems-visual-foundry', conditional_on_approved_reference: true },
  hosting: { primary: 'cloudflare', production_requires_existing_approval: true }
});

const clone = (value) => value == null ? value : structuredClone(value);
const arr = (value) => Array.isArray(value) ? value : [];
const clean = (value, max = 2000) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const digest = (value) => createHash('sha256').update(String(value)).digest('hex');

function bodyFromHtml(html = '') {
  const match = String(html).match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return match ? match[1].trim() : String(html).trim();
}

function titleFromHtml(html = '', fallback = 'Website') {
  const match = String(html).match(/<title>([\s\S]*?)<\/title>/i);
  return clean(match?.[1] || fallback, 160);
}

function descriptionFromHtml(html = '') {
  const match = String(html).match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i);
  return clean(match?.[1] || '', 220);
}

function astroPagePath(page = {}) {
  const route = String(page.path || '/').replace(/^\/+|\/+$/g, '');
  return route ? `src/pages/${route}/index.astro` : 'src/pages/index.astro';
}

function layoutImport(page = {}) {
  const route = String(page.path || '/').replace(/^\/+|\/+$/g, '');
  const depth = route ? route.split('/').filter(Boolean).length + 1 : 1;
  return `${'../'.repeat(depth)}layouts/BaseLayout.astro`;
}

function sourceRoot(projectRoot) {
  return `${projectRoot}/.jaguar/${PREMIUM_STATIC_WEB_V1_ID.toLowerCase().replaceAll('_', '-')}`;
}

function copiedAssetPath(projectRoot, file) {
  const prefix = `${projectRoot}/assets/`;
  if (!file.startsWith(prefix)) return null;
  const relative = file.slice(prefix.length);
  if (['styles.css', 'site.js'].includes(relative)) return null;
  return `public/assets/${relative}`;
}

function baseLayout() {
  return `---
import '../styles/global.css';
const {
  title = 'Website',
  description = '',
  language = 'de',
  robots = 'noindex,nofollow'
} = Astro.props;
---
<!doctype html>
<html lang={language}>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content={robots} />
    {description && <meta name="description" content={description} />}
    <title>{title}</title>
  </head>
  <body>
    <slot />
    <script src="/site.js" defer></script>
  </body>
</html>
`;
}

function packageJson(projectSlug) {
  return JSON.stringify({
    name: `${projectSlug}-premium-static-web-v1`,
    private: true,
    type: 'module',
    scripts: {
      build: 'astro build',
      preview: 'astro preview',
      check: 'astro check'
    },
    dependencies: {
      astro: '7.3.1',
      gsap: '3.15.0',
      sharp: '0.35.4'
    }
  }, null, 2);
}

function astroConfig() {
  return `export default {
  output: 'static',
  build: { format: 'directory' },
  trailingSlash: 'always',
  compressHTML: true
};
`;
}

function buildSourceFiles({ mission = {}, artifact = {} }) {
  const files = artifact.files || {};
  const projectRoot = artifact.project_root || `projects/${mission.project_slug || 'website'}`;
  const source = {};
  source['package.json'] = packageJson(mission.project_slug || artifact.project?.slug || 'website');
  source['astro.config.mjs'] = astroConfig();
  source['src/layouts/BaseLayout.astro'] = baseLayout();

  const cssPath = `${projectRoot}/assets/styles.css`;
  const jsPath = `${projectRoot}/assets/site.js`;
  source['src/styles/global.css'] = String(files[cssPath] || '');
  source['public/site.js'] = String(files[jsPath] || '');

  for (const page of arr(artifact.pages)) {
    const html = String(files[page.file] || '');
    const body = bodyFromHtml(html);
    const title = titleFromHtml(html, mission.business_name || artifact.project?.business_name || 'Website');
    const description = descriptionFromHtml(html);
    const pageSource = `---
import BaseLayout from '${layoutImport(page)}';
const title = ${JSON.stringify(title)};
const description = ${JSON.stringify(description)};
---
<BaseLayout title={title} description={description} language=${JSON.stringify(mission.language || 'de')}>
${body}
</BaseLayout>
`;
    source[astroPagePath(page)] = pageSource;
  }

  for (const [file, value] of Object.entries(files)) {
    const target = copiedAssetPath(projectRoot, file);
    if (target) source[target] = String(value);
  }

  const robots = files[`${projectRoot}/robots.txt`];
  const sitemap = files[`${projectRoot}/sitemap.xml`];
  const headers = files[`${projectRoot}/_headers`];
  if (robots != null) source['public/robots.txt'] = String(robots);
  if (sitemap != null) source['public/sitemap.xml'] = String(sitemap);
  if (headers != null) source['public/_headers'] = String(headers);

  return source;
}

function sourceManifest(files = {}) {
  const items = Object.entries(files)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([file, contents]) => ({
      file,
      bytes: Buffer.byteLength(String(contents)),
      sha256: digest(contents)
    }));
  return {
    schema: 'riosystems.premium-static-web-v1-source-manifest',
    file_count: items.length,
    total_bytes: items.reduce((sum, item) => sum + item.bytes, 0),
    items,
    deterministic: true
  };
}

export function premiumStaticWebV1Manifest() {
  return {
    schema: 'riosystems.premium-static-web-v1.manifest',
    profile_id: PREMIUM_STATIC_WEB_V1_ID,
    purpose: 'Default source-owned high-quality static website build profile for RIOSYSTEMS Web Factory.',
    default_for: ['native-cloudflare', 'native-premium-cloudflare', 'framer-design-native-cloudflare'],
    excluded_routes: ['webflow-cms-specialist-candidate', 'lovable-rapid-prototype-candidate'],
    toolchain: clone(PREMIUM_STATIC_WEB_V1_TOOLCHAIN),
    source_owned: true,
    exportable: true,
    framework_lock_in: 'LOW',
    production_deploy: false,
    public_launch: false,
    dns_changes: false,
    paid_activation: false,
    automatic_paid_overflow: false
  };
}

export function createPremiumStaticWebV1AcceptanceContract(input = {}) {
  const approvedReference = Boolean(input.approved_reference_id || input.approved_reference_hash || input.reference_registry_entry);
  return {
    schema: 'riosystems.premium-static-web-v1.acceptance',
    profile_id: PREMIUM_STATIC_WEB_V1_ID,
    gates: {
      deterministic_source: { required: true, status: 'PLANNED' },
      astro_static_build: { required: true, status: 'PLANNED' },
      playwright_desktop_mobile: { required: true, status: 'PLANNED' },
      axe_serious_critical: { required: true, maximum_violations: 0, status: 'PLANNED' },
      lighthouse_performance: { required: true, minimum_score: 0.90, status: 'PLANNED' },
      lighthouse_accessibility: { required: true, minimum_score: 0.95, status: 'PLANNED' },
      lighthouse_best_practices: { required: true, minimum_score: 0.95, status: 'PLANNED' },
      visual_foundry: {
        required: approvedReference,
        status: approvedReference ? 'PLANNED' : 'NOT_APPLICABLE_NO_APPROVED_REFERENCE',
        comparison_policy: 'approved-reference-only',
        regression_policy: 'soft-lock-and-semantic-gate'
      },
      staging_noindex: { required: true, status: 'PLANNED' },
      production_safety: { required: true, status: 'PLANNED' }
    },
    public_launch_ready: false,
    production_deploy: false
  };
}

export function applyPremiumStaticWebV1Profile(input = {}) {
  const mission = input.mission || {};
  const artifact = input.artifact;
  const route = input.provider_route?.selected || input.provider_route || {};
  const issues = [];

  if (!artifact?.files || !artifact?.project_root) issues.push({ code: 'BUILD_ARTIFACT_REQUIRED' });
  if (route.build_profile && route.build_profile !== PREMIUM_STATIC_WEB_V1_ID) {
    issues.push({ code: 'ROUTE_BUILD_PROFILE_MISMATCH', expected: PREMIUM_STATIC_WEB_V1_ID, actual: route.build_profile });
  }
  if (artifact?.production_deploy !== false) issues.push({ code: 'PRODUCTION_MUST_REMAIN_DISABLED' });
  if (artifact?.dns_change !== false) issues.push({ code: 'DNS_CHANGES_MUST_REMAIN_DISABLED' });
  if (artifact?.paid_fallback_allowed !== false) issues.push({ code: 'PAID_FALLBACK_MUST_REMAIN_DISABLED' });

  const sourceFiles = artifact?.files ? buildSourceFiles({ mission, artifact }) : {};
  const manifest = sourceManifest(sourceFiles);
  const root = sourceRoot(artifact?.project_root || `projects/${mission.project_slug || 'website'}`);
  const acceptance = createPremiumStaticWebV1AcceptanceContract(input);

  const result = {
    schema: 'riosystems.premium-static-web-v1.profile',
    profile_id: PREMIUM_STATIC_WEB_V1_ID,
    status: issues.length ? 'BLOCK' : 'READY_FOR_ACCEPTANCE',
    route_id: route.route_id || null,
    source_root: root,
    source_package: {
      schema: 'riosystems.premium-static-web-v1.source-package',
      root,
      files: sourceFiles,
      manifest
    },
    toolchain: clone(PREMIUM_STATIC_WEB_V1_TOOLCHAIN),
    acceptance,
    visual_foundry_bridge: {
      schema: 'riosystems.visual-foundry-build-profile-bridge.v1',
      enabled: true,
      approved_reference_required_for_visual_claim: true,
      reference_id: input.approved_reference_id || null,
      reference_hash: input.approved_reference_hash || null,
      metric_policy: 'use-existing-visual-foundry-comparator-and-delta-closure',
      duplicate_visual_engine_created: false
    },
    animation_policy: {
      native_first: true,
      gsap_allowed_when_motion_contract_requires: true,
      reduced_motion_required: true,
      decorative_motion_must_not_block_primary_journey: true
    },
    image_policy: {
      optimizer: 'sharp',
      modern_formats: ['avif', 'webp'],
      responsive_variants_required: true,
      lazy_below_fold: true,
      explicit_dimensions_required: true
    },
    safety: {
      environment: artifact?.environment || 'staging',
      production_deploy: false,
      public_launch: false,
      dns_changes: false,
      paid_activation: false,
      external_writes: false
    },
    issues
  };

  if (artifact?.files && artifact?.project_root) {
    const persisted = {
      ...result,
      source_package: {
        schema: result.source_package.schema,
        root,
        manifest
      }
    };
    artifact.files[`${artifact.project_root}/premium-static-web-v1.json`] = JSON.stringify(persisted, null, 2);
    artifact.build_profile = persisted;
  }

  return result;
}

export async function materializePremiumStaticWebV1SourcePackage(profile, outputRoot) {
  const sourcePackage = profile?.source_package;
  if (!sourcePackage?.files || !sourcePackage?.root) throw new Error('PREMIUM_STATIC_WEB_V1_SOURCE_PACKAGE_REQUIRED');
  const root = path.resolve(outputRoot);
  const written = [];

  for (const [relative, contents] of Object.entries(sourcePackage.files)) {
    const destination = path.resolve(root, relative);
    if (!destination.startsWith(`${root}${path.sep}`) && destination !== root) throw new Error(`SOURCE_PACKAGE_ESCAPE:${relative}`);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, contents, 'utf8');
    written.push(relative);
  }

  return {
    ok: true,
    profile_id: PREMIUM_STATIC_WEB_V1_ID,
    root,
    files_written: written.length,
    source_manifest: sourcePackage.manifest,
    production_deploy: false
  };
}
