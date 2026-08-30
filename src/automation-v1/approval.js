const clean = (value, max = 100) => String(value ?? '').trim().slice(0, max);

export function classifyApproval(node = {}, mission = {}) {
  if (node.production === true || mission.production === true) return 'PRODUCTION_CHANGE';
  if (node.type === 'ai_call') return 'PAID_EXECUTION';
  if (node.side_effect_class === 'READ_ONLY') return 'READ_ONLY';
  if (mission.data_classification?.startsWith('synthetic') && node.dry_run_capable === true) return 'SAFE_SYNTHETIC_WRITE';
  return 'EXTERNAL_WRITE';
}

export function approvalDecision(node = {}, mission = {}, context = {}) {
  const approvalClass = classifyApproval(node, mission);
  const errors = [];
  if (context.production === true || approvalClass === 'PRODUCTION_CHANGE') errors.push('PRODUCTION_LOCKED');
  if (context.real_customer_data === true) errors.push('REAL_CUSTOMER_DATA_LOCKED');
  if (context.mass_email === true) errors.push('MASS_EMAIL_LOCKED');
  if (context.payments === true) errors.push('PAYMENTS_LOCKED');
  if (Number(context.variable_cost_eur ?? 0) !== 0) errors.push('VARIABLE_COST_CEILING_EXCEEDED');

  let execution = 'ALLOW_SYNTHETIC';
  if (approvalClass === 'PAID_EXECUTION') {
    execution = 'BLOCK_EXTERNAL_ALLOW_SYNTHETIC';
    if (context.execute_external === true) errors.push('PAID_EXECUTION_LOCKED');
  } else if (approvalClass === 'EXTERNAL_WRITE') {
    execution = 'BLOCK_EXTERNAL_ALLOW_SYNTHETIC';
    if (context.execute_external === true && context.external_write_approved !== true) errors.push('EXTERNAL_WRITE_APPROVAL_REQUIRED');
  } else if (approvalClass === 'SAFE_SYNTHETIC_WRITE') {
    execution = 'ALLOW_SYNTHETIC';
  } else if (approvalClass === 'READ_ONLY') {
    execution = context.execute_external === true ? 'ALLOW_READ_ONLY_IF_ADAPTER_SUPPORTS' : 'ALLOW_SYNTHETIC';
  }

  if (context.execute_external === true && node.provider_id !== 'riosystems-native-automation') {
    errors.push('V1_EXTERNAL_PROVIDER_EXECUTION_DISABLED');
  }

  return {
    ok: errors.length === 0,
    approval_class: approvalClass,
    execution,
    errors,
    provider_id: clean(node.provider_id, 120) || null,
    production: false,
    paid_execution: false,
    variable_cost_eur: 0
  };
}
