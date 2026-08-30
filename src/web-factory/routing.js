import { WEB_PROVIDER_REGISTRY } from './provider-roles.js';

function routeScore(route, request = {}) {
  const weights = {
    design_quality: Number(request.weights?.design_quality ?? 3),
    build_speed: Number(request.weights?.build_speed ?? 2),
    hosting_cost: Number(request.weights?.hosting_cost ?? 3),
    recurring_cost: Number(request.weights?.recurring_cost ?? 3),
    margin: Number(request.weights?.margin ?? 2),
    lock_in: Number(request.weights?.lock_in ?? 3),
    exportability: Number(request.weights?.exportability ?? 3),
    maintenance: Number(request.weights?.maintenance ?? 2)
  };
  const metrics = route.metrics;
  const weighted = Object.entries(weights).reduce((sum, [key, weight]) => sum + weight * Number(metrics[key] ?? 0), 0);
  const denominator = Object.values(weights).reduce((sum, weight) => sum + weight * 5, 0);
  return Math.round((weighted / denominator) * 10000) / 100;
}

function costMetadata(route, request = {}) {
  return {
    schema: 'riosystems.web-cost-metadata.v1',
    build_provider: route.build_provider,
    design_provider: route.design_provider,
    hosting_provider: route.hosting_provider,
    estimated_build_cost: request.synthetic_test_data_only === true ? 0 : null,
    estimated_monthly_provider_cost: route.hosting_provider === 'cloudflare' && request.environment === 'staging' ? 0 : null,
    customer_monthly_price: null,
    estimated_margin: null,
    currency: 'EUR',
    estimate_basis: request.synthetic_test_data_only === true
      ? 'zero-cost synthetic staging policy'
      : 'operator quote required before paid or production activation',
    automatic_paid_overflow: false
  };
}

const ROUTES = {
  native: {
    route_id: 'native-cloudflare',
    design_provider: 'riosystems-native-web-builder',
    build_provider: 'riosystems-native-web-builder',
    hosting_provider: 'cloudflare',
    stages: ['native_design_system', 'native_build', 'web_qa', 'cloudflare_staging_candidate'],
    metrics: { design_quality: 4, build_speed: 5, hosting_cost: 5, recurring_cost: 5, margin: 5, lock_in: 5, exportability: 5, maintenance: 5 }
  },
  premium: {
    route_id: 'framer-design-native-cloudflare',
    design_provider: 'framer',
    build_provider: 'riosystems-native-web-builder',
    hosting_provider: 'cloudflare',
    stages: ['framer_visual_design', 'structured_design_interpretation', 'native_reconstruction', 'visual_fidelity_qa', 'cloudflare_staging_candidate'],
    metrics: { design_quality: 5, build_speed: 4, hosting_cost: 5, recurring_cost: 5, margin: 4, lock_in: 5, exportability: 5, maintenance: 4 }
  },
  cms: {
    route_id: 'webflow-cms-specialist-candidate',
    design_provider: 'webflow',
    build_provider: 'webflow',
    hosting_provider: null,
    stages: ['cms_specialist_review_required'],
    metrics: { design_quality: 4, build_speed: 3, hosting_cost: 2, recurring_cost: 2, margin: 3, lock_in: 2, exportability: 2, maintenance: 3 }
  },
  rapid: {
    route_id: 'lovable-rapid-prototype-candidate',
    design_provider: 'lovable',
    build_provider: 'lovable',
    hosting_provider: null,
    stages: ['rapid_prototype_specialist_review_required'],
    metrics: { design_quality: 3, build_speed: 5, hosting_cost: 3, recurring_cost: 3, margin: 3, lock_in: 3, exportability: 3, maintenance: 3 }
  }
};

export function selectWebBuildRoute(request = {}) {
  const complexCms = request.complex_cms === true || Number(request.cms_complexity || 0) >= 4;
  const rapid = request.rapid_experiment === true;
  const premium = request.premium_visual === true || ['premium', 'high_fidelity'].includes(String(request.quality_level || '').toLowerCase());

  const selected = complexCms ? ROUTES.cms : rapid ? ROUTES.rapid : premium ? ROUTES.premium : ROUTES.native;
  const route = structuredClone(selected);
  route.score = routeScore(route, request);
  route.provider_roles = {
    design: route.design_provider ? WEB_PROVIDER_REGISTRY[route.design_provider]?.role || null : null,
    build: route.build_provider ? WEB_PROVIDER_REGISTRY[route.build_provider]?.role || null : null,
    hosting: route.hosting_provider ? WEB_PROVIDER_REGISTRY[route.hosting_provider]?.role || null : null
  };
  route.cost_metadata = costMetadata(route, request);
  route.constraints = {
    production_deploy: false,
    paid_activation_authorized: false,
    automatic_paid_overflow: false,
    variable_cost_ceiling_eur: 0,
    framer_hosting_default: false,
    prefer_cloudflare_for_native_artifact: true
  };

  return {
    schema: 'riosystems.web-provider-route.v1',
    selected: route,
    rationale: complexCms
      ? 'Complex CMS requirement selects Webflow as a specialist candidate and requires operator review.'
      : rapid
        ? 'Rapid experimental request selects Lovable as a prototype candidate and requires operator review.'
        : premium
          ? 'Premium visual request uses Framer only for design direction, then reconstructs in RIOSYSTEMS-owned code and prefers Cloudflare hosting.'
          : 'Simple scalable repeatable request stays on the native RIOSYSTEMS builder and prefers Cloudflare.',
    alternatives: Object.values(ROUTES).filter((item) => item.route_id !== route.route_id).map((item) => item.route_id)
  };
}
