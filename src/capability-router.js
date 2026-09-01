const CAPABILITIES = {
  web_generate: { domain: "web", engine: "generate", status: "available", risk: "bounded", description: "Create a new website or web app." },
  web_rebuild: { domain: "web", engine: "rebuild", status: "available", risk: "bounded", description: "Analyze and independently rebuild a public website." },
  web_evolve: { domain: "web", engine: "evolve", status: "available", risk: "bounded", description: "Modify an existing web project through the controlled Factory pipeline." },
  app_build: { domain: "app", engine: null, status: "planned", risk: "bounded", description: "Build application and internal-tool projects." },
  automation_build: { domain: "automation", engine: "automation", status: "available", risk: "integration", description: "Build workflows, API integrations and business automations." },
  ai_system_build: { domain: "ai", engine: "ai", status: "available", risk: "integration", description: "Build assistants, agents and knowledge systems." },
  business_system_build: { domain: "business", engine: "business", status: "available", risk: "bounded", description: "Build bounded CRM, lead, offer and operational business-system configurations." }
};

export const HAMYREN_EXECUTION_CLASSES = Object.freeze({
  AUTONOMOUS: 'AUTONOMOUS',
  SELF_SERVICE: 'SELF_SERVICE',
  AURENTARA_REQUIRED: 'AURENTARA_REQUIRED'
});

export const CAPABILITY_AVAILABILITY_STATES = Object.freeze([
  'DEFINED',
  'INTERNAL_ONLY',
  'STAGING',
  'CUSTOMER_DISABLED',
  'CUSTOMER_ENABLED'
]);

const CAPABILITY_POLICY = Object.freeze({
  web_generate: Object.freeze({ execution_class: 'SELF_SERVICE', availability: 'CUSTOMER_DISABLED', max_complexity: 'low', max_integrations: 1 }),
  web_rebuild: Object.freeze({ execution_class: 'SELF_SERVICE', availability: 'CUSTOMER_DISABLED', max_complexity: 'low', max_integrations: 1 }),
  web_evolve: Object.freeze({ execution_class: 'SELF_SERVICE', availability: 'CUSTOMER_DISABLED', max_complexity: 'low', max_integrations: 1 }),
  automation_build: Object.freeze({ execution_class: 'SELF_SERVICE', availability: 'CUSTOMER_DISABLED', max_complexity: 'low', max_integrations: 1 }),
  ai_system_build: Object.freeze({ execution_class: 'SELF_SERVICE', availability: 'CUSTOMER_DISABLED', max_complexity: 'low', max_integrations: 1 }),
  business_system_build: Object.freeze({ execution_class: 'SELF_SERVICE', availability: 'CUSTOMER_DISABLED', max_complexity: 'low', max_integrations: 1 }),
  app_build: Object.freeze({ execution_class: 'AURENTARA_REQUIRED', availability: 'DEFINED', max_complexity: null, max_integrations: 0 })
});

const CAPABILITY_ALIASES = Object.freeze({
  web: 'web_generate',
  website: 'web_generate',
  crm: 'business_system_build',
  business: 'business_system_build',
  business_system: 'business_system_build',
  automation: 'automation_build',
  ai: 'ai_system_build',
  app: 'app_build',
  business_app: 'app_build'
});

const COMPLEXITY_ORDER = Object.freeze({ low: 1, medium: 2, high: 3, critical: 4 });
const RISK_ORDER = Object.freeze({ low: 1, medium: 2, high: 3, critical: 4 });
const COST_ORDER = Object.freeze({ zero: 0, low: 1, medium: 2, high: 3 });
const IMPLEMENTATION_ACTIVITIES = new Set(['implementation', 'execution', 'build', 'deploy']);

function text(value) { return String(value || "").trim().toLowerCase(); }
function hit(value, words) { return words.some((word) => value.includes(word)); }
function unique(values = []) { return [...new Set(values.filter(Boolean))]; }
function normalizeLevel(value, order, fallback) { const normalized = text(value); return Object.hasOwn(order, normalized) ? normalized : fallback; }
function resolveCapabilityAlias(value) { const normalized = text(value); return CAPABILITIES[normalized] ? normalized : (CAPABILITY_ALIASES[normalized] || null); }

