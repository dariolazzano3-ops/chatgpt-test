import { createMission } from './orchestration-state.js';
import { buildOrchestrationPlan } from './orchestration-planner.js';
import { buildSourceOfTruth } from './source-of-truth.js';

const clean = (value, max = 4000) => String(value || '').trim().slice(0, max);
const lower = (value) => clean(value).toLowerCase();
const clone = (value) => structuredClone(value ?? null);

function businessContract(task, prompt, project) {
  const text = lower(prompt); const operations = [];
  const crmRequested = /crm|kunden|lead|vertrieb|sales/.test(text); const leadRequested = /lead|kontakt|anfrage/.test(text); const offerRequested = /angebot|offer|quote/.test(text); const name = clean(project, 120) || 'Mission';
  if (crmRequested) operations.push({ id: 'crm', type: 'define_crm', config: { name: `${name} CRM`, entity: 'lead', external_write: false } });
  if (leadRequested) operations.push({ id: 'lead-fields', type: 'define_lead_fields', config: { fields: ['name', 'email', 'phone', 'source', 'status'] } });
  if (crmRequested || /pipeline|vertrieb|sales/.test(text)) operations.push({ id: 'pipeline', type: 'configure_pipeline', config: { stages: ['new', 'qualified', 'proposal', 'won', 'lost'] } });
  if (offerRequested) operations.push({ id: 'offer-flow', type: 'define_offer_flow', config: { stages: ['draft', 'review', 'sent', 'accepted'], external_write: false } });
  if (!operations.length) operations.push({ id: 'process-map', type: 'map_business_process', config: { goal: task.goal, external_write: false } });
  return { goal: task.goal, operations, metadata: { compiler: 'mission-compiler-v4.10', external_writes: false } };
}
function automationContract(task, prompt) {
  const text = lower(prompt); const incomingLeadFlow = /eingehende? leads?|lead.*automat|automat.*lead|lead.?flow/.test(text); const apiIntent = /api|webhook|integration|verbinde|connect/.test(text);
  const workflowSpec = { goal: task.goal, trigger: incomingLeadFlow ? 'incoming_lead' : 'mission_dependency_ready', dependency_handoff: true, intended_integration: apiIntent || incomingLeadFlow, external_activation_required: apiIntent || incomingLeadFlow, external_execution_authorized: false };
  return { goal: task.goal, steps: [{ id: 'compile-workflow-spec', type: 'transform', config: { mode: 'set', field: 'automation_spec', value: workflowSpec } }, { id: 'mark-supervised', type: 'transform', config: { mode: 'set', field: 'supervised_activation_required', value: workflowSpec.external_activation_required } }], metadata: { compiler: 'mission-compiler-v4.10', external_side_effects: false } };
}
function activationRequirements(mission, prompt, projectContext) {
  const text = lower(prompt); const requirements = [];
  for (const task of mission.tasks) { const engine = ['web', 'automation', 'ai', 'business'].includes(task.domain) ? task.domain : task.engine; requirements.push({ engine, task_id: task.task_id, adapter_dispatch_approval_required: true, production_deploy: false }); }
  if (mission.tasks.some((task) => task.domain === 'ai')) requirements.push({ engine: 'ai', type: 'provider_activation', required: true, reason: 'AI execution requires an injected provider runner and separate provider cost/credential approval.' });
  if (mission.tasks.some((task) => task.domain === 'automation') && /api|webhook|integration|verbinde|connect|eingehende? leads?/.test(text)) requirements.push({ engine: 'automation', type: 'external_integration_activation', required: true, reason: 'The compiled workflow is safe/local until an explicitly approved integration transport and policy are supplied.' });
  if (mission.tasks.some((task) => task.domain === 'business') && /crm|kunden|lead/.test(text)) requirements.push({ engine: 'business', type: 'external_crm_write_activation', required: true, reason: 'Business Factory currently creates the CRM configuration locally; real CRM writes remain disabled.' });
  if (projectContext) requirements.push({ engine: 'global', type: 'project_content_readiness', required: true, readiness_status: projectContext.readiness_ref?.status || 'UNKNOWN', knowledge_revision: projectContext.knowledge_revision, reason: 'Project Source Intake readiness and immutable pack bindings are required before execution.' });
  return requirements;
}
function validateProjectContext(context, input = {}) {
  if (!context) return { ok: true, context: null };
  if (context.schema !== 'aurentara.project-mission-context.v1' || !context.project?.scope_key || !context.content_pack_ref || !context.visual_pack_ref || !context.readiness_ref) return { ok: false, error: 'PROJECT_MISSION_CONTEXT_INVALID' };
  const revision = Number(context.knowledge_revision); if (!Number.isInteger(revision) || revision < 1) return { ok: false, error: 'PROJECT_MISSION_CONTEXT_REVISION_INVALID' };
  if ([context.content_pack_ref.knowledge_revision, context.visual_pack_ref.knowledge_revision, context.readiness_ref.knowledge_revision].some((value) => Number(value) !== revision)) return { ok: false, error: 'PROJECT_MISSION_CONTEXT_STALE_PACK_OR_READINESS' };
  if (input.scope_key && clean(input.scope_key, 320) !== context.project.scope_key) return { ok: false, error: 'PROJECT_MISSION_CONTEXT_SCOPE_MISMATCH' };
  if (input.customer_id && clean(input.customer_id, 160) !== context.project.customer_id) return { ok: false, error: 'PROJECT_MISSION_CONTEXT_CUSTOMER_MISMATCH' };
  if (input.project_id && clean(input.project_id, 160) !== context.project.project_id) return { ok: false, error: 'PROJECT_MISSION_CONTEXT_PROJECT_MISMATCH' };
  return { ok: true, context: clone(context) };
}

