import { validateVisualDesignContract } from './visual-design-contract.js';

const ALLOWED_MODES = new Set(['inspect', 'visual_edit']);
const ALLOWED_OPERATIONS = new Set(['inspect_project', 'create_frame', 'add_text', 'add_svg', 'set_attributes', 'set_text']);
const MUTATING_OPERATIONS = new Set(['create_frame', 'add_text', 'add_svg', 'set_attributes', 'set_text']);
const BLOCKED_OPERATION_NAMES = new Set([
  'publish', 'deploy', 'remove', 'delete', 'remove_node', 'remove_nodes', 'clone_page',
  'add_redirect', 'remove_redirect', 'set_redirect', 'set_custom_code', 'cms_write',
  'upload_file', 'upload_image', 'set_site_settings', 'domain_change', 'dns_change'
]);

const SAFE_VISUAL_ATTRIBUTES = new Set([
  'name', 'visible', 'locked', 'opacity', 'rotation', 'position', 'top', 'right', 'bottom', 'left',
  'width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight', 'aspectRatio', 'overflow',
  'overflowX', 'overflowY', 'backgroundColor', 'backgroundGradient', 'border', 'borderRadius',
  'boxShadow', 'filter', 'backdropFilter', 'layout', 'layoutDirection', 'stackDirection', 'gap',
  'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'alignItems',
  'justifyContent', 'distribute', 'fontSize', 'lineHeight', 'letterSpacing', 'textAlign', 'color',
  'fontWeight', 'textTransform', 'textTruncation'
]);

const SNAPSHOT_FIELDS = [
  'id', 'type', 'name', 'visible', 'locked', 'opacity', 'rotation', 'position', 'top', 'right',
  'bottom', 'left', 'width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight',
  'aspectRatio', 'overflow', 'overflowX', 'overflowY', 'backgroundColor', 'backgroundGradient',
  'border', 'borderRadius', 'boxShadow', 'filter', 'backdropFilter', 'layout', 'layoutDirection',
  'stackDirection', 'gap', 'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'alignItems', 'justifyContent', 'distribute', 'fontSize', 'lineHeight', 'letterSpacing',
  'textAlign', 'color', 'fontWeight', 'textTransform', 'textTruncation', 'path', 'draft'
];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function isPrimitive(value) {
  return value == null || ['string', 'number', 'boolean'].includes(typeof value);
}

function stableValue(value) {
  if (isPrimitive(value)) return value;
  if (Array.isArray(value)) return value.filter(isPrimitive).slice(0, 32);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, nested] of Object.entries(value)) {
      if (isPrimitive(nested)) out[key] = nested;
    }
    return out;
  }
  return null;
}

function safeAttributes(attributes = {}) {
  const result = {};
  for (const [key, value] of Object.entries(attributes || {})) {
    if (!SAFE_VISUAL_ATTRIBUTES.has(key)) continue;
    const stable = stableValue(value);
    if (stable !== null || value === null) result[key] = stable;
  }
  return result;
}

function safeSvg(svg) {
  const source = String(svg || '');
  const lower = source.toLowerCase();
  const blocked = ['<script', '<foreignobject', 'javascript:', 'onload=', 'onclick=', 'onerror=', 'href="http', "href='http", 'xlink:href="http', "xlink:href='http"];
  if (!source.trim().startsWith('<svg')) throw new Error('FRAMER_SVG_INVALID');
  if (new TextEncoder().encode(source).byteLength > 10_000) throw new Error('FRAMER_SVG_TOO_LARGE');
  if (blocked.some((needle) => lower.includes(needle))) throw new Error('FRAMER_SVG_UNSAFE');
  return source;
}

function compactName(value, fallback) {
  return text(value).slice(0, 120) || fallback;
}

function tokenKey(value, fallback) {
  const normalized = String(value || fallback || 'token')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback || 'token';
}

