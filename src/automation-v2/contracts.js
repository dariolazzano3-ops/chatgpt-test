const clone = (v) => structuredClone(v ?? null);
const clean = (v, n = 300) => String(v ?? '').trim().slice(0, n);

export const CANONICAL_NODE_TYPES = Object.freeze(['trigger','action','condition','router','transform','delay','approval','ai_task','webhook','database','notification','validation','retry','recovery','subflow','termination']);
export const CANONICAL_EDGE_TYPES = Object.freeze(['success','failure','condition_true','condition_false','retry','fallback']);
export const SLA_CLASSES = Object.freeze(['LOW','STANDARD','IMPORTANT','CRITICAL']);
export const FAILURE_CLASSES = Object.freeze(['temporary_provider_error','rate_limit','authentication_failure','schema_change','mapping_failure','missing_data','invalid_payload','timeout','dependency_failure','logic_failure','external_service_down']);
export const STANDARD_EVENT_TYPES = Object.freeze(['lead.created','lead.updated','contact.created','deal.created','deal.won','form.submitted','website.deployed','website.form_submitted','ai.task_completed','automation.failed','automation.recovered','customer.created','booking.created','payment.received','support.requested']);
export const SCHEDULE_MODES = Object.freeze(['event_driven','interval','cron','delayed','business_hours','one_time']);

export const HARD_SAFETY = Object.freeze({
  production:false, real_customer_data:false, real_money_movement:false, mass_email:false,
  automatic_production_deployment:false, automatic_paid_overflow:false, unapproved_external_writes:false,
  cross_project_data_access:false, secrets_in_repo:false, infinite_retry:false, unknown_automatic_repair:false,
  variable_development_cost_ceiling_eur:0
});

export function automationSpec(input = {}) {
  const errors = [];
  const projectId = clean(input.project_id, 160);
  const goal = clean(input.goal, 1200);
  if (!projectId) errors.push('PROJECT_ID_REQUIRED');
  if (!goal) errors.push('GOAL_REQUIRED');
  if (!input.trigger || typeof input.trigger !== 'object') errors.push('TRIGGER_REQUIRED');
  const retry = retryPolicyContract(input.retry_policy || {});
  if (!retry.ok) errors.push(...retry.errors);
  return { ok: !errors.length, errors, spec: errors.length ? null : {
    schema:'riosystems.automation-spec.v2', automation_id:clean(input.automation_id || `${projectId}:automation`, 220), project_id:projectId,
    goal, trigger:clone(input.trigger), conditions:clone(input.conditions || []), actions:clone(input.actions || []),
    data_dependencies:clone(input.data_dependencies || []), provider_requirements:clone(input.provider_requirements || {}),
    approval_requirements:clone(input.approval_requirements || []), failure_policy:clone(input.failure_policy || {mode:'fail_closed'}),
    retry_policy:retry.policy, validation_rules:clone(input.validation_rules || []), observability_requirements:clone(input.observability_requirements || ['execution','error','recovery','trace']),
    cost_class:clean(input.cost_class || 'ZERO_DEV'), production:false, hard_safety:clone(HARD_SAFETY)
  }};
}

export function eventContract(input = {}) {
  const errors = [];
  const eventType = clean(input.event_type, 160);
  const projectId = clean(input.project_id, 160);
  if (!eventType || !/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(eventType)) errors.push('EVENT_TYPE_INVALID');
  if (!projectId) errors.push('PROJECT_ID_REQUIRED');
  const sensitivity = clean(input.sensitivity_class || 'synthetic', 80).toLowerCase();
  if (!['synthetic','non_sensitive','internal'].includes(sensitivity)) errors.push('SENSITIVITY_CLASS_BLOCKED');
  return { ok:!errors.length, errors, event:errors.length ? null : {
    schema:'riosystems.event.v2', event_id:clean(input.event_id || `evt-${Date.now()}`, 220), event_type:eventType, project_id:projectId,
    source:clean(input.source || 'riosystems', 160), timestamp:clean(input.timestamp || new Date(0).toISOString(), 80),
    payload_schema:clone(input.payload_schema || {}), schema_version:clean(input.schema_version || '1.0', 40),
    correlation_id:clean(input.correlation_id || `${projectId}:trace`, 220), idempotency_key:clean(input.idempotency_key || `${projectId}:${eventType}`, 260), sensitivity_class:sensitivity
  }};
}

