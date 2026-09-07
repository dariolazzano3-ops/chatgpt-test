export const J11_CONTROL_FIELDS = Object.freeze([
  'BUILD_PROFILE',
  'JAGUAR_VERSION',
  'KNOWLEDGE_REVISION',
  'REFERENCE',
  'VISUAL_SCORE',
  'BUILD_QA',
  'PERFORMANCE',
  'ACCESSIBILITY',
  'PREVIEW',
  'COST',
  'DELIVERY_STATE'
]);

export const J11_CONTROL_ACTIONS = Object.freeze([
  'SKETCH',
  'REFERENCE',
  'VARIANT',
  'APPROVAL',
  'BUILD',
  'VISUAL_QA',
  'DELTA_CLOSURE',
  'REBUILD',
  'PREVIEW',
  'CHANGES',
  'DELIVERY'
]);

export const J11_ACTION_STATES = Object.freeze([
  'AVAILABLE',
  'BLOCKED',
  'REVIEW_REQUIRED',
  'NOT_VERIFIED'
]);

const clean = (v, max = 1000) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const upper = (v) => clean(v, 120).toUpperCase();
const num = (v) => Number.isFinite(Number(v)) ? Number(v) : null;
const clone = (v) => v == null ? v : structuredClone(v);

function boolStatus(v) {
  if (v === true) return 'PASS';
  if (v === false) return 'FAIL';
  const s = upper(v);
  if (['PASS', 'FAIL', 'BLOCK', 'BLOCKED', 'READY', 'AVAILABLE', 'APPROVED', 'ACCEPTED', 'NOT_VERIFIED', 'PENDING', 'REVIEW_REQUIRED', 'HUMAN_REVIEW_PENDING'].includes(s)) return s;
  return 'NOT_VERIFIED';
}

function field(id, label, value, status = 'NOT_VERIFIED', evidence = null, detail = null) {
  return {
    id,
    label,
    value: value == null || value === '' ? 'NOT_VERIFIED' : value,
    status: status || 'NOT_VERIFIED',
    evidence: clone(evidence),
    detail: clone(detail)
  };
}

function action(id, label, state, target, reason, command = null) {
  const normalized = J11_ACTION_STATES.includes(state) ? state : 'NOT_VERIFIED';
  return {
    id,
    label,
    state: normalized,
    target,
    reason: clean(reason, 1000) || null,
    command: command ? clone(command) : null,
    automatic_execution: false,
    operator_initiated: true,
    production_deploy: false,
    external_writes: false
  };
}

function sourceKnowledgeRevision(source = {}) {
  return clean(
    source?.workspace?.knowledge_review?.current_knowledge_revision
      || source?.workspace?.knowledge_revision?.revision
      || source?.knowledge_revision
      || source?.current_knowledge_revision,
    240
  ) || null;
}

function knowledgeStatus(source = {}) {
  return upper(
    source?.workspace?.knowledge_review?.status
      || source?.knowledge_status
      || source?.status
  ) || 'NOT_VERIFIED';
}

function referenceTruth(input = {}) {
  const r = input.reference || input.reference_state || {};
  const status = upper(r.status || r.state || input.reference_status) || 'NOT_VERIFIED';
  const version = clean(r.version || r.reference_version || input.reference_version, 160) || null;
  const approved = status === 'APPROVED' || r.approved === true;
  return { status, version, approved };
}

function visualTruth(input = {}) {
  const v = input.visual || input.visual_acceptance || {};
  const score = num(v.score ?? v.visual_score ?? input.visual_score);
  const status = upper(v.status || v.acceptance || input.visual_status) || (score != null ? 'MEASURED' : 'NOT_VERIFIED');
  return { score, status, evidence: clone(v.evidence || null) };
}

