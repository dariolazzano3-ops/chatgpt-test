const clone = (value) => structuredClone(value ?? null);
const clean = (value, max = 4000) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const arr = (value) => Array.isArray(value) ? value : [];
const uniq = (items = []) => [...new Set(items.filter(Boolean))];

function fieldPaths(question = {}) {
  return uniq([
    ...arr(question.field_paths),
    ...arr(question.controls).map((control) => clean(control.field_path, 320)).filter(Boolean),
    clean(question.aggregate_field_path, 320)
  ]);
}

function sourceIndex(evidence = {}) {
  const map = new Map();
  const anchor = evidence.primary_anchor;
  if (anchor?.source_url) {
    map.set('primary-anchor-website', {
      source_id:'primary-anchor-website',
      source_url:anchor.source_url,
      source_role:'ANCHOR_OWNED_WEBSITE',
      entity_match_state:'ENTITY_MATCH_CONFIRMED',
      entity_match_score:1,
      fetched_at:evidence.generated_at || null,
      visible_updated_at:null
    });
  }
  for (const item of arr(evidence.discovery?.results)) {
    if (!item.project_source_id) continue;
    map.set(item.project_source_id, {
      source_id:item.project_source_id,
      source_url:item.url,
      source_role:item.source_role || null,
      entity_match_state:item.entity_match_state || null,
      entity_match_score:item.entity_match_score ?? null,
      fetched_at:item.evidence?.fetched_at || evidence.generated_at || null,
      visible_updated_at:item.evidence?.visible_updated_at || item.visible_updated_at || null
    });
  }
  return map;
}

function questionIsHumanOnly(question = {}) {
  if (question.human_only === true) return true;
  if (['ASSET_QUALITY','HUMAN_APPROVAL'].includes(clean(question.effect, 80).toUpperCase())) return true;
  if (['TARGET_CUSTOMERS','PRIMARY_CONVERSION'].includes(clean(question.id, 120).toUpperCase())) return true;
  return false;
}

export function enrichHumanQuestionsWithMultiSourceEvidence(questions = [], evidence = {}) {
  const summaries = arr(evidence.fact_corroboration?.summaries);
  const sources = sourceIndex(evidence);
  let automaticallyClosed = 0;

  const enriched = arr(questions).map((question) => {
    const paths = fieldPaths(question);
    const relevant = summaries.filter((summary) => paths.includes(summary.field_path));
    const humanOnly = questionIsHumanOnly(question);
    const hasConflict = relevant.some((summary) => summary.conflict === true || summary.classification === 'CONFLICT');
    const hasCorroborated = relevant.some((summary) => ['CORROBORATED_CANDIDATE','CONFIRMED'].includes(summary.classification));
    const allConfirmed = relevant.length > 0 && relevant.every((summary) => summary.classification === 'CONFIRMED');
    const canAutoClose = question.auto_close_when_confirmed === true && !humanOnly && allConfirmed && !hasConflict;

    let researchState = 'CONFIRMATION_REQUIRED';
    if (humanOnly) researchState = 'HUMAN_ONLY';
    else if (hasConflict) researchState = 'CONFLICT_REMAINS';
    else if (canAutoClose) researchState = 'AUTO_RESOLVED';
    else if (hasCorroborated) researchState = 'CORROBORATED_BUT_CONFIRMATION_REQUIRED';

    if (researchState === 'AUTO_RESOLVED') automaticallyClosed += 1;

    const evidenceRows = relevant.map((summary) => ({
      field_path:summary.field_path,
      classification:summary.classification,
      conflict:summary.conflict === true,
      authoritative_fact_count:Number(summary.authoritative_fact_count || 0),
      candidates:arr(summary.candidate_groups).map((group) => ({
        value:clone(group.value),
        independent_source_count:Number(group.independent_source_count || 0),
        weighted_support:Number(group.weighted_support || 0),
        freshness:clone(group.freshness || null),
        sources:arr(group.supporting_source_ids).map((id) => clone(sources.get(id) || {source_id:id}))
      }))
    }));

    const confirmationReason =
      researchState === 'HUMAN_ONLY' ? 'Diese Entscheidung bleibt menschliches Urteil und darf nicht aus beobachtetem Verhalten abgeleitet werden.'
      : researchState === 'CONFLICT_REMAINS' ? 'Mehrere eindeutig zugeordnete Quellen widersprechen sich; keine Majority-Vote-Auflösung.'
      : researchState === 'CORROBORATED_BUT_CONFIRMATION_REQUIRED' ? 'Mehrere Quellen stützen Candidate(s), aber öffentliche Evidence ersetzt keine Human-/Customer-Confirmation.'
      : researchState === 'AUTO_RESOLVED' ? 'Alle erforderlichen Felder sind bereits durch autoritative bestehende Ferrari-Facts geschlossen.'
      : 'Es liegt noch keine ausreichende autoritative Bestätigung vor.';

    return {
      ...clone(question),
      multi_source_verification:{
        research_state:researchState,
        field_paths:paths,
        evidence:evidenceRows,
        confirmation_reason:confirmationReason,
        automatic_customer_confirmation:false,
        majority_vote_used:false
      }
    };
  });

  return {
    questions:enriched.filter((question) => question.multi_source_verification.research_state !== 'AUTO_RESOLVED'),
    all_questions:enriched,
    automatically_closed:automaticallyClosed,
    remaining:enriched.filter((question) => question.multi_source_verification.research_state !== 'AUTO_RESOLVED').length,
    human_only:enriched.filter((question) => question.multi_source_verification.research_state === 'HUMAN_ONLY').map((question) => question.id),
    conflicts:enriched.filter((question) => question.multi_source_verification.research_state === 'CONFLICT_REMAINS').map((question) => question.id),
    corroborated_but_confirmation_required:enriched.filter((question) => question.multi_source_verification.research_state === 'CORROBORATED_BUT_CONFIRMATION_REQUIRED').map((question) => question.id)
  };
}

export function projectHumanQuestionMultiSourceEvidenceManifest() {
  return {
    schema:'aurentara.project-human-question-multi-source-evidence.v1',
    existing_human_questions_reused:true,
    existing_dashboard_controls_reused:true,
    evidence_only_enrichment:true,
    auto_close_requires_authoritative_confirmed_facts:true,
    human_only_preserved:true,
    majority_vote:false,
    automatic_customer_confirmation:false,
    production_deploy:false
  };
}