export function retryPolicyContract(input = {}) {
  const strategy = clean(input.strategy || 'bounded_retry', 80);
  const errors = [];
  if (!['fixed','exponential_backoff','bounded_retry','provider_retry_after','no_retry'].includes(strategy)) errors.push('RETRY_STRATEGY_INVALID');
  const maxAttempts = strategy === 'no_retry' ? 1 : Math.min(Math.max(Number(input.max_attempts ?? 3),1),5);
  return { ok:!errors.length, errors, policy:{strategy,max_attempts:maxAttempts,delay_ms:Math.min(Math.max(Number(input.delay_ms ?? 250),0),30000),backoff:strategy === 'exponential_backoff' ? 2 : 1,retryable_errors:clone(input.retryable_errors || ['timeout','rate_limit','temporary_provider_error','external_service_down']),non_retryable_errors:clone(input.non_retryable_errors || ['authentication_failure','permission_escalation','money_movement','production_routing'])} };
}

export function webhookContract(input = {}) {
  const errors = [];
  const authMode = clean(input.auth_mode || 'signature', 80);
  if (!clean(input.webhook_id,160)) errors.push('WEBHOOK_ID_REQUIRED');
  if (!clean(input.project_id,160)) errors.push('PROJECT_ID_REQUIRED');
  if (authMode === 'none') errors.push('OPEN_WEBHOOK_BLOCKED');
  if (input.signature_validation !== true) errors.push('SIGNATURE_VALIDATION_REQUIRED');
  return {ok:!errors.length,errors,webhook:{schema:'riosystems.webhook.v2',webhook_id:clean(input.webhook_id,160),project_id:clean(input.project_id,160),provider:clean(input.provider || 'provider-neutral',120),event_type:clean(input.event_type,160),schema_contract:clone(input.schema || {}),auth_mode:authMode,signature_validation:true,replay_protection:true,timestamp_validation:true,secret_ref:clean(input.secret_ref,200) || null,payload_size_limit_bytes:Math.min(Math.max(Number(input.payload_size_limit_bytes ?? 262144),1024),1048576),rate_limit_per_minute:Math.min(Math.max(Number(input.rate_limit_per_minute ?? 60),1),600),environment:'staging',production:false}};
}

export function scheduleContract(input = {}) {
  const mode = clean(input.mode || 'event_driven',80);
  const errors = [];
  if (!SCHEDULE_MODES.includes(mode)) errors.push('SCHEDULE_MODE_INVALID');
  if ((mode === 'cron' || mode === 'business_hours') && !clean(input.timezone,80)) errors.push('TIMEZONE_REQUIRED');
  return {ok:!errors.length,errors,schedule:{mode,timezone:clean(input.timezone,80)||'UTC',expression:clean(input.expression,160)||null,delay_ms:Number(input.delay_ms||0),production:false}};
}

export function crossFactoryRequest({factory,project_id,operation,payload={},correlation_id}={}) {
  const allowed = new Set(['ai','business','web']);
  const id = clean(factory,80).toLowerCase();
  if (!allowed.has(id)) return {ok:false,error:'FACTORY_NOT_ALLOWED'};
  return {ok:true,request:{schema:'riosystems.cross-factory-request.v1',target_factory:id,project_id:clean(project_id,160),operation:clean(operation,160),payload:clone(payload),correlation_id:clean(correlation_id,220),credential_ref:null,domain_logic_owned_by_target:true,production:false}};
}

export function processingSemantics() {
  return {
    global_exactly_once_guaranteed: false,
    intent: 'EFFECTIVELY_ONCE_WHERE_POSSIBLE',
    mechanisms: ['idempotency','deduplication','transaction_boundaries','reconciliation'],
    claim: 'no_global_exactly_once_guarantee'
  };
}