function j9Truth(input = {}) {
  const j9 = input.j9 || input.browser_accessibility_performance || {};
  const performance = j9.performance || input.performance || {};
  const accessibility = j9.accessibility || input.accessibility || {};
  const pScore = num(performance.lighthouse?.performance ?? performance.score ?? performance.performance);
  const pStatus = upper(performance.status || performance.lighthouse?.status) || (pScore != null ? 'MEASURED' : 'NOT_VERIFIED');
  const aState = upper(accessibility.state || accessibility.status) || 'NOT_VERIFIED';
  const axeCritical = num(accessibility.axe?.critical);
  const axeSerious = num(accessibility.axe?.serious);
  return {
    performance: { score: pScore, status: pStatus, evidence: clone(performance) },
    accessibility: { state: aState, axeCritical, axeSerious, evidence: clone(accessibility) }
  };
}

function buildTruth(input = {}) {
  const d = input.detail || {};
  const build = input.build || d.build || d.results?.build || {};
  const qa = input.qa || d.qa || d.results?.quality || {};
  const buildId = clean(build.build_id || build.id || d.results?.delivery?.build_id || input.build_id, 240) || null;
  const profile = clean(
    input.build_profile
      || build.profile
      || build.build_profile
      || d.project?.build_profile
      || d.project?.quality_level,
    160
  ) || null;
  const qaStatus = upper(qa.status || qa.qa_status) || (qa.passed === true ? 'PASS' : qa.passed === false ? 'FAIL' : 'NOT_VERIFIED');
  const accepted = ['PASS', 'ACCEPTED', 'KNOWN_GOOD'].includes(qaStatus) || build.accepted === true;
  return { buildId, profile, qaStatus, accepted, evidence: clone({ build, qa }) };
}

function previewTruth(input = {}) {
  const d = input.detail || {};
  const p = input.preview || d.project_preview_access || d.project?.project_preview_access || {};
  const available = p.available === true || Boolean(p.url || p.preview_url || p.route || p.open_url);
  const url = clean(p.url || p.preview_url || p.route || p.open_url, 1200) || null;
  const status = upper(p.status) || (available ? 'AVAILABLE' : 'NOT_AVAILABLE');
  return { available, url, status, evidence: clone(p) };
}

function deliveryTruth(input = {}) {
  const d = input.detail || {};
  const delivery = input.delivery || d.delivery || d.results?.delivery || {};
  const status = upper(
    delivery.status
      || delivery.state
      || input.delivery_state
      || (delivery.ready === true ? 'READY' : '')
  ) || 'NOT_VERIFIED';
  const ready = delivery.ready === true || ['READY', 'PASS', 'ACCEPTED', 'DELIVERY_READY'].includes(status);
  return { status, ready, evidence: clone(delivery) };
}

function costTruth(input = {}) {
  const p = input.project || input.detail?.project || {};
  const value = num(
    input.cost_eur
      ?? p.current_cost_eur
      ?? p.variable_cost_eur
      ?? p.budget_cost_units
      ?? input.detail?.current_cost_eur
  );
  return {
    value,
    status: value == null ? 'NOT_VERIFIED' : 'MEASURED'
  };
}

function jaguarVersion(input = {}) {
  return clean(
    input.jaguar_version
      || input.jaguar?.version
      || input.webfactory_version
      || input.system?.jaguar_version,
    160
  ) || null;
}

