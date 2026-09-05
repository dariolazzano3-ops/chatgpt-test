import { buildProjectKnowledgeReviewView } from './project-source-knowledge-review-v1.js';
import { effectiveProjectWebsiteUsage } from './project-source-intake-v1.js';

const clone = (value) => structuredClone(value ?? null);

export function buildProjectSourceIntakeWorkspaceSections(intakeState = {}) {
  if (intakeState?.schema !== 'aurentara.project-source-intake.v1') {
    return {
      ok: true,
      schema: 'aurentara.project-source-intake-workspace.v1',
      status: 'NOT_INITIALIZED',
      sections: { project_sources: [], project_knowledge: [], content_readiness: null },
      actions: ['ADD_WEBSITE', 'UPLOAD_FILE', 'UPLOAD_IMAGE_LOGO', 'ADD_MANUAL_INFORMATION'],
      production_deploy: false
    };
  }
  const latestReadiness = intakeState.readiness_snapshots?.at(-1) || null;
  return {
    ok: true,
    schema: 'aurentara.project-source-intake-workspace.v1',
    scope_key: intakeState.scope_key,
    status: latestReadiness?.status || 'INTAKE_IN_PROGRESS',
    knowledge_review: buildProjectKnowledgeReviewView(intakeState),
    sections: {
      project_sources: clone((intakeState.sources || []).filter((source) => !source.deleted_at).map((source) => {
        if (!['OWNED_WEBSITE', 'REFERENCE_WEBSITE'].includes(source.source_type)) return source;
        const usage = effectiveProjectWebsiteUsage(source);
        return { ...source, rights_status: usage.rights_status, website_usage: usage.usage, effective_usage: usage.effective_usage, website_usage_state: usage.usage_state };
      })),
      project_knowledge: clone((intakeState.facts || []).map((fact) => ({
        fact_id: fact.fact_id,
        field_path: fact.field_path,
        value: fact.value,
        origin: fact.origin,
        verification_status: fact.verification_status,
        source_refs: fact.source_refs,
        confidence: fact.confidence,
        critical: fact.critical === true,
        version: fact.version
      }))),
      content_readiness: clone(latestReadiness)
    },
    conflict_count: (intakeState.facts || []).filter((fact) => fact.verification_status === 'SOURCE_CONFLICT').length,
    actions: ['ADD_WEBSITE', 'UPLOAD_FILE', 'UPLOAD_IMAGE_LOGO', 'ADD_MANUAL_INFORMATION', 'AI_ORGANIZE_PROJECT_KNOWLEDGE', 'EDIT_KNOWLEDGE_REVIEW', 'APPROVE_KNOWLEDGE_FOR_USE', 'CONFIRM_FACT', 'REJECT_FACT', 'CONFIRM_TRUSTED_BASELINE', 'CREATE_CONTENT_PACK', 'CREATE_VISUAL_PACK', 'EVALUATE_CONTENT_READINESS'],
    dashboard_redesign: false,
    paid_provider_calls: 0,
    variable_cost_eur: 0,
    production_deploy: false
  };
}
