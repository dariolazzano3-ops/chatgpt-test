export const J12_NEXT_BEST_ACTION_CODES = Object.freeze([
  'REVIEW_PROJECT_KNOWLEDGE',
  'CONFIRM_CONTACT_DETAILS',
  'APPROVE_PROJECT_KNOWLEDGE',
  'CREATE_REFERENCE',
  'APPROVE_REFERENCE',
  'BUILD_WEBSITE',
  'CLOSE_VISUAL_DELTA',
  'RUN_BROWSER_QUALITY',
  'CHECK_PREVIEW',
  'APPROVE_WEBSITE',
  'READY_FOR_DELIVERY_LIFECYCLE'
]);

export const J12_NEXT_BEST_ACTION_TARGETS = Object.freeze([
  'knowledge',
  'approvals',
  'webfactory',
  'preview'
]);

const arr = (v) => Array.isArray(v) ? v : [];
const clean = (v, max = 1000) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const upper = (v) => clean(v, 120).toUpperCase();
const num = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;
const clone = (v) => v == null ? v : structuredClone(v);

function action(code, label, target, reason, priority, evidence = null) {
  return {
    code,
    label,
    target,
    reason: clean(reason, 1200),
    priority,
    evidence: clone(evidence),
    operator_initiated: true,
    automatic_execution: false,
    automatic_merge: false,
    production_deploy: false,
    public_launch: false,
    external_writes: false
  };
}

function knowledgeTruth(input = {}) {
  const source = input.source || input.source_payload || {};
  const k = source?.workspace?.knowledge_review || input.knowledge || {};
  const facts = arr(source?.workspace?.sections?.project_knowledge || input.knowledge_facts);
  const status = upper(k.status || input.knowledge_status) || 'NOT_VERIFIED';
  const revision = clean(k.current_knowledge_revision || k.revision || input.knowledge_revision, 240) || null;
  const unresolved = Math.max(
    num(k.catch_net?.unresolved_count),
    num(k.conflict_count),
    num(source?.workspace?.conflict_count),
    facts.filter((f) => ['UNVERIFIED','NEEDS_REVIEW','SOURCE_CONFLICT','AMBIGUOUS'].includes(upper(f.verification_status))).length
  );
  const sourceConflicts = Math.max(
    num(k.catch_net?.counts?.source_conflicts),
    num(k.conflict_count),
    facts.filter((f) => upper(f.verification_status) === 'SOURCE_CONFLICT').length
  );
  const staged = status === 'STAGED';
  const approved = status === 'APPROVED' && Boolean(revision);
  return { status, revision, unresolved, sourceConflicts, staged, approved, evidence: clone(k) };
}

function humanInputsTruth(input = {}) {
  const closure = input.human_input_closure
    || input.source?.human_input_closure
    || input.source_payload?.human_input_closure
    || {};
  const openInputs = arr(closure.open_inputs || input.open_inputs);
  const count = Math.max(num(closure.open_input_count), openInputs.length);
  const contactInputs = openInputs.filter((item) => {
    const id = upper(item.id || item.input_id || item.field || item.code);
    const text = upper(item.question || item.label || item.reason);
    return ['CONTACT_DETAILS','CURRENT_CONTACT_DETAILS','CONTACT','PHONE','PHONE_NUMBER','EMAIL','ADDRESS'].some((token) => id.includes(token))
      || ['KONTAKT','TELEFON','PHONE','E-MAIL','EMAIL','ADRESSE','ADDRESS'].some((token) => text.includes(token));
  });
  return { closure: clone(closure), openInputs, count, contactInputs };
}

function referenceTruth(input = {}) {
  const r = input.reference || input.reference_state || {};
  const status = upper(r.status || r.state || input.reference_status) || 'NOT_VERIFIED';
  const version = clean(r.version || r.reference_version || input.reference_version, 240) || null;
  const exists = Boolean(version || r.reference_id || r.id || !['NOT_VERIFIED','MISSING','NONE'].includes(status));
  const approved = status === 'APPROVED' || r.approved === true;
  return { status, version, exists, approved, evidence: clone(r) };
}

function buildTruth(input = {}) {
  const detail = input.detail || {};
  const b = input.build || detail.build || detail.results?.build || {};
  const q = input.qa || detail.qa || detail.results?.quality || {};
  const buildId = clean(b.build_id || b.id || detail.results?.delivery?.build_id || input.build_id, 240) || null;
  const qaStatus = upper(q.status || q.qa_status) || (q.passed === true ? 'PASS' : q.passed === false ? 'FAIL' : 'NOT_VERIFIED');
  const accepted = b.accepted === true || ['PASS','ACCEPTED','KNOWN_GOOD'].includes(qaStatus);
  return { buildId, qaStatus, accepted, evidence: clone({ build: b, qa: q }) };
}