export function deriveJ11ActionMatrix(input = {}) {
  const source = input.source || input.source_payload || {};
  const kStatus = knowledgeStatus(source);
  const kRevision = sourceKnowledgeRevision(source);
  const knowledgeReady = ['APPROVED', 'READY'].includes(kStatus) && Boolean(kRevision);
  const ref = referenceTruth(input);
  const visual = visualTruth(input);
  const j9 = j9Truth(input);
  const build = buildTruth(input);
  const preview = previewTruth(input);
  const delivery = deliveryTruth(input);
  const hasProject = Boolean(clean(input.project?.scope_key || input.detail?.project?.scope_key || input.scope_key, 320));
  const impact = upper(input.change_impact?.action || input.j10?.impact?.action);
  const visualAccepted = ['PASS', 'ACCEPTED'].includes(visual.status);
  const j9Pass = ['PASS', 'FULL_ACCEPTED', 'AUTOMATED_PASS', 'HUMAN_REVIEW_PENDING'].includes(j9.accessibility.state)
    && ['PASS', 'MEASURED'].includes(j9.performance.status);

  const actions = [
    action(
      'SKETCH',
      'Sketch',
      hasProject ? 'AVAILABLE' : 'BLOCKED',
      'reference',
      hasProject ? 'Project scope available for sketch preparation.' : 'Project scope required.',
      { capability: 'web.reference.studio.v1', operation: 'sketch' }
    ),
    action(
      'REFERENCE',
      'Reference',
      knowledgeReady ? (ref.approved ? 'AVAILABLE' : 'REVIEW_REQUIRED') : 'BLOCKED',
      'reference',
      knowledgeReady
        ? (ref.approved ? 'Approved reference exists; reference inspection/iteration remains available.' : 'Knowledge is ready; reference approval is still required.')
        : 'Approved project knowledge revision required before reference approval.',
      { capability: 'web.reference.studio.v1' }
    ),
    action(
      'VARIANT',
      'Variant',
      ref.approved ? 'AVAILABLE' : 'BLOCKED',
      'reference',
      ref.approved ? 'Approved reference can seed bounded variants.' : 'Approved reference required.',
      { capability: 'web.reference.studio.v1', operation: 'variant' }
    ),
    action(
      'APPROVAL',
      'Approval',
      ref.approved ? 'AVAILABLE' : (knowledgeReady ? 'REVIEW_REQUIRED' : 'BLOCKED'),
      'approvals',
      ref.approved ? 'Approval hub available.' : (knowledgeReady ? 'Reference review/approval required.' : 'Knowledge is not ready.'),
      null
    ),
    action(
      'BUILD',
      'Build',
      knowledgeReady && ref.approved ? 'AVAILABLE' : 'BLOCKED',
      'implementation',
      knowledgeReady && ref.approved ? 'Knowledge and reference gates are ready.' : 'Approved Knowledge + Approved Reference required.',
      { capability: 'web.os.v2.build' }
    ),
    action(
      'VISUAL_QA',
      'Visual QA',
      build.accepted && ref.approved ? 'AVAILABLE' : 'BLOCKED',
      'implementation',
      build.accepted && ref.approved ? 'Accepted build and approved reference are available.' : 'Accepted build + Approved Reference required.',
      { capability: 'web.visual.closure.v1', operation: 'run' }
    ),
    action(
      'DELTA_CLOSURE',
      'Delta Closure',
      build.accepted && ref.approved && !visualAccepted ? 'AVAILABLE' : (visualAccepted ? 'AVAILABLE' : 'BLOCKED'),
      'implementation',
      build.accepted && ref.approved
        ? (visualAccepted ? 'Visual closure is accepted; revalidation remains available.' : 'Visual closure can run against the approved reference.')
        : 'Accepted build + Approved Reference required.',
      { capability: 'web.visual.closure.v1', operation: 'run' }
    ),
    action(
      'REBUILD',
      'Rebuild',
      ['PARTIAL_REBUILD', 'FULL_REBUILD'].includes(impact) ? 'AVAILABLE' : (impact ? 'BLOCKED' : 'NOT_VERIFIED'),
      'implementation',
      ['PARTIAL_REBUILD', 'FULL_REBUILD'].includes(impact)
        ? 'J10 change-impact requires rebuild.'
        : (impact ? 'J10 impact does not require rebuild.' : 'J10 change-impact decision not available.'),
      { capability: 'web.versioning.rollback.v1', operation: 'impact' }
    ),
    action(
      'PREVIEW',
      'Preview',
      preview.available ? 'AVAILABLE' : (build.accepted ? 'REVIEW_REQUIRED' : 'BLOCKED'),
      'preview',
      preview.available ? 'Private preview is available.' : (build.accepted ? 'Build is accepted; preview materialization is pending.' : 'Accepted build required.'),
      null
    ),
    action(
      'CHANGES',
      'Changes',
      hasProject ? 'AVAILABLE' : 'BLOCKED',
      'activity',
      hasProject ? 'Change request can be prepared against the current project scope.' : 'Project scope required.',
      { capability: 'web.versioning.rollback.v1', operation: 'impact' }
    ),
    action(
      'DELIVERY',
      'Delivery',
      delivery.ready && visualAccepted && j9Pass && preview.available ? 'AVAILABLE' : 'BLOCKED',
      'approvals',
      delivery.ready && visualAccepted && j9Pass && preview.available
        ? 'Delivery prerequisites are evidence-backed.'
        : 'Delivery requires ready delivery state + visual acceptance + J9 acceptance + preview.',
      null
    )
  ];

  return {
    schema: 'riosystems.j11-webfactory-action-matrix.v1',
    actions,
    available: actions.filter((x) => x.state === 'AVAILABLE').map((x) => x.id),
    blocked: actions.filter((x) => x.state === 'BLOCKED').map((x) => x.id),
    review_required: actions.filter((x) => x.state === 'REVIEW_REQUIRED').map((x) => x.id),
    not_verified: actions.filter((x) => x.state === 'NOT_VERIFIED').map((x) => x.id),
    automatic_execution: false,
    production_deploy: false,
    external_writes: false
  };
}

