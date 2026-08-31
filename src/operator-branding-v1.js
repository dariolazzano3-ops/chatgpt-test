const INTERNAL_TECHNOLOGY_NAME = 'RIOSYSTEMS';
const OPERATIVE_BRAND_NAME = 'AURENTARA SYSTEMS';

export async function applyOperatorBranding(response) {
  if (!(response instanceof Response)) return response;
  const type = response.headers.get('content-type') || '';
  if (response.status !== 200 || !type.includes('text/html')) return response;

  const source = await response.text();
  const body = source.replaceAll(INTERNAL_TECHNOLOGY_NAME, OPERATIVE_BRAND_NAME);
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.set('x-aurentara-brand-layer', 'operator-presentation-v1');

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export function operatorBrandingManifest() {
  return {
    schema: 'riosystems.operator-branding.v1',
    parent_brand: 'YSRIO GROUP',
    operative_brand: OPERATIVE_BRAND_NAME,
    internal_technology: INTERNAL_TECHNOLOGY_NAME,
    scope: 'operator_html_presentation_only',
    api_contracts_renamed: false,
    runtime_namespaces_renamed: false,
    provider_logic_changed: false,
    production_deploy: false
  };
}