function visualTruth(input = {}) {
  const v = input.visual || input.visual_acceptance || {};
  const status = upper(v.status || v.acceptance || input.visual_status) || 'NOT_VERIFIED';
  const deltaCount = Math.max(
    num(v.delta_count),
    num(v.open_delta_count),
    arr(v.deltas).filter((d) => !['PASS','CLOSED','ACCEPTED'].includes(upper(d.status))).length
  );
  const accepted = ['PASS','ACCEPTED'].includes(status) && deltaCount === 0;
  return { status, deltaCount, accepted, evidence: clone(v) };
}

function j9Truth(input = {}) {
  const j9 = input.j9 || input.browser_accessibility_performance || {};
  const browserStatus = upper(j9.browser?.status) || 'NOT_VERIFIED';
  const performanceStatus = upper(j9.performance?.status || j9.performance?.lighthouse?.status) || 'NOT_VERIFIED';
  const accessibilityState = upper(j9.accessibility?.state || j9.accessibility?.status) || 'NOT_VERIFIED';
  const browserPass = browserStatus === 'PASS' || browserStatus === 'NOT_VERIFIED';
  const performancePass = performanceStatus === 'PASS';
  const accessibilityPass = ['PASS','AUTOMATED_PASS','HUMAN_REVIEW_PENDING','FULL_ACCEPTED'].includes(accessibilityState);
  const pass = browserPass && performancePass && accessibilityPass;
  return {
    browserStatus,
    performanceStatus,
    accessibilityState,
    pass,
    evidence: clone(j9)
  };
}

function previewTruth(input = {}) {
  const detail = input.detail || {};
  const p = input.preview || detail.project_preview_access || detail.project?.project_preview_access || {};
  const available = p.available === true || Boolean(p.url || p.preview_url || p.route || p.open_url);
  const reviewStatus = upper(p.review_status || p.human_review_status || input.preview_review_status) || 'NOT_VERIFIED';
  const reviewed = ['PASS','APPROVED','ACCEPTED','REVIEWED'].includes(reviewStatus) || p.reviewed === true;
  return {
    available,
    reviewStatus,
    reviewed,
    url: clean(p.url || p.preview_url || p.route || p.open_url, 1200) || null,
    evidence: clone(p)
  };
}

function websiteApprovalTruth(input = {}) {
  const a = input.website_approval || input.approval || {};
  const status = upper(a.status || a.state || input.website_approval_status) || 'NOT_VERIFIED';
  const approved = ['APPROVED','ACCEPTED','PASS'].includes(status) || a.approved === true;
  return { status, approved, evidence: clone(a) };
}

function projectScope(input = {}) {
  return clean(input.project?.scope_key || input.detail?.project?.scope_key || input.scope_key, 320) || null;
}

