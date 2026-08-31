import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  executeWebFactoryTask,
  executeWebFactoryTaskWithVisualProvider,
  framerLiveProviderManifest,
  framerSnapshotToVisualDesignContract,
  runFramerVisualProvider,
  validateFramerVisualProviderRequest,
  validateVisualDesignContract
} from '../src/web-factory/index.js';

function createFakeFramer() {
  let id = 0;
  let disconnected = false;
  const byId = new Map();

  function node(attributes = {}, children = []) {
    const current = {
      id: attributes.id || `node-${++id}`,
      type: attributes.type || 'FrameNode',
      name: attributes.name || 'Frame',
      visible: attributes.visible ?? true,
      locked: attributes.locked ?? false,
      width: attributes.width ?? 100,
      height: attributes.height ?? 100,
      backgroundColor: attributes.backgroundColor ?? null,
      borderRadius: attributes.borderRadius ?? null,
      text: attributes.text ?? null,
      children,
      async getRect() { return { x: 0, y: 0, width: this.width, height: this.height }; },
      async getChildren() { return this.children; },
      async getText() { return this.text || ''; },
      async setText(value) { this.text = String(value); return this; },
      async setAttributes(update) { Object.assign(this, update); return this; }
    };
    byId.set(current.id, current);
    return current;
  }

  const hero = node({ id: 'hero', name: 'Hero', width: 1440, height: 900, backgroundColor: 'rgba(5,5,7,1)' });
  const mobile = node({ id: 'mobile', name: 'Hero Mobile 390', width: 390, height: 844 });
  const home = node({ id: 'home', name: 'Home Desktop', width: 1440, height: 1800 }, [hero, mobile]);
  const root = node({ id: 'root', type: 'CanvasRootNode', name: 'Canvas', width: 1440, height: 1800 }, [home]);

  return {
    get disconnected() { return disconnected; },
    async getProjectInfo() { return { id: 'framer-project-1', name: 'AURENTARA SYSTEMS Visual Lab V1' }; },
    async getColorStyles() {
      return [
        { id: 'bg', name: 'AURENTARA/Background', light: 'rgba(5,5,7,1)' },
        { id: 'accent', name: 'AURENTARA/System Violet', light: 'rgba(119,101,255,1)' }
      ];
    },
    async getTextStyles() {
      return [{ id: 'display', name: 'AURENTARA/Display', fontSize: '96px', lineHeight: '0.9em', font: { family: 'Switzer', weight: 700 } }];
    },
    async getCanvasRoot() { return root; },
    async getNode(targetId) { return byId.get(String(targetId)) || null; },
    async createFrameNode(attributes = {}, parentId) {
      const created = node({ ...attributes, type: 'FrameNode' });
      const parent = parentId ? byId.get(String(parentId)) : root;
      (parent || root).children.push(created);
      return created;
    },
    async addText(value) {
      const created = node({ type: 'TextNode', name: 'Text', text: String(value), width: 500, height: 80 });
      root.children.push(created);
      return created;
    },
    async addSVG({ name }) {
      const created = node({ type: 'SVGNode', name: name || 'SVG', width: 160, height: 160 });
      root.children.push(created);
      return created;
    },
    async disconnect() { disconnected = true; }
  };
}

const projectUrl = 'https://framer.com/projects/AURENTARA-Visual-Lab--test';

for (const blocked of [
  { publish: true },
  { deploy: true },
  { dns_change: true },
  { domain_change: true },
  { paid_action: true },
  { variable_cost_eur: 1 },
  { real_customer_data: true },
  { destructive_action: true }
]) {
  const result = validateFramerVisualProviderRequest({ project_url: projectUrl, ...blocked });
  assert.equal(result.ok, false);
}

const destructiveOperation = validateFramerVisualProviderRequest({
  project_url: projectUrl,
  mode: 'visual_edit',
  allow_visual_write: true,
  operations: [{ type: 'remove_nodes' }]
});
assert.equal(destructiveOperation.ok, false);
assert.ok(destructiveOperation.issues.some((issue) => issue.code === 'FRAMER_OPERATION_FORBIDDEN'));

const writeWithoutAuthorization = validateFramerVisualProviderRequest({
  project_url: projectUrl,
  mode: 'visual_edit',
  operations: [{ type: 'add_text', text: 'AURENTARA SYSTEMS' }]
});
assert.equal(writeWithoutAuthorization.ok, false);
assert.ok(writeWithoutAuthorization.issues.some((issue) => issue.code === 'FRAMER_VISUAL_WRITE_NOT_AUTHORIZED'));

const unsafeSvg = validateFramerVisualProviderRequest({
  project_url: projectUrl,
  mode: 'visual_edit',
  allow_visual_write: true,
  operations: [{ type: 'add_svg', svg: '<svg><script>alert(1)</script></svg>' }]
});
assert.equal(unsafeSvg.ok, false);
assert.ok(unsafeSvg.issues.some((issue) => issue.code === 'FRAMER_SVG_UNSAFE'));

const noCredential = await runFramerVisualProvider({ project_url: projectUrl, operations: [] }, {});
assert.equal(noCredential.ok, false);
assert.equal(noCredential.status, 'FRAMER_API_KEY_REQUIRED');
assert.equal(noCredential.credentials_in_repo, false);

const fake = createFakeFramer();
let disconnectObserved = null;
const connectFn = async (url, key) => {
  assert.equal(url, projectUrl);
  assert.equal(key, 'runtime-test-key');
  return fake;
};