export function compileMissionPackage(input = {}) {
  const prompt = clean(input.prompt || input.request || input.goal); if (!prompt) return { ok: false, error: 'MISSION_PROMPT_REQUIRED' };
  const projectContextResult = validateProjectContext(input.project_context, input); if (!projectContextResult.ok) return projectContextResult; const projectContext = projectContextResult.context;
  const project = clean(input.project || input.project_slug || projectContext?.project?.project_id, 120) || null;
  const sourceOfTruthResult = buildSourceOfTruth(input.source_of_truth || input); if (!sourceOfTruthResult.ok) return sourceOfTruthResult; const sourceOfTruth = sourceOfTruthResult.context;
  const plan = buildOrchestrationPlan({ prompt }); if (!plan.ok) return plan; plan.project = project;
  const created = createMission({ plan, source_of_truth: sourceOfTruth }); if (!created.ok) return created;
  const businessContracts = {}; const automationContracts = {}; const aiContracts = {};
  for (const task of created.tasks) { if (task.domain === 'business') businessContracts[task.task_id] = businessContract(task, prompt, created.project); if (task.domain === 'automation') automationContracts[task.task_id] = automationContract(task, prompt); if (task.domain === 'ai') aiContracts[task.task_id] = { task_type: 'generate', output: { format: 'text', max_chars: 100000 }, max_attempts: Math.min(task.max_attempts || 1, 3) }; }
  const packageValue = {
    package_version: 'mission.package.v1', compiler_version: '4.10', mission: created, source_of_truth: sourceOfTruth,
    project_context: projectContext,
    project_context_binding: projectContext ? { scope_key: projectContext.project.scope_key, knowledge_revision: projectContext.knowledge_revision, content_pack_ref: clone(projectContext.content_pack_ref), visual_pack_ref: clone(projectContext.visual_pack_ref), readiness_ref: clone(projectContext.readiness_ref) } : null,
    contracts: { business_contracts: businessContracts, automation_contracts: automationContracts, ai_contracts: aiContracts, web: { project_name: clean(input.project_name || input.project || created.project || `Mission ${created.mission_id.slice(-8)}`, 120), project_context: projectContext } },
    approvals: { automatic: false, per_engine_explicit: true, required_engines: [...new Set(created.tasks.map((task) => ['web', 'automation', 'ai', 'business'].includes(task.domain) ? task.domain : task.engine).filter(Boolean))] },
    activation_requirements: activationRequirements(created, prompt, projectContext),
    safeguards: { automatic_multi_factory_execution: false, business_external_writes: false, ai_provider_implicit_activation: false, automation_external_transport_implicit: false, stale_revision_execution_blocked: true, project_content_readiness_required: Boolean(projectContext), project_context_stale_execution_blocked: Boolean(projectContext), source_of_truth_separate_from_project_knowledge: true, production_deploy: false }
  };
  return { ok: true, package: packageValue };
}

export function missionCompilerManifest() { return { version: '4.10', engine_revision: 'max-source-of-truth-1', input: 'single_high_level_prompt', output: 'durable_mission_plus_factory_contracts', compiled_engines: ['web', 'automation', 'ai', 'business'], project_identity_separate_from_routing: true, deterministic_safe_contract_synthesis: true, source_of_truth_contract: true, project_source_intake_extension: 'aurentara.project-mission-context.v1', git_source_of_truth_separate: true, full_sha_revision_binding_supported: true, explicit_adapter_approvals_required: true, external_activation_requirements_exposed: true, automatic_multi_factory_execution: false, production_deploy: false }; }