export function deriveJ12NextBestAction(input = {}) {
  const scope = projectScope(input);
  const k = knowledgeTruth(input);
  const human = humanInputsTruth(input);
  const ref = referenceTruth(input);
  const build = buildTruth(input);
  const visual = visualTruth(input);
  const j9 = j9Truth(input);
  const preview = previewTruth(input);
  const approval = websiteApprovalTruth(input);

  const trace = [];
  const consider = (candidate, condition, blockedReason = null) => {
    trace.push({
      code: candidate.code,
      priority: candidate.priority,
      eligible: Boolean(condition),
      blocked_reason: condition ? null : clean(blockedReason, 800) || null
    });
    return condition ? candidate : null;
  };

  if (!scope) {
    return {
      schema: 'riosystems.j12-next-best-action.v1',
      status: 'BLOCKED',
      project_scope: null,
      primary_action: null,
      trace: [],
      reason: 'PROJECT_SCOPE_REQUIRED',
      exactly_one_primary_action: false,
      automatic_execution: false,
      production_deploy: false,
      external_writes: false
    };
  }

  const candidates = [];

  candidates.push(consider(
    action(
      'REVIEW_PROJECT_KNOWLEDGE',
      k.unresolved > 0 ? String(k.unresolved) + ' Angaben prüfen' : 'Projektwissen prüfen',
      'knowledge',
      k.sourceConflicts > 0 ? 'Project Knowledge contains source conflicts.' : 'Project Knowledge contains unresolved or unverified items.',
      10,
      { knowledge_status: k.status, knowledge_revision: k.revision, unresolved: k.unresolved, source_conflicts: k.sourceConflicts }
    ),
    k.unresolved > 0,
    'No unresolved Project Knowledge items.'
  ));

  candidates.push(consider(
    action(
      'CONFIRM_CONTACT_DETAILS',
      human.contactInputs.length > 1 ? String(human.contactInputs.length) + ' Kontaktdaten bestätigen' : 'Kontaktdaten bestätigen',
      'approvals',
      'A contact-related human input is still open and can affect conversion/content truth.',
      20,
      { contact_inputs: human.contactInputs, open_input_count: human.count }
    ),
    human.contactInputs.length > 0,
    'No open contact-details input.'
  ));

  candidates.push(consider(
    action(
      'REVIEW_PROJECT_KNOWLEDGE',
      human.count > 0 ? String(human.count) + ' Kundenangabe' + (human.count === 1 ? '' : 'n') + ' prüfen' : 'Projektwissen prüfen',
      'approvals',
      'Human project inputs remain unresolved.',
      30,
      { open_inputs: human.openInputs, open_input_count: human.count }
    ),
    human.count > 0,
    'No open human project inputs.'
  ));

  candidates.push(consider(
    action(
      'APPROVE_PROJECT_KNOWLEDGE',
      'Projektwissen bereitstellen',
      'knowledge',
      'Knowledge review is staged/clear but no approved Knowledge revision exists yet.',
      40,
      { knowledge_status: k.status, knowledge_revision: k.revision }
    ),
    !k.approved && (k.staged || (k.unresolved === 0 && ['IN_REVIEW','CHANGES_PENDING','READY'].includes(k.status))),
    k.approved ? 'Knowledge already approved.' : 'Knowledge is not staged/ready.'
  ));

  candidates.push(consider(
    action(
      'CREATE_REFERENCE',
      'Reference erstellen',
      'webfactory',
      'Approved Project Knowledge exists but no Reference exists.',
      50,
      { knowledge_revision: k.revision, reference_status: ref.status }
    ),
    k.approved && !ref.exists,
    !k.approved ? 'Approved Knowledge revision required.' : 'Reference already exists.'
  ));

  candidates.push(consider(
    action(
      'APPROVE_REFERENCE',
      'Reference freigeben',
      'webfactory',
      'A Reference exists but is not yet approved.',
      60,
      { reference_status: ref.status, reference_version: ref.version }
    ),
    k.approved && ref.exists && !ref.approved,
    !k.approved ? 'Approved Knowledge revision required.' : (ref.approved ? 'Reference already approved.' : 'No Reference exists.')
  ));

  candidates.push(consider(
    action(
      'BUILD_WEBSITE',
      'Website bauen',
      'webfactory',
      'Approved Knowledge and Approved Reference exist; no accepted build is available.',
      70,
      { knowledge_revision: k.revision, reference_version: ref.version, build_id: build.buildId, qa_status: build.qaStatus }
    ),
    k.approved && ref.approved && !build.accepted,
    !k.approved || !ref.approved ? 'Approved Knowledge + Approved Reference required.' : 'Accepted build already exists.'
  ));

  candidates.push(consider(
    action(
      'CLOSE_VISUAL_DELTA',
      visual.deltaCount > 0 ? String(visual.deltaCount) + ' Visual Delta' + (visual.deltaCount === 1 ? '' : 's') + ' schließen' : 'Visual Delta schließen',
      'webfactory',
      'Accepted build exists but visual closure is not accepted.',
      80,
      { build_id: build.buildId, visual_status: visual.status, open_delta_count: visual.deltaCount }
    ),
    build.accepted && ref.approved && !visual.accepted,
    !build.accepted || !ref.approved ? 'Accepted Build + Approved Reference required.' : 'Visual closure already accepted.'
  ));

  candidates.push(consider(
    action(
      'RUN_BROWSER_QUALITY',
      'Browser-Qualität prüfen',
      'webfactory',
      'Visual closure is accepted but J9 browser/accessibility/performance acceptance is not complete.',
      90,
      {
        browser_status: j9.browserStatus,
        performance_status: j9.performanceStatus,
        accessibility_state: j9.accessibilityState
      }
    ),
    visual.accepted && !j9.pass,
    !visual.accepted ? 'Visual acceptance required first.' : 'J9 already accepted.'
  ));

  candidates.push(consider(
    action(
      'CHECK_PREVIEW',
      preview.available ? 'Preview prüfen' : 'Preview bereitstellen und prüfen',
      'preview',
      preview.available ? 'Private Preview exists but human preview review is not accepted.' : 'Accepted technical state exists but no private Preview is available.',
      100,
      { available: preview.available, review_status: preview.reviewStatus, url: preview.url }
    ),
    visual.accepted && j9.pass && (!preview.available || !preview.reviewed),
    !visual.accepted || !j9.pass ? 'Visual + J9 acceptance required first.' : 'Preview already reviewed.'
  ));

  candidates.push(consider(
    action(
      'APPROVE_WEBSITE',
      'Website freigeben',
      'approvals',
      'Preview is reviewed and technical gates are accepted; final website approval is still open.',
      110,
      { preview_review_status: preview.reviewStatus, website_approval_status: approval.status }
    ),
    visual.accepted && j9.pass && preview.available && preview.reviewed && !approval.approved,
    !preview.reviewed ? 'Reviewed Preview required.' : 'Website already approved.'
  ));

  candidates.push(consider(
    action(
      'READY_FOR_DELIVERY_LIFECYCLE',
      'Bereit für Delivery Lifecycle',
      'webfactory',
      'Knowledge, Reference, Build, Visual, J9, Preview and website approval gates are complete.',
      120,
      {
        knowledge_revision: k.revision,
        reference_version: ref.version,
        build_id: build.buildId,
        preview_url: preview.url,
        website_approval_status: approval.status
      }
    ),
    k.approved && ref.approved && build.accepted && visual.accepted && j9.pass && preview.available && preview.reviewed && approval.approved,
    'One or more pre-delivery gates remain incomplete.'
  ));

  const eligible = candidates.filter(Boolean).sort((a, b) => a.priority - b.priority);
  const primary = eligible[0] || action(
    'REVIEW_PROJECT_KNOWLEDGE',
    'Projektwissen prüfen',
    'knowledge',
    'No deterministic downstream action can be proven from the current evidence.',
    999,
    { knowledge_status: k.status }
  );

  const traceWithSelection = trace.map((row) => ({
    ...row,
    selected: row.code === primary.code && row.priority === primary.priority
  }));

  return {
    schema: 'riosystems.j12-next-best-action.v1',
    status: 'READY',
    project_scope: scope,
    primary_action: primary,
    trace: traceWithSelection,
    eligible_action_count: eligible.length,
    exactly_one_primary_action: true,
    button_wall_forbidden: true,
    primary_button_count: 1,
    deterministic_priority: true,
    evidence_snapshot: {
      knowledge: {
        status: k.status,
        revision: k.revision,
        unresolved: k.unresolved,
        source_conflicts: k.sourceConflicts
      },
      human_inputs: {
        open_count: human.count,
        contact_open_count: human.contactInputs.length
      },
      reference: {
        status: ref.status,
        version: ref.version,
        approved: ref.approved
      },
      build: {
        build_id: build.buildId,
        qa_status: build.qaStatus,
        accepted: build.accepted
      },
      visual: {
        status: visual.status,
        delta_count: visual.deltaCount,
        accepted: visual.accepted
      },
      j9: {
        browser_status: j9.browserStatus,
        performance_status: j9.performanceStatus,
        accessibility_state: j9.accessibilityState,
        pass: j9.pass
      },
      preview: {
        available: preview.available,
        review_status: preview.reviewStatus,
        reviewed: preview.reviewed
      },
      website_approval: {
        status: approval.status,
        approved: approval.approved
      }
    },
    automatic_execution: false,
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

export function j12NextBestActionManifest() {
  return {
    schema: 'riosystems.j12-next-best-action-manifest.v1',
    action_codes: [...J12_NEXT_BEST_ACTION_CODES],
    targets: [...J12_NEXT_BEST_ACTION_TARGETS],
    surfaces: [
      'PROJECT_KNOWLEDGE_REVIEW',
      'CONTACT_CONFIRMATION',
      'REFERENCE_CREATION',
      'REFERENCE_APPROVAL',
      'BUILD',
      'VISUAL_DELTA_CLOSURE',
      'BROWSER_QUALITY',
      'PREVIEW_CHECK',
      'WEBSITE_APPROVAL',
      'DELIVERY_LIFECYCLE_HANDOFF'
    ],
    exactly_one_primary_action: true,
    button_wall_forbidden: true,
    deterministic_priority: true,
    existing_project_truth_reused: true,
    existing_knowledge_truth_reused: true,
    existing_reference_truth_reused: true,
    existing_visual_truth_reused: true,
    existing_j9_truth_reused: true,
    existing_preview_truth_reused: true,
    existing_approval_truth_reused: true,
    automatic_execution: false,
    automatic_merge: false,
    production_deploy: false,
    public_launch: false,
    dns_change: false,
    billing_activation: false,
    automatic_paid_activation: false,
    external_writes: false
  };
}