export function validateFramerVisualProviderRequest(input = {}) {
  const issues = [];
  const mode = text(input.mode || 'inspect');
  const projectUrl = text(input.project_url);
  const operations = array(input.operations);

  if (!ALLOWED_MODES.has(mode)) issues.push({ code: 'FRAMER_MODE_UNSUPPORTED', field: 'mode' });
  if (!/^https:\/\/framer\.com\/projects\//i.test(projectUrl)) {
    issues.push({ code: 'FRAMER_PROJECT_URL_REQUIRED', field: 'project_url' });
  }
  if (input.production_publish === true || input.publish === true) issues.push({ code: 'FRAMER_PUBLISH_FORBIDDEN', field: 'publish' });
  if (input.production_deploy === true || input.deploy === true) issues.push({ code: 'FRAMER_DEPLOY_FORBIDDEN', field: 'deploy' });
  if (input.domain_change === true || input.dns_change === true) issues.push({ code: 'FRAMER_DOMAIN_CHANGE_FORBIDDEN', field: 'domain_change' });
  if (input.paid_action === true || Number(input.variable_cost_eur || 0) > 0) issues.push({ code: 'FRAMER_PAID_ACTION_FORBIDDEN', field: 'paid_action' });
  if (input.real_customer_data === true) issues.push({ code: 'FRAMER_REAL_CUSTOMER_DATA_FORBIDDEN', field: 'real_customer_data' });
  if (input.destructive_action === true) issues.push({ code: 'FRAMER_DESTRUCTIVE_ACTION_FORBIDDEN', field: 'destructive_action' });
  if (operations.length > 200) issues.push({ code: 'FRAMER_OPERATION_LIMIT_EXCEEDED', field: 'operations' });

  for (const [index, operation] of operations.entries()) {
    const type = text(operation?.type);
    if (BLOCKED_OPERATION_NAMES.has(type)) {
      issues.push({ code: 'FRAMER_OPERATION_FORBIDDEN', field: `operations.${index}.type`, operation: type });
      continue;
    }
    if (!ALLOWED_OPERATIONS.has(type)) {
      issues.push({ code: 'FRAMER_OPERATION_UNSUPPORTED', field: `operations.${index}.type`, operation: type });
    }
    if (type === 'add_svg') {
      try { safeSvg(operation.svg); } catch (error) {
        issues.push({ code: error.message, field: `operations.${index}.svg` });
      }
    }
  }

  const hasWrites = operations.some((operation) => MUTATING_OPERATIONS.has(text(operation?.type)));
  if (hasWrites && mode !== 'visual_edit') issues.push({ code: 'FRAMER_VISUAL_EDIT_MODE_REQUIRED', field: 'mode' });
  if (hasWrites && input.allow_visual_write !== true) issues.push({ code: 'FRAMER_VISUAL_WRITE_NOT_AUTHORIZED', field: 'allow_visual_write' });

  return {
    ok: issues.length === 0,
    status: issues.length === 0 ? 'VALID' : 'BLOCKED',
    issues,
    request: {
      schema: 'riosystems.framer-visual-provider-request.v1',
      project_url: projectUrl,
      project_id: compactName(input.project_id, 'framer-project'),
      design_id: compactName(input.design_id, 'framer-live-design'),
      mode: ALLOWED_MODES.has(mode) ? mode : 'inspect',
      allow_visual_write: input.allow_visual_write === true,
      operations,
      production_publish: false,
      production_deploy: false,
      domain_change: false,
      dns_change: false,
      paid_action: false,
      variable_cost_eur: 0,
      real_customer_data: false,
      destructive_action: false,
      portability_required: true
    }
  };
}

function styleSnapshot(style = {}) {
  const out = {};
  for (const key of ['id', 'name', 'light', 'dark', 'fontSize', 'lineHeight', 'letterSpacing', 'color', 'tag', 'breakpoints']) {
    if (Object.prototype.hasOwnProperty.call(style, key)) out[key] = stableValue(style[key]);
  }
  if (style.font?.family) out.fontFamily = String(style.font.family);
  if (style.font?.weight) out.fontWeight = style.font.weight;
  return out;
}

