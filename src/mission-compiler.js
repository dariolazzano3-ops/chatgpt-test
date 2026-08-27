import { createMission } from './orchestration-state.js';
import { buildOrchestrationPlan } from './orchestration-planner.js';

const clean = (value, max = 4000) => String(value || '').trim().slice(0, max);
const lower = (value) => clean(value).toLowerCase();

function businessContract(task, prompt, project) {
  const text = lower(prompt);
  const operations = [];
  const crmRequested = /crm|kunden|lead|vertrieb|sales/.test(text);
  const leadRequested = /lead|kontakt|anfrage/.test(text);
  const offerRequested = /angebot|offer|quote/.test(text);
  const name = clean(project, 120) || 'Mission';
  if (crmRequested) operations.push({ id: 'crm', type: 'define_crm', config: { name: `${name} CRM`, entity: 'lead', external_write: false } });
  if (leadRequested) operations.push({ id: 'lead-fields', type: 'define_lead_fields', config: { fields: ['name', 'email', 'phone', 'source', 'status'] } });
  if (crmRequested || /pipeline|vertrieb|sales/.test(text)) operations.push({ id: 'pipeline', type: 'configure_pipeline', config: { stages: ['new', 'qualified', 'proposal', 'won', 'lost'] } });
  if (offerRequested) operations.push({ id: 'offer-flow', type: 'define_offer_flow', config: { stages: ['draft', 'review', 'sent', 'accepted'], external_write: false } });
  if (!operations.length) operations.push({ id: 'process-map', type: 'map_business_process', config: { goal: task.goal, external_write: false } });
  return { goal: task.goal, operations, metadata: { compiler: 'mission-compiler-v4.10', external_writes: false } };
}

function automationContract(task, prompt) {
  const text = lower(prompt);
  const incomingLeadFlow = /eingehende? leads?|lead.*automat|automat.*lead|lead.?flow/.test(text);
  const apiIntent = /api|webhook|integration|verbinde|connect/.test(text);
  const workflowSpec = {
    goal: task.goal,
    trigger: incomingLeadFlow ? 'incoming_lead' : 'mission_dependency_ready',
    dependency_handoff: true,
    intended_integration: apiIntent || incomingLeadFlow,
    external_activation_required: apiIntent || incomingLeadFlow,
    external_execution_authorized: false
  };
  return {
    goal: task.goal,
    steps: [
      { id: 'compile-workflow-spec', type: 'transform', config: { mode: 'set', field: 'automation_spec', value: workflowSpec } },
      { id: 'mark-supervised', type: 'transform', config: { mode: 'set', field: 'supervised_activation_required', value: workflowSpec.external_activation_required } }
    ],
    metadata: { compiler: 'mission-compiler-v4.10', external_side_effects: false }
  };
}

function activationRequirements(mission, prompt) {
  const text = lower(prompt);
  const requirements = [];
  for (const task of mission.tasks) {
    const engine = ['web', 'automation', 'ai', 'business'].includes(task.domain) ? task.domain : task.engine;
    requirements.push({ engine, task_id: task.task_id, adapter_dispatch_approval_required: true, production_deploy: false });
  }
  if (mission.tasks.some((task) => task.domain === 'ai')) requirements.push({ engine: 'ai', type: 'provider_activation', required: true, reason: 'AI execution requires an injected provider runner and separate provider cost/credential approval.' });
  if (mission.tasks.some((task) => task.domain === 'automation') && /api|webhook|integration|verbinde|connect|eingehende? leads?/.test(text)) requirements.push({ engine: 'automation', type: 'external_integration_activation', required: true, reason: 'The compiled workflow is safe/local until an explicitly approved integration transport and policy are supplied.' });
  if (mission.tasks.some((task) => task.domain === 'business') && /crm|kunden|lead/.test(text)) requirements.push({ engine: 'business', type: 'external_crm_write_activation', required: true, reason: 'Business Factory currently creates the CRM configuration locally; real CRM writes remain disabled.' });
  return requirements;
}

export function compileMissionPackage(input = {}) {
  const prompt = clean(input.prompt || input.request || input.goal);
  if (!prompt) return { ok: false, error: 'MISSION_PROMPT_REQUIRED' };
  const project = clean(input.project || input.project_slug, 120) || null;

  // Project identity must not collapse a compound mission into a single Web edit.
  // Route/decompose the natural-language mission first, then bind the project identity to the plan.
  const plan = buildOrchestrationPlan({ prompt });
  if (!plan.ok) return plan;
  plan.project = project;
  const created = createMission({ plan });
  if (!created.ok) return created;

  const businessContracts = {};
  const automationContracts = {};
  const aiContracts = {};
  for (const task of created.tasks) {
    if (task.domain === 'business') businessContracts[task.task_id] = businessContract(task, prompt, created.project);
    if (task.domain === 'automation') automationContracts[task.task_id] = automationContract(task, prompt);
    if (task.domain === 'ai') aiContracts[task.task_id] = { task_type: 'generate', output: { format: 'text', max_chars: 100000 }, max_attempts: Math.min(task.max_attempts || 1, 3) };
  }

  const packageValue = {
    package_version: 'mission.package.v1',
    compiler_version: '4.10',
    mission: created,
    contracts: {
      business_contracts: businessContracts,
      automation_contracts: automationContracts,
      ai_contracts: aiContracts,
      web: { project_name: clean(input.project_name || input.project || created.project || `Mission ${created.mission_id.slice(-8)}`, 120) }
    },
    approvals: {
      automatic: false,
      per_engine_explicit: true,
      required_engines: [...new Set(created.tasks.map((task) => ['web', 'automation', 'ai', 'business'].includes(task.domain) ? task.domain : task.engine).filter(Boolean))]
    },
    activation_requirements: activationRequirements(created, prompt),
    safeguards: {
      automatic_multi_factory_execution: false,
      business_external_writes: false,
      ai_provider_implicit_activation: false,
      automation_external_transport_implicit: false,
      production_deploy: false
    }
  };

  return { ok: true, package: packageValue };
}

export function missionCompilerManifest() {
  return {
    version: '4.10',
    input: 'single_high_level_prompt',
    output: 'durable_mission_plus_factory_contracts',
    compiled_engines: ['web', 'automation', 'ai', 'business'],
    project_identity_separate_from_routing: true,
    deterministic_safe_contract_synthesis: true,
    explicit_adapter_approvals_required: true,
    external_activation_requirements_exposed: true,
    automatic_multi_factory_execution: false,
    production_deploy: false
  };
}
