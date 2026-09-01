import {
  createCustomerTrustedRetrievalBinding,
  createCustomerObservabilityBinding
} from './external-capability-bindings-v1.js';
import { classifyBusinessRisk } from '../customer-ai/trusted-research-v1.js';

const clean = (value, max = 12000) => String(value ?? '').trim().slice(0, max);
const now = () => new Date().toISOString();

const REGISTRY = Object.freeze({
  MINIMUM_WAGE: [
    {
      url: 'https://www.bmas.de/DE/Arbeit/Arbeitsrecht/Mindestlohn/Informationen-zum-Mindestlohn/informationen-zum-mindestlohn-deutsch.html',
      publisher: 'Bundesministerium für Arbeit und Soziales',
      jurisdiction: 'DE'
    },
    {
      url: 'https://www.gesetze-im-internet.de/milog/',
      publisher: 'Bundesministerium der Justiz / Bundesamt für Justiz',
      jurisdiction: 'DE'
    }
  ],
  EMPLOYMENT_LAW: [
    {
      url: 'https://www.gesetze-im-internet.de/arbzg/BJNR117100994.html',
      publisher: 'Bundesministerium der Justiz / Bundesamt für Justiz',
      jurisdiction: 'DE'
    }
  ],
  TAX: [
    {
      url: 'https://www.gesetze-im-internet.de/ustg_1980/BJNR119530979.html',
      publisher: 'Bundesministerium der Justiz / Bundesamt für Justiz',
      jurisdiction: 'DE'
    }
  ],
  LEGAL_CONTRACT: [
    {
      url: 'https://www.gesetze-im-internet.de/bgb/BJNR001950896.html',
      publisher: 'Bundesministerium der Justiz / Bundesamt für Justiz',
      jurisdiction: 'DE'
    }
  ],
  REGULATORY: [
    {
      url: 'https://www.gesetze-im-internet.de/gewo/__14.html',
      publisher: 'Bundesministerium der Justiz / Bundesamt für Justiz',
      jurisdiction: 'DE'
    }
  ],
  FOOD_SAFETY: [
    {
      url: 'https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32004R0852',
      publisher: 'EUR-Lex / Europäische Union',
      jurisdiction: 'EU'
    }
  ],
  HEALTH_SAFETY: [
    {
      url: 'https://www.gesetze-im-internet.de/arbschg/BJNR124610996.html',
      publisher: 'Bundesministerium der Justiz / Bundesamt für Justiz',
      jurisdiction: 'DE'
    }
  ],
  INSURANCE: [
    {
      url: 'https://www.gesetze-im-internet.de/vvg_2008/BJNR263110007.html',
      publisher: 'Bundesministerium der Justiz / Bundesamt für Justiz',
      jurisdiction: 'DE'
    }
  ]
});

const ALLOWED_HOSTS = Object.freeze(new Set([
  'www.bmas.de',
  'www.gesetze-im-internet.de',
  'gesetze-im-internet.de',
  'eur-lex.europa.eu'
]));