export function listCapabilities() { return Object.entries(CAPABILITIES).map(([id, capability]) => ({ id, ...capability, policy: CAPABILITY_POLICY[id] || null })); }
export function routeCapability(input = {}) {
  const prompt = text(input.prompt || input.request || input.goal); const explicit = resolveCapabilityAlias(input.capability); const project = text(input.project || input.project_slug);
  if (explicit && CAPABILITIES[explicit]) return { ok: true, capability: explicit, ...CAPABILITIES[explicit], confidence: 1, reason: "explicit_capability" };
  if (!prompt) return { ok: false, error: "ROUTING_PROMPT_REQUIRED", candidates: [] };
  const scores = new Map(); const add=(id,score,reason)=>{ const current=scores.get(id)||{score:0,reasons:[]}; current.score+=score; current.reasons.push(reason); scores.set(id,current); };
  if (hit(prompt,["website","webseite","landingpage","landing page","homepage","html","css","web app","webapp"])) add(project?"web_evolve":"web_generate",5,"web_language");
  if (hit(prompt,["ändere","aendere","bearbeite","verbessere","evolve","update","anpassen","mach den","mach die"])&&project) add("web_evolve",5,"existing_project_change");
  if (hit(prompt,["rebuild","rekonstruiere","nachbauen","bestehende website analysieren"])) add("web_rebuild",6,"rebuild_intent");
  if (hit(prompt,["app","dashboard","internes tool","internal tool","software tool"])) add("app_build",4,"app_language");
  if (hit(prompt,["automation","automatisiere","automatisch","automatisiert","workflow","api verbinden","integration","webhook","datenfluss","lead flow","lead-flow","eingehende leads","eingehender lead","verbinde eingehende","connect leads"])) add("automation_build",5,"automation_language");
  if (hit(prompt,["ki","ai ","agent","assistent","assistant","rag","wissenssystem","knowledge base"])) add("ai_system_build",5,"ai_language");
  if (hit(prompt,["crm","leads","lead-system","angebotssystem","kundenprozess","business system","vertrieb","sales pipeline"])) add("business_system_build",5,"business_language");
  const ranked=[...scores.entries()].map(([id,value])=>({id,...CAPABILITIES[id],...value})).sort((a,b)=>b.score-a.score); if(!ranked.length) return {ok:false,error:"CAPABILITY_UNRESOLVED",candidates:[]};
  const top=ranked[0],second=ranked[1]; const confidence=second?Math.max(.5,Math.min(.99,top.score/(top.score+second.score))):.95; const multi_domain=ranked.filter((item)=>item.score>=Math.max(4,top.score-1)).map((item)=>item.id);
  if(multi_domain.length>1&&!project) return {ok:true,capability:"multi_capability",status:"planned",confidence,candidates:ranked.slice(0,4),required_capabilities:multi_domain,reason:"compound_request_requires_orchestration",production_deploy:false};
  return {ok:true,capability:top.id,domain:top.domain,engine:top.engine,status:top.status,risk:top.risk,confidence,reason:top.reasons[0],candidates:ranked.slice(0,3),production_deploy:false};
}