async function snapshotNode(node, depth, maxDepth) {
  const result = {};
  for (const field of SNAPSHOT_FIELDS) {
    try {
      if (field in node) result[field] = stableValue(node[field]);
    } catch {
      // A remote node may not expose every attribute to the current permission set.
    }
  }

  if (typeof node.getRect === 'function') {
    try { result.rect = stableValue(await node.getRect()); } catch { result.rect = null; }
  }
  if (typeof node.getText === 'function') {
    try { result.text = String(await node.getText()); } catch { /* read only best effort */ }
  }

  result.children = [];
  if (depth < maxDepth && typeof node.getChildren === 'function') {
    try {
      const children = await node.getChildren();
      for (const child of array(children)) result.children.push(await snapshotNode(child, depth + 1, maxDepth));
    } catch {
      result.children = [];
    }
  }
  return result;
}

export async function inspectFramerProject(framer, options = {}) {
  if (!framer || typeof framer.getProjectInfo !== 'function') throw new Error('FRAMER_CONNECTION_INVALID');
  const maxDepth = Math.max(1, Math.min(12, Number(options.max_depth || 7)));
  const [projectInfo, colorStyles, textStyles, canvasRoot] = await Promise.all([
    framer.getProjectInfo(),
    typeof framer.getColorStyles === 'function' ? framer.getColorStyles() : [],
    typeof framer.getTextStyles === 'function' ? framer.getTextStyles() : [],
    typeof framer.getCanvasRoot === 'function' ? framer.getCanvasRoot() : null
  ]);

  return {
    schema: 'riosystems.framer-project-snapshot.v1',
    provider: 'framer',
    project: {
      id: projectInfo?.id ? String(projectInfo.id) : null,
      name: projectInfo?.name ? String(projectInfo.name) : 'Framer Project'
    },
    color_styles: array(colorStyles).map(styleSnapshot),
    text_styles: array(textStyles).map(styleSnapshot),
    canvas: canvasRoot ? await snapshotNode(canvasRoot, 0, maxDepth) : null,
    publish_info_read: false,
    publish_executed: false,
    deploy_executed: false
  };
}

function flattenNodes(node, result = []) {
  if (!node) return result;
  result.push(node);
  for (const child of array(node.children)) flattenNodes(child, result);
  return result;
}

function topCanvasChildren(snapshot) {
  return array(snapshot?.canvas?.children);
}

function inferPages(snapshot) {
  const top = topCanvasChildren(snapshot);
  const explicitPages = top.filter((node) => String(node.type || '').toLowerCase().includes('page'));
  const candidates = explicitPages.length ? explicitPages : top;
  if (!candidates.length) return [{ page_id: 'home', name: 'Home', path: '/' }];
  return candidates.map((node, index) => ({
    page_id: String(node.id || `page-${index + 1}`),
    name: compactName(node.name, index === 0 ? 'Home' : `Page ${index + 1}`),
    path: typeof node.path === 'string' ? node.path : index === 0 ? '/' : null,
    source_node_type: node.type || null,
    rect: node.rect || null
  }));
}

function inferSections(snapshot) {
  const top = topCanvasChildren(snapshot);
  const sectionCandidates = [];
  for (const parent of top) {
    const children = array(parent.children);
    if (children.length) sectionCandidates.push(...children);
  }
  const candidates = sectionCandidates.length ? sectionCandidates : top;
  if (!candidates.length) return [{ section_id: 'canvas-root', name: 'Canvas Root', source: 'framer' }];
  return candidates.slice(0, 80).map((node, index) => ({
    section_id: String(node.id || `section-${index + 1}`),
    name: compactName(node.name, `Section ${index + 1}`),
    source_node_type: node.type || null,
    rect: node.rect || null
  }));
}

