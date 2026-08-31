const INTERNAL_TECHNOLOGY_NAME = 'RIOSYSTEMS';
const OPERATIVE_BRAND_NAME = 'AURENTARA SYSTEMS';
const OPERATOR_SURFACE_NAME = 'Operator Control';
const PARENT_BRAND_NAME = 'YSRIO GROUP';
const BROWSER_TITLE = `${OPERATIVE_BRAND_NAME} | ${OPERATOR_SURFACE_NAME}`;
const APPLICATION_DESCRIPTION = 'Private operator control environment for AURENTARA SYSTEMS.';

function injectOperatorMetadata(source) {
  if (!source.includes('</head>')) return source;

  const metadata = [
    `<meta name="application-name" content="${OPERATIVE_BRAND_NAME} ${OPERATOR_SURFACE_NAME}">`,
    `<meta name="description" content="${APPLICATION_DESCRIPTION}">`
  ].join('');

  if (source.includes('name="application-name"')) return source;
  return source.replace('</head>', `${metadata}</head>`);
}

export async function applyOperatorBranding(response) {
  if (!(response instanceof Response)) return response;
  const type = response.headers.get('content-type') || '';
  if (response.status !== 200 || !type.includes('text/html')) return response;

  const source = await response.text();
  let body = source.replaceAll(INTERNAL_TECHNOLOGY_NAME, OPERATIVE_BRAND_NAME);
  body = body
    .replace(`<title>${OPERATIVE_BRAND_NAME} Operator Control Plane</title>`, `<title>${BROWSER_TITLE}</title>`)
    .replace(`<strong>${OPERATIVE_BRAND_NAME}</strong><span>Private Operator Control Plane</span>`, `<strong>${OPERATIVE_BRAND_NAME}</strong><span>${OPERATOR_SURFACE_NAME}</span>`);
  body = injectOperatorMetadata(body);

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
    parent_brand: PARENT_BRAND_NAME,
    operative_brand: OPERATIVE_BRAND_NAME,
    operator_surface: OPERATOR_SURFACE_NAME,
    browser_title: BROWSER_TITLE,
    parent_brand_prominent_in_dashboard: false,
    internal_technology: INTERNAL_TECHNOLOGY_NAME,
    scope: 'operator_html_presentation_only',
    api_contracts_renamed: false,
    runtime_namespaces_renamed: false,
    provider_logic_changed: false,
    dns_changed: false,
    custom_domain_changed: false,
    production_deploy: false
  };
}
