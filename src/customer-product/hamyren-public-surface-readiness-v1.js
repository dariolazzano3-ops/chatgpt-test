import { productionAccountSurfaceManifest } from './production-account-surface-v1.js';
import { productionPrivacySurfaceManifest } from './production-privacy-surface-v1.js';
import { customerPrelaunchSecurityPrivacyManifest, createCustomerLaunchShield } from './prelaunch-security-privacy-v1.js';

export const HAMYREN_PRODUCT_IDENTITY_V1 = Object.freeze({
  product_name: 'HAMYREN',
  tagline: 'Your Personal Business AI',
  maker: 'AURENTARA SYSTEMS'
});

export function hamyrenPublicSurfaceReadinessManifest() {
  return {
    schema: 'hamyren.public-customer-surface-readiness.v1',
    product: HAMYREN_PRODUCT_IDENTITY_V1,
    stable_internal_namespaces_preserved: true,
    public_activation_requires_operator_gate: true,
    legal_acceptance_requires_operator_gate: true,
    real_customer_ai_processing_requires_operator_gate: true,
    public_customer_traffic_active: false,
    real_customer_ai_processing_active: false,
    variable_cost_eur: 0
  };
}

export function evaluateHamyrenPublicSurfaceReadiness(input = {}) {
  const account = input.account || productionAccountSurfaceManifest();
  const privacy = input.privacy || productionPrivacySurfaceManifest();
  const prelaunch = input.prelaunch || customerPrelaunchSecurityPrivacyManifest();
  const shield = input.shield || createCustomerLaunchShield().manifest();
  const failures = [];

  if (account.visible_product_name !== 'HAMYREN') failures.push('HAMYREN_PRODUCT_NAME_MISSING');
  if (account.visible_product_tagline !== 'Your Personal Business AI') failures.push('HAMYREN_TAGLINE_MISSING');
  if (account.visible_maker !== 'AURENTARA SYSTEMS') failures.push('AURENTARA_MAKER_MISSING');
  if (account.supabase_auth !== true) failures.push('PRODUCTION_ACCOUNT_AUTH_NOT_READY');
  if (account.http_only_session_cookies !== true) failures.push('HTTP_ONLY_SESSION_REQUIRED');
  if (account.service_role_in_browser !== false) failures.push('SERVICE_ROLE_BROWSER_FORBIDDEN');
  if (account.custom_schema_rls !== true) failures.push('CUSTOMER_RLS_REQUIRED');
  if (privacy.privacy_export_rpc !== 'aurentara_customer_ai.export_my_workspace') failures.push('PRIVACY_EXPORT_NOT_READY');
  if (privacy.consent_append_only !== true) failures.push('CONSENT_LEDGER_NOT_APPEND_ONLY');
  if (privacy.service_role_in_worker !== false) failures.push('PRIVACY_SERVICE_ROLE_WORKER_FORBIDDEN');
  if (privacy.user_jwt_and_rls !== true) failures.push('PRIVACY_USER_JWT_RLS_REQUIRED');
  if (prelaunch.launch_shield_contract_ready !== true) failures.push('LAUNCH_SHIELD_NOT_READY');
  if (prelaunch.public_mode_default !== false) failures.push('PUBLIC_MODE_MUST_DEFAULT_OFF');
  if (prelaunch.public_activation_requires_operator_gate !== true) failures.push('PUBLIC_OPERATOR_GATE_REQUIRED');
  if (shield.public_activation_requires_explicit_approval !== true) failures.push('PUBLIC_EXPLICIT_APPROVAL_REQUIRED');
  if (shield.real_data_requires_explicit_approval !== true) failures.push('REAL_DATA_EXPLICIT_APPROVAL_REQUIRED');
  if (shield.production_runtime_required_for_public !== true) failures.push('PRODUCTION_RUNTIME_REQUIRED');
  if (account.real_customer_ai_processing_active !== false) failures.push('REAL_CUSTOMER_AI_MUST_REMAIN_OFF');
  if (account.public_surface_active !== false) failures.push('PUBLIC_SURFACE_MUST_REMAIN_OFF');
  if (input.operator_route_exposed === true) failures.push('OPERATOR_ROUTE_EXPOSURE_FORBIDDEN');

  return {
    schema: 'hamyren.public-customer-surface-readiness-result.v1',
    ok: failures.length === 0,
    failures,
    product: HAMYREN_PRODUCT_IDENTITY_V1,
    technical_public_surface_ready: failures.length === 0,
    legal_privacy_technical_ready: input.legal_privacy_technical_ready === true,
    legal_privacy_review_complete: false,
    public_customer_surface_active: false,
    real_customer_ai_processing_active: false,
    operator_route_exposed: false,
    required_operator_gates: ['legal_privacy_review', 'public_customer_surface', 'real_customer_ai_processing'],
    variable_cost_eur: 0,
    real_customer_data: false
  };
}
