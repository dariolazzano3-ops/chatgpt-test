import { formatOperatorBerlinTimestamp } from './operator-final-human-ux-localization-v1.js';

function localizeDeploymentHeader(source = '') {
  return String(source).replace(/(<div class="deployment-identity-v1"[^>]*>[\s\S]*?<b>)([^<]+)(<\/b>)/, (match, prefix, label, suffix) => {
    const parts = String(label).split(' · ');
    if (parts.length < 3) return match;
    const environment = String(parts[0] || '').trim();
    const version = String(parts[1] || '').trim();
    const deployment = parts.slice(2).join(' · ').trim();
    const timeMatch = deployment.match(/^deployed (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) UTC$/i);
    const timestamp = timeMatch ? `${timeMatch[1]}T${timeMatch[2]}:00Z` : null;
    const time = timestamp ? formatOperatorBerlinTimestamp(timestamp) : 'Bereitstellungszeit unbekannt';
    return `${prefix}${environment} · ${version} · bereitgestellt<div class="operator-deployment-time">${time}</div>${suffix}`;
  })
    .replace(/Production:\s*LOCKED/g, 'Produktion: GESPERRT')
    .replace(/External Writes:\s*LOCKED/g, 'Externe Schreibzugriffe: GESPERRT')
    .replace(/Production:\s*ACTIVE/g, 'Produktion: AKTIV')
    .replace(/External Writes:\s*ACTIVE/g, 'Externe Schreibzugriffe: AKTIV');
}

export async function applyOperatorDeploymentLocalization(response) {
  if (!(response instanceof Response)) return response;
  const type = response.headers.get('content-type') || '';
  if (response.status !== 200 || !type.includes('text/html')) return response;
  const source = await response.text();
  const body = localizeDeploymentHeader(source);
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.set('x-aurentara-deployment-localization', 'de-DE-Europe-Berlin-v1');
  return new Response(body, { status: response.status, statusText: response.statusText, headers });
}

export function operatorDeploymentLocalizationManifest() {
  return {
    schema: 'aurentara.operator-deployment-localization.v1',
    locale: 'de-DE',
    time_zone: 'Europe/Berlin',
    stored_utc_unchanged: true,
    production_policy_unchanged: true,
    external_write_policy_unchanged: true,
    production_deploy: false,
    variable_cost_eur: 0
  };
}