function colorTokens(snapshot) {
  const tokens = {};
  array(snapshot.color_styles).forEach((style, index) => {
    tokens[tokenKey(style.name, `color-${index + 1}`)] = style.light || style.dark || style.color || null;
  });
  return tokens;
}

function typographyTokens(snapshot) {
  const tokens = {};
  array(snapshot.text_styles).forEach((style, index) => {
    tokens[tokenKey(style.name, `text-${index + 1}`)] = {
      family: style.fontFamily || null,
      weight: style.fontWeight || null,
      size: style.fontSize || null,
      line_height: style.lineHeight || null,
      letter_spacing: style.letterSpacing || null,
      color: style.color || null,
      tag: style.tag || null,
      breakpoints: style.breakpoints || []
    };
  });
  return tokens;
}

function inferResponsiveRules(snapshot) {
  return flattenNodes(snapshot.canvas, [])
    .filter((node) => /desktop|tablet|mobile|breakpoint/i.test(String(node.name || '')))
    .slice(0, 40)
    .map((node) => ({
      source_node_id: node.id || null,
      name: node.name || null,
      width: node.rect?.width ?? node.width ?? null,
      height: node.rect?.height ?? node.height ?? null
    }));
}

export function framerSnapshotToVisualDesignContract(snapshot = {}, input = {}) {
  const nodes = flattenNodes(snapshot.canvas, []);
  return {
    schema: 'riosystems.visual-design-contract.v1',
    design_id: compactName(input.design_id, `framer-${snapshot.project?.id || 'design'}`),
    project_id: compactName(input.project_id, snapshot.project?.id || 'framer-project'),
    source_provider: 'framer',
    source_kind: 'framer-server-api-live-snapshot',
    pages: inferPages(snapshot),
    sections: inferSections(snapshot),
    layout_system: {
      source: 'framer-canvas',
      root_rect: snapshot.canvas?.rect || null,
      node_count: nodes.length,
      max_snapshot_depth: input.max_depth || 7
    },
    color_tokens: colorTokens(snapshot),
    typography_tokens: typographyTokens(snapshot),
    spacing_tokens: {},
    radius_tokens: {},
    shadow_tokens: {},
    component_specs: nodes.filter((node) => /component/i.test(String(node.type || ''))).slice(0, 80).map((node) => ({ id: node.id || null, name: node.name || null, type: node.type || null })),
    interaction_specs: [],
    animation_specs: [],
    responsive_rules: inferResponsiveRules(snapshot),
    asset_manifest: [],
    visual_references: [{
      source: 'framer-live-project',
      project_id: snapshot.project?.id || null,
      project_name: snapshot.project?.name || null,
      usage: 'visual-structure-reference-only'
    }],
    implementation_notes: [
      'Snapshot created through guarded Framer Server API visual-provider bridge.',
      'Framer remains a visual specialist; native HTML/CSS/SVG/JS remains the production build target.',
      'No Framer publish, deployment, domain mutation, custom code, CMS write, or destructive operation is permitted by this provider.'
    ]
  };
}

async function getTargetNode(framer, operation, aliases) {
  const requested = text(operation.target_id || operation.target_alias);
  const id = aliases.get(requested) || requested;
  if (!id || typeof framer.getNode !== 'function') throw new Error('FRAMER_TARGET_NODE_REQUIRED');
  const node = await framer.getNode(id);
  if (!node) throw new Error(`FRAMER_TARGET_NODE_NOT_FOUND:${id}`);
  return node;
}

function recordAlias(operation, node, aliases) {
  const alias = text(operation.alias);
  if (alias && node?.id) aliases.set(alias, String(node.id));
}