export function classifyHamyrenCapabilityRequest(input = {}) {
  const activity = text(input.activity || input.requested_activity || (input.intent === 'ACTION_REQUEST' ? 'implementation' : 'planning')) || 'planning';
  const routed = routeCapability({ ...input, capability: resolveCapabilityAlias(input.capability) || input.capability });
  const explicitRequired = Array.isArray(input.required_capabilities) ? input.required_capabilities.map(resolveCapabilityAlias).filter(Boolean) : [];
  const routedRequired = routed.ok ? (routed.required_capabilities || (routed.capability === 'multi_capability' ? [] : [routed.capability])) : [];
  const requiredCapabilities = unique([...explicitRequired, ...routedRequired]);
  const primaryCapability = requiredCapabilities[0] || null;
  const policy = primaryCapability ? CAPABILITY_POLICY[primaryCapability] : null;
  const complexity = normalizeLevel(input.complexity, COMPLEXITY_ORDER, 'low');
  const riskClass = normalizeLevel(input.risk_class || input.riskClass || input.risk, RISK_ORDER, 'low');
  const costClass = normalizeLevel(input.cost_class || input.costClass, COST_ORDER, 'zero');
  const integrationCount = Math.max(0, Number(input.integration_count ?? input.integrationCount ?? 0));
  const scope = text(input.scope || 'standard');
  const providerReady = input.provider_ready !== false && input.providerReady !== false;
  const reasons = [];
  const professionalReasons = [];
  const requiredApprovals = [];
  const executionConstraints = [];

  if (input.migration_required === true || input.migrationRequired === true) professionalReasons.push('migration_required');
  if (input.custom_code_required === true || input.customCodeRequired === true) professionalReasons.push('custom_code_required');
  if (input.security_sensitive === true || input.securitySensitive === true) professionalReasons.push('security_sensitive');
  if (input.business_critical === true || input.businessCritical === true) professionalReasons.push('business_critical');
  if (input.complex_authentication_required === true || input.complexAuthenticationRequired === true) professionalReasons.push('complex_authentication_required');
  if (COMPLEXITY_ORDER[complexity] >= COMPLEXITY_ORDER.high) professionalReasons.push('high_complexity');
  if (RISK_ORDER[riskClass] >= RISK_ORDER.high) professionalReasons.push('high_risk');
  if (integrationCount > 1) professionalReasons.push('multi_system_integration');
  if (['large','enterprise','custom','transformation'].includes(scope)) professionalReasons.push('professional_scope');
  if (COST_ORDER[costClass] >= COST_ORDER.high) professionalReasons.push('high_cost_class');

  const productionRequired = input.production_required === true || input.productionRequired === true;
  const externalWriteRequired = input.external_write_required === true || input.externalWriteRequired === true;
  const customerDataRequired = input.customer_data_required === true || input.customerDataRequired === true;
  const credentialRequired = input.credential_required === true || input.credentialRequired === true;
  const humanApprovalRequired = input.human_approval_required === true || input.humanApprovalRequired === true;
  const businessCritical = input.business_critical === true || input.businessCritical === true;

  if (productionRequired && customerDataRequired && credentialRequired) professionalReasons.push('production_customer_data_with_credentials');
  if (externalWriteRequired && (businessCritical || integrationCount > 1)) professionalReasons.push('critical_external_writes');
  if (policy?.max_complexity && COMPLEXITY_ORDER[complexity] > COMPLEXITY_ORDER[policy.max_complexity]) professionalReasons.push('self_service_complexity_limit_exceeded');
  if (Number.isFinite(policy?.max_integrations) && integrationCount > policy.max_integrations) professionalReasons.push('self_service_integration_limit_exceeded');

  if (externalWriteRequired) { requiredApprovals.push('external_write_approval'); executionConstraints.push('existing_external_write_gate'); }
  if (humanApprovalRequired) requiredApprovals.push('human_approval');
  if (credentialRequired) executionConstraints.push('credential_gate');
  if (customerDataRequired) executionConstraints.push('customer_data_gate');
  if (productionRequired) { requiredApprovals.push('production_activation'); executionConstraints.push('existing_production_activation_gate'); }
  if (costClass !== 'zero') executionConstraints.push('existing_cost_control_gate');
  if (!providerReady) executionConstraints.push('provider_readiness_gate');

  let implementationExecutionClass = policy?.execution_class || null;
  let selfServiceEligible = implementationExecutionClass === HAMYREN_EXECUTION_CLASSES.SELF_SERVICE;
  if (primaryCapability && professionalReasons.length) { implementationExecutionClass = HAMYREN_EXECUTION_CLASSES.AURENTARA_REQUIRED; selfServiceEligible = false; }

  const implementationRequested = IMPLEMENTATION_ACTIVITIES.has(activity);
  const needsInformation = implementationRequested && !primaryCapability;
  const executionClass = needsInformation ? null : (implementationRequested ? implementationExecutionClass : HAMYREN_EXECUTION_CLASSES.AUTONOMOUS);
  const implementationAvailability = policy?.availability || 'DEFINED';
  const availability = implementationRequested ? implementationAvailability : 'STAGING';

  if (!implementationRequested) reasons.push('hamyren_thinking_allowed');
  if (selfServiceEligible) reasons.push('standardized_self_service_scope');
  reasons.push(...professionalReasons);
  if (!providerReady) reasons.push('provider_not_ready');
  if (implementationAvailability !== 'CUSTOMER_ENABLED') reasons.push('customer_availability_not_enabled');
  if (needsInformation) reasons.push('capability_information_required');

  const routes = requiredCapabilities.map((id) => ({ id, domain: CAPABILITIES[id]?.domain || null, engine: CAPABILITIES[id]?.engine || null, status: CAPABILITIES[id]?.status || null }));
  const recommendedNextAction = needsInformation
    ? 'collect_requirements_and_classify_capability'
    : implementationExecutionClass === HAMYREN_EXECUTION_CLASSES.AURENTARA_REQUIRED
      ? 'prepare_aurentara_implementation_handoff'
      : implementationRequested && selfServiceEligible && implementationAvailability === 'CUSTOMER_ENABLED'
        ? 'prepare_hamyren_self_service_implementation'
        : implementationRequested && selfServiceEligible
          ? 'prepare_self_service_scope_without_customer_execution'
          : 'continue_hamyren_analysis_and_planning';

  let customerMessage = 'I can work through this with you directly.';
  if (needsInformation) customerMessage = 'I need a little more implementation detail before choosing the safest execution path.';
  else if (implementationExecutionClass === HAMYREN_EXECUTION_CLASSES.AURENTARA_REQUIRED) customerMessage = 'I can fully prepare this with you. Because the implementation involves higher-complexity or production-sensitive work, professional implementation through AURENTARA SYSTEMS is recommended.';
  else if (implementationRequested && selfServiceEligible) customerMessage = implementationAvailability === 'CUSTOMER_ENABLED'
    ? 'This fits within a standardized HAMYREN implementation.'
    : 'This fits the standardized HAMYREN Self-Service scope, but customer execution is not currently enabled.';

  return {
    schema_version: 'hamyren-aurentara-capability-policy.v1',
    decision_status: needsInformation ? 'NEEDS_INFORMATION' : 'CLASSIFIED',
    intent: input.intent || null,
    activity,
    required_capability: primaryCapability,
    required_capabilities: requiredCapabilities,
    routes,
    execution_class: executionClass,
    thinking_execution_class: HAMYREN_EXECUTION_CLASSES.AUTONOMOUS,
    implementation_execution_class: implementationExecutionClass,
    self_service_eligible: selfServiceEligible,
    availability,
    implementation_availability: implementationAvailability,
    complexity,
    risk_class: riskClass,
    cost_class: costClass,
    integration_count: integrationCount,
    reasons: unique(reasons),
    requirements: {
      production_required: productionRequired,
      external_write_required: externalWriteRequired,
      customer_data_required: customerDataRequired,
      credential_required: credentialRequired,
      human_approval_required: humanApprovalRequired,
      migration_required: input.migration_required === true || input.migrationRequired === true,
      custom_code_required: input.custom_code_required === true || input.customCodeRequired === true,
      security_sensitive: input.security_sensitive === true || input.securitySensitive === true,
      business_critical: businessCritical,
      complex_authentication_required: input.complex_authentication_required === true || input.complexAuthenticationRequired === true
    },
    required_approvals: unique(requiredApprovals),
    execution_constraints: unique(executionConstraints),
    provider_ready: providerReady,
    recommended_next_action: recommendedNextAction,
    customer_message: customerMessage,
    production_deploy: false
  };
}

export function capabilityRegistry(){ return {version:"4.10",architecture:"multi_factory_capability_registry",capabilities:listCapabilities(),hamyren_policy:{version:'v1',responsibility_classes:Object.values(HAMYREN_EXECUTION_CLASSES),availability_states:[...CAPABILITY_AVAILABILITY_STATES],thinking_and_execution_separated:true,customer_availability_separate_from_eligibility:true},principles:{core_routes_work:true,domain_engines_remain_modular:true,unavailable_capabilities_are_never_faked:true,compound_requests_require_orchestration:true,production_requires_explicit_approval:true}}; }
