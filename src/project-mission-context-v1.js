import { buildProjectMissionContext } from './project-source-intake-v1.js';

const clone = (value) => structuredClone(value ?? null);

export function compileProjectMissionContext(state = {}, input = {}) {
  const built = buildProjectMissionContext(state, input);
  if (!built.ok) return built;
  const contentPack = input.content_pack || state.content_packs?.at(-1);
  if (!contentPack) return { ok: false, error: 'PROJECT_CONTENT_PACK_REQUIRED' };
  const factById = new Map((state.facts || []).map((fact) => [fact.fact_id, fact]));
  const provenance = (contentPack.fact_refs || []).map((ref) => {
    const fact = factById.get(ref.fact_id);
    return {
      fact_id: ref.fact_id,
      field_path: ref.field_path,
      fact_version: ref.version,
      verification_status: fact?.verification_status || null,
      origin: fact?.origin || null,
      source_refs: clone(ref.source_refs || fact?.source_refs || [])
    };
  });
  return {
    ok: true,
    context: {
      ...built.context,
      content_provenance: provenance,
      provenance_complete: provenance.every((item) => item.source_refs.length > 0),
      source_of_truth: undefined
    },
    production_deploy: false
  };
}

export function projectMissionContextManifest() {
  return {
    schema: 'aurentara.project-mission-context.v1',
    git_source_of_truth_embedded: false,
    content_provenance_included: true,
    website_source_usage_included: true,
    pack_versions_required: true,
    production_deploy: false
  };
}