async function executeOperation(framer, operation, aliases) {
  const type = text(operation.type);
  if (type === 'inspect_project') return { type, status: 'PASS', mutating: false };

  if (type === 'create_frame') {
    if (typeof framer.createFrameNode !== 'function') throw new Error('FRAMER_CREATE_FRAME_UNAVAILABLE');
    const parent = text(operation.parent_id || operation.parent_alias);
    const parentId = aliases.get(parent) || parent || undefined;
    const node = await framer.createFrameNode(safeAttributes(operation.attributes), parentId);
    if (!node) throw new Error('FRAMER_CREATE_FRAME_FAILED');
    recordAlias(operation, node, aliases);
    return { type, status: 'PASS', node_id: node.id ? String(node.id) : null, alias: text(operation.alias) || null, mutating: true };
  }

  if (type === 'add_text') {
    if (typeof framer.addText !== 'function') throw new Error('FRAMER_ADD_TEXT_UNAVAILABLE');
    const node = await framer.addText(String(operation.text || ''));
    if (node && Object.keys(safeAttributes(operation.attributes)).length && typeof node.setAttributes === 'function') {
      await node.setAttributes(safeAttributes(operation.attributes));
    }
    recordAlias(operation, node, aliases);
    return { type, status: 'PASS', node_id: node?.id ? String(node.id) : null, alias: text(operation.alias) || null, mutating: true };
  }

  if (type === 'add_svg') {
    if (typeof framer.addSVG !== 'function') throw new Error('FRAMER_ADD_SVG_UNAVAILABLE');
    const node = await framer.addSVG({ svg: safeSvg(operation.svg), name: compactName(operation.name, 'aurentara-visual.svg') });
    if (node && Object.keys(safeAttributes(operation.attributes)).length && typeof node.setAttributes === 'function') {
      await node.setAttributes(safeAttributes(operation.attributes));
    }
    recordAlias(operation, node, aliases);
    return { type, status: 'PASS', node_id: node?.id ? String(node.id) : null, alias: text(operation.alias) || null, mutating: true };
  }

  if (type === 'set_attributes') {
    const node = await getTargetNode(framer, operation, aliases);
    if (typeof node.setAttributes !== 'function') throw new Error('FRAMER_SET_ATTRIBUTES_UNAVAILABLE');
    const attributes = safeAttributes(operation.attributes);
    if (!Object.keys(attributes).length) throw new Error('FRAMER_SAFE_ATTRIBUTES_REQUIRED');
    await node.setAttributes(attributes);
    return { type, status: 'PASS', node_id: node.id ? String(node.id) : null, changed_attributes: Object.keys(attributes), mutating: true };
  }

  if (type === 'set_text') {
    const node = await getTargetNode(framer, operation, aliases);
    if (typeof node.setText !== 'function') throw new Error('FRAMER_SET_TEXT_UNAVAILABLE');
    await node.setText(String(operation.text || ''));
    return { type, status: 'PASS', node_id: node.id ? String(node.id) : null, mutating: true };
  }

  throw new Error(`FRAMER_OPERATION_UNSUPPORTED:${type}`);
}

async function resolveConnect(options = {}) {
  if (typeof options.connectFn === 'function') return options.connectFn;
  const module = await import('framer-api');
  if (typeof module.connect !== 'function') throw new Error('FRAMER_SERVER_API_CONNECT_UNAVAILABLE');
  return module.connect;
}

function credential(options = {}) {
  if (text(options.apiKey)) return options.apiKey;
  if (text(options.env?.FRAMER_API_KEY)) return options.env.FRAMER_API_KEY;
  if (typeof process !== 'undefined' && text(process.env?.FRAMER_API_KEY)) return process.env.FRAMER_API_KEY;
  return '';
}