export function createJ11WebFactoryControlPlane(input = {}) {
  const project = input.project || input.detail?.project || {};
  const source = input.source || input.source_payload || {};
  const ref = referenceTruth(input);
  const visual = visualTruth(input);
  const j9 = j9Truth(input);
  const build = buildTruth(input);
  const preview = previewTruth(input);
  const delivery = deliveryTruth(input);
  const cost = costTruth(input);
  const kRevision = sourceKnowledgeRevision(source);
  const kStatus = knowledgeStatus(source);
  const version = jaguarVersion(input);
  const scope = clean(project.scope_key || input.scope_key, 320) || null;

  const fields = [
    field('BUILD_PROFILE', 'Build Profile', build.profile, build.profile ? 'VERIFIED' : 'NOT_VERIFIED', build.evidence),
    field('JAGUAR_VERSION', 'Jaguar Version', version, version ? 'VERIFIED' : 'NOT_VERIFIED', input.jaguar || null),
    field(
      'KNOWLEDGE_REVISION',
      'Knowledge Revision',
      kRevision,
      kRevision ? kStatus : 'NOT_VERIFIED',
      source?.workspace?.knowledge_review || null
    ),
    field(
      'REFERENCE',
      'Reference',
      ref.version ? ref.status + ' · ' + ref.version : ref.status,
      ref.status,
      input.reference || null,
      { status: ref.status, version: ref.version, approved: ref.approved }
    ),
    field(
      'VISUAL_SCORE',
      'Visual Score',
      visual.score == null ? null : visual.score,
      visual.status,
      visual.evidence
    ),
    field(
      'BUILD_QA',
      'Build / QA',
      build.buildId ? build.qaStatus + ' · ' + build.buildId : build.qaStatus,
      build.qaStatus,
      build.evidence,
      { build_id: build.buildId, accepted: build.accepted }
    ),
    field(
      'PERFORMANCE',
      'Performance',
      j9.performance.score == null ? null : Math.round(j9.performance.score * 100) + ' %',
      j9.performance.status,
      j9.performance.evidence
    ),
    field(
      'ACCESSIBILITY',
      'Accessibility',
      j9.accessibility.state,
      j9.accessibility.state,
      j9.accessibility.evidence,
      { axe_critical: j9.accessibility.axeCritical, axe_serious: j9.accessibility.axeSerious }
    ),
    field(
      'PREVIEW',
      'Preview',
      preview.available ? (preview.url || 'AVAILABLE') : preview.status,
      preview.status,
      preview.evidence
    ),
    field(
      'COST',
      'Cost',
      cost.value == null ? null : Number(cost.value.toFixed(4)),
      cost.status,
      null,
      { currency: 'EUR' }
    ),
    field(
      'DELIVERY_STATE',
      'Delivery State',
      delivery.status,
      delivery.status,
      delivery.evidence,
      { ready: delivery.ready }
    )
  ];

  const byId = Object.fromEntries(fields.map((x) => [x.id, x]));
  const actions = deriveJ11ActionMatrix(input);
  const notVerifiedFields = fields.filter((x) => x.status === 'NOT_VERIFIED' || x.value === 'NOT_VERIFIED').map((x) => x.id);
  const blockers = [];
  if (!scope) blockers.push({ code: 'J11_PROJECT_SCOPE_REQUIRED', severity: 'BLOCK' });
  if (!kRevision) blockers.push({ code: 'J11_KNOWLEDGE_REVISION_NOT_VERIFIED', severity: 'INFO' });
  if (!ref.approved) blockers.push({ code: 'J11_APPROVED_REFERENCE_NOT_VERIFIED', severity: 'INFO' });

  return {
    schema: 'riosystems.j11-webfactory-control-plane.v1',
    project_scope: scope,
    project_name: clean(project.name || project.project_id, 320) || null,
    status: scope ? 'READY' : 'BLOCKED',
    fields,
    field_map: byId,
    actions,
    technical_drawer: {
      enabled: true,
      default_open: false,
      sections: [
        { id: 'PROJECT', title: 'Project Truth', payload: clone(project) },
        { id: 'KNOWLEDGE', title: 'Knowledge Truth', payload: clone(source?.workspace?.knowledge_review || null) },
        { id: 'REFERENCE', title: 'Reference Truth', payload: clone(input.reference || null) },
        { id: 'J9', title: 'Browser / Accessibility / Performance', payload: clone(input.j9 || input.browser_accessibility_performance || null) },
        { id: 'J10', title: 'Versioning / Diff / Rollback', payload: clone(input.j10 || null) },
        { id: 'BUILD', title: 'Build / QA Truth', payload: clone(build.evidence) },
        { id: 'PREVIEW', title: 'Preview Truth', payload: clone(preview.evidence) },
        { id: 'DELIVERY', title: 'Delivery Truth', payload: clone(delivery.evidence) }
      ]
    },
    not_verified_fields: notVerifiedFields,
    blockers,
    no_fake_pass: true,
    missing_evidence_stays_not_verified: true,
    duplicate_runtime_truth: false,
    automatic_action_execution: false,
    automatic_merge: false,
    production_deploy: false,
    public_launch: false,
    dns_change: false,
    billing_activation: false,
    automatic_paid_activation: false,
    external_writes: false,
    variable_cost_eur: 0
  };
}

export function j11WebFactoryControlPlaneManifest() {
  return {
    schema: 'riosystems.j11-webfactory-control-plane-manifest.v1',
    fields: [...J11_CONTROL_FIELDS],
    actions: [...J11_CONTROL_ACTIONS],
    action_states: [...J11_ACTION_STATES],
    existing_project_truth_reused: true,
    existing_knowledge_truth_reused: true,
    existing_reference_studio_reused: true,
    existing_visual_foundry_reused: true,
    existing_j9_acceptance_reused: true,
    existing_j10_versioning_reused: true,
    existing_preview_engine_reused: true,
    existing_approval_hub_reused: true,
    duplicate_runtime_truth: false,
    missing_evidence_stays_not_verified: true,
    technical_detail_drawer: true,
    automatic_action_execution: false,
    automatic_merge: false,
    production_deploy: false,
    public_launch: false,
    dns_change: false,
    billing_activation: false,
    automatic_paid_activation: false,
    external_writes: false
  };
}