function decodeEntities(value = '') {
  return String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function stripHtml(html = '') {
  return decodeEntities(String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, '\n'))
    .replace(/[\t\r ]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function htmlTitle(html = '', fallback = '') {
  const match = String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return clean(match ? stripHtml(match[1]) : fallback, 500) || null;
}

function queryTokens(query = '') {
  const stop = new Set(['der','die','das','und','oder','ein','eine','einer','ist','sind','wie','was','mit','für','fuer','the','and','or','what','how','is','are']);
  return [...new Set(clean(query, 4000).toLowerCase().split(/[^a-z0-9äöüß]+/i).filter((t) => t.length >= 4 && !stop.has(t)))].slice(0, 20);
}

function selectEvidence(text = '', query = '', topic = '') {
  const tokens = queryTokens(`${query} ${topic}`);
  const chunks = clean(text, 120000).split(/\n+/).map((line) => clean(line, 1200)).filter((line) => line.length >= 30);
  const scored = chunks.map((line, index) => ({
    line,
    index,
    score: tokens.reduce((sum, token) => sum + (line.toLowerCase().includes(token) ? 2 : 0), 0)
  }));
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  const selected = scored.filter((item) => item.score > 0).slice(0, 14);
  const fallback = selected.length ? selected : scored.slice(0, 10);
  return clean(fallback.map((item) => item.line).join('\n'), 6000);
}

function registryKey(query, risk) {
  const value = clean(query, 4000).toLowerCase();
  if (value.includes('mindestlohn') || value.includes('minimum wage')) return 'MINIMUM_WAGE';
  return risk.topic;
}

function sourcesFor(query, jurisdiction = 'DE') {
  const normalizedJurisdiction = clean(jurisdiction, 20).toUpperCase();
  if (!['DE','EU','DE/EU'].includes(normalizedJurisdiction)) return [];
  const risk = classifyBusinessRisk(query, { jurisdiction: normalizedJurisdiction });
  return REGISTRY[registryKey(query, risk)] || [];
}

async function fetchRegistrySource(source, input = {}, fetchImpl = fetch) {
  const url = new URL(source.url);
  if (!ALLOWED_HOSTS.has(url.hostname.toLowerCase())) return { ok: false, error: 'OFFICIAL_SOURCE_HOST_NOT_ALLOWED' };
  const response = await fetchImpl(source.url, {
    method: 'GET',
    redirect: 'follow',
    headers: { 'accept': 'text/html,application/xhtml+xml;q=0.9,text/plain;q=0.8' },
    signal: typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(7000) : undefined
  });
  if (!response?.ok) return { ok: false, error: `OFFICIAL_SOURCE_HTTP_${response?.status || 0}` };
  const finalUrl = new URL(response.url || source.url);
  if (!ALLOWED_HOSTS.has(finalUrl.hostname.toLowerCase())) return { ok: false, error: 'OFFICIAL_SOURCE_REDIRECT_NOT_ALLOWED' };
  const html = await response.text();
  const text = stripHtml(html);
  const evidence = selectEvidence(text, input.query, input.topic);
  if (!evidence) return { ok: false, error: 'OFFICIAL_SOURCE_EVIDENCE_EMPTY' };
  return {
    ok: true,
    source: {
      url: finalUrl.toString(),
      title: htmlTitle(html, source.publisher),
      publisher: source.publisher,
      jurisdiction: source.jurisdiction,
      retrieved_at: input.retrieved_at || now(),
      updated_at: response.headers?.get?.('last-modified') || null,
      evidence_text: evidence
    }
  };
}

export function createGermanyEuOfficialRetrievalBinding(options = {}) {
  const fetchImpl = options.fetch_impl || fetch;
  const active = options.provider_active === true;
  return createCustomerTrustedRetrievalBinding({
    provider_id: 'official-de-eu-http-v1',
    provider_active: active,
    synthetic_fixture: options.synthetic_fixture === true,
    retrieve: async (input = {}) => {
      const selected = sourcesFor(input.query, input.jurisdiction);
      if (!selected.length) return { ok: false, error: 'OFFICIAL_SOURCE_REGISTRY_NO_MATCH', sources: [] };
      const risk = classifyBusinessRisk(input.query, { jurisdiction: input.jurisdiction });
      const results = await Promise.all(selected.slice(0, Math.min(3, Number(input.max_sources || 3))).map((source) =>
        fetchRegistrySource(source, { query: input.query, topic: risk.topic, retrieved_at: input.retrieved_at }, fetchImpl)
      ));
      const sources = results.filter((item) => item.ok).map((item) => item.source);
      if (!sources.length) return { ok: false, error: 'OFFICIAL_SOURCE_RETRIEVAL_FAILED', sources: [] };
      return { ok: true, sources };
    }
  });
}

export function createCloudflareCustomerObservabilityBinding(options = {}) {
  const logger = typeof options.logger === 'function' ? options.logger : console.log;
  return createCustomerObservabilityBinding({
    provider_id: 'cloudflare-worker-logs-v1',
    sink_active: options.sink_active === true,
    synthetic_fixture: options.synthetic_fixture === true,
    emit: async (event) => {
      logger(JSON.stringify({ channel: 'aurentara.customer.observability', ...event }));
      return { ok: true };
    }
  });
}

export function productionLiveBindingsManifest() {
  return {
    version: 'aurentara.customer.production-live-bindings.v1',
    official_retrieval_registry_ready: true,
    arbitrary_user_url_fetch_forbidden: true,
    allowed_official_hosts: [...ALLOWED_HOSTS],
    cloudflare_redacted_observability_ready: true,
    no_new_paid_provider: true,
    variable_cost_eur: 0
  };
}