export async function runFramerVisualProvider(input = {}, options = {}) {
  const validated = validateFramerVisualProviderRequest(input);
  if (!validated.ok) {
    return {
      ok: false,
      status: 'FRAMER_VISUAL_PROVIDER_REQUEST_BLOCKED',
      issues: validated.issues,
      production_publish: false,
      production_deploy: false,
      variable_cost_eur: 0
    };
  }

  const apiKey = credential(options);
  if (!apiKey) {
    return {
      ok: false,
      status: 'FRAMER_API_KEY_REQUIRED',
      credential_location: 'runtime_secret_only',
      credentials_in_repo: false,
      production_publish: false,
      production_deploy: false,
      variable_cost_eur: 0
    };
  }

  let framer = null;
  let disconnected = false;
  const operationResults = [];
  const aliases = new Map();
  try {
    const connect = await resolveConnect(options);
    framer = await connect(validated.request.project_url, apiKey);
    if (!framer) throw new Error('FRAMER_CONNECTION_FAILED');

    const before = await inspectFramerProject(framer, { max_depth: options.maxDepth || 7 });
    for (const operation of validated.request.operations) {
      operationResults.push(await executeOperation(framer, operation, aliases));
    }
    const after = validated.request.operations.some((operation) => MUTATING_OPERATIONS.has(text(operation.type)))
      ? await inspectFramerProject(framer, { max_depth: options.maxDepth || 7 })
      : before;

    const designContract = framerSnapshotToVisualDesignContract(after, {
      design_id: validated.request.design_id,
      project_id: validated.request.project_id,
      max_depth: options.maxDepth || 7
    });
    const contractValidation = validateVisualDesignContract(designContract);

    return {
      ok: contractValidation.ok,
      status: contractValidation.ok ? 'FRAMER_VISUAL_PROVIDER_VERIFIED' : 'FRAMER_VISUAL_CONTRACT_REVIEW_REQUIRED',
      provider: {
        id: 'framer',
        role: 'visual_specialist',
        transport: 'framer-server-api',
        project_id: after.project?.id || before.project?.id || null,
        project_name: after.project?.name || before.project?.name || null,
        credentials_in_repo: false,
        api_key_exposed: false
      },
      mode: validated.request.mode,
      operations: operationResults,
      snapshot_before: before,
      snapshot_after: after,
      design_contract: designContract,
      design_contract_validation: contractValidation,
      portability_required: true,
      native_reconstruction_required: true,
      framer_runtime_dependency_in_final_site: false,
      production_publish: false,
      production_deploy: false,
      domain_change: false,
      paid_action: false,
      variable_cost_eur: 0,
      real_customer_data: false
    };
  } catch (error) {
    return {
      ok: false,
      status: 'FRAMER_VISUAL_PROVIDER_FAILED',
      error: String(error?.message || error),
      operations: operationResults,
      credentials_in_repo: false,
      production_publish: false,
      production_deploy: false,
      variable_cost_eur: 0
    };
  } finally {
    if (framer && typeof framer.disconnect === 'function') {
      try {
        await framer.disconnect();
        disconnected = true;
      } catch {
        disconnected = false;
      }
    }
    if (typeof options.onDisconnect === 'function') options.onDisconnect(disconnected);
  }
}

export function framerLiveProviderManifest() {
  return {
    schema: 'riosystems.framer-live-visual-provider.v1',
    provider_id: 'framer',
    role: 'visual_specialist',
    transport: 'framer-server-api',
    modes: [...ALLOWED_MODES],
    allowed_operations: [...ALLOWED_OPERATIONS],
    blocked_operations: [...BLOCKED_OPERATION_NAMES],
    visual_attribute_allowlist: [...SAFE_VISUAL_ATTRIBUTES],
    credential_policy: 'FRAMER_API_KEY runtime secret only',
    provider_output_contract: 'riosystems.visual-design-contract.v1',
    native_reconstruction_required: true,
    framer_hosting_default: false,
    production_publish_allowed: false,
    production_deploy_allowed: false,
    domain_change_allowed: false,
    destructive_actions_allowed: false,
    real_customer_data_allowed: false,
    paid_actions_allowed: false,
    variable_cost_ceiling_eur: 0,
    portability_required: true
  };
}