const inspect = await runFramerVisualProvider({
  project_url: projectUrl,
  project_id: 'aurentara-public-site',
  design_id: 'aurentara-framer-live-v1',
  mode: 'inspect',
  operations: [{ type: 'inspect_project' }]
}, {
  apiKey: 'runtime-test-key',
  connectFn,
  onDisconnect(value) { disconnectObserved = value; }
});

assert.equal(inspect.ok, true);
assert.equal(inspect.status, 'FRAMER_VISUAL_PROVIDER_VERIFIED');
assert.equal(inspect.provider.project_name, 'AURENTARA SYSTEMS Visual Lab V1');
assert.equal(inspect.provider.api_key_exposed, false);
assert.equal(inspect.production_publish, false);
assert.equal(inspect.production_deploy, false);
assert.equal(inspect.variable_cost_eur, 0);
assert.equal(inspect.design_contract.source_provider, 'framer');
assert.equal(inspect.design_contract_validation.status, 'VALID');
assert.equal(disconnectObserved, true);
assert.equal(fake.disconnected, true);

const fakeEdit = createFakeFramer();
const edit = await runFramerVisualProvider({
  project_url: projectUrl,
  project_id: 'aurentara-public-site',
  design_id: 'aurentara-framer-edit-v1',
  mode: 'visual_edit',
  allow_visual_write: true,
  operations: [
    { type: 'create_frame', alias: 'aurentara-core', parent_id: 'hero', attributes: { name: 'AURENTARA Core', width: 480, height: 480, backgroundColor: 'rgba(11,12,16,1)', borderRadius: 24, href: 'https://blocked.example' } },
    { type: 'set_attributes', target_alias: 'aurentara-core', attributes: { opacity: 0.96, width: 520, customCode: '<script />' } },
    { type: 'add_text', alias: 'brand-text', text: 'AURENTARA SYSTEMS', attributes: { fontSize: '16px', letterSpacing: '0.18em' } },
    { type: 'set_text', target_alias: 'brand-text', text: 'AURENTARA SYSTEMS' },
    { type: 'add_svg', alias: 'core-mark', name: 'aurentara-core.svg', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><path d="M16 2 30 30H2Z"/></svg>' }
  ]
}, {
  apiKey: 'runtime-test-key',
  connectFn: async () => fakeEdit
});

assert.equal(edit.ok, true);
assert.equal(edit.operations.length, 5);
assert.ok(edit.operations.every((item) => item.status === 'PASS'));
assert.equal(edit.production_publish, false);
assert.equal(edit.domain_change, false);
assert.equal(fakeEdit.disconnected, true);

const normalized = framerSnapshotToVisualDesignContract(edit.snapshot_after, {
  design_id: 'normalized-test',
  project_id: 'aurentara-public-site'
});
const normalizedValidation = validateVisualDesignContract(normalized);
assert.equal(normalizedValidation.ok, true);
assert.equal(normalizedValidation.contract.provider_runtime_dependency_required, false);
assert.equal(normalizedValidation.contract.raw_provider_html_allowed, false);
assert.equal(normalizedValidation.contract.proprietary_code_extraction_allowed, false);

const fixture = JSON.parse(await readFile(new URL('../fixtures/web-factory/premium-architecture-studio.json', import.meta.url), 'utf8'));
const legacy = executeWebFactoryTask({
  capability: 'web.premium.build',
  website_mission: fixture.mission,
  design_contract: fixture.design_contract,
  routing_context: fixture.routing_context
}, { now: '2026-08-31T03:00:00.000Z' });
assert.equal(legacy.ok, true);

const integratedFake = createFakeFramer();
const integrated = await executeWebFactoryTaskWithVisualProvider({
  capability: 'web.premium.build',
  website_mission: fixture.mission,
  design_contract: fixture.design_contract,
  routing_context: fixture.routing_context,
  framer_visual_request: {
    project_url: projectUrl,
    project_id: fixture.mission.project_id || 'aurentara-public-site',
    design_id: fixture.design_contract.design_id,
    mode: 'inspect',
    operations: [{ type: 'inspect_project' }]
  }
}, {
  now: '2026-08-31T03:00:00.000Z',
  framer: {
    apiKey: 'runtime-test-key',
    connectFn: async () => integratedFake
  }
});
assert.equal(integrated.ok, true);
assert.equal(integrated.visual_provider_evidence.status, 'FRAMER_VISUAL_PROVIDER_VERIFIED');
assert.equal(integrated.visual_provider_evidence.native_reconstruction_required, true);
assert.equal(integrated.visual_provider_evidence.framer_runtime_dependency_in_final_site, false);
assert.equal(integrated.visual_provider_evidence.production_publish, false);
assert.equal(integrated.visual_provider_evidence.variable_cost_eur, 0);
assert.equal(integratedFake.disconnected, true);

const manifest = framerLiveProviderManifest();
assert.equal(manifest.role, 'visual_specialist');
assert.equal(manifest.production_publish_allowed, false);
assert.equal(manifest.production_deploy_allowed, false);
assert.equal(manifest.destructive_actions_allowed, false);
assert.equal(manifest.paid_actions_allowed, false);
assert.equal(manifest.variable_cost_ceiling_eur, 0);
assert.equal(manifest.portability_required, true);

console.log(JSON.stringify({
  ok: true,
  suite: 'web-factory-framer-live-visual-provider-v1',
  provider: manifest.provider_id,
  inspected_project: inspect.provider.project_name,
  safe_visual_edit_operations: edit.operations.length,
  design_contract_status: inspect.design_contract_validation.status,
  integrated_native_reconstruction: integrated.ok,
  legacy_sync_path_regression: legacy.ok,
  production_publish: false,
  production_deploy: false,
  variable_cost_eur: 0
}, null, 2));
