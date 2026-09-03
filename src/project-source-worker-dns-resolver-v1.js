import dns from 'node:dns';

const DEFAULT_TIMEOUT_MS = 4_000;
const NO_ADDRESS_CODES = new Set(['ENODATA', 'ENOTFOUND', 'ENONAME', 'DNS_NXDOMAIN', 'NXDOMAIN']);
const TIMEOUT_CODES = new Set(['ETIMEOUT', 'DNS_TIMEOUT', 'DNS_RESOLUTION_TIMEOUT']);

function cleanHostname(value) {
  return String(value || '').trim().toLowerCase().replace(/\.$/, '');
}

function isIpLiteral(hostname) {
  const value = cleanHostname(hostname).replace(/^\[/, '').replace(/\]$/, '');
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(value) || value.includes(':');
}

function codedError(code, cause = null) {
  const error = new Error(code);
  error.code = code;
  if (cause) error.cause = cause;
  return error;
}

export function classifyProjectSourceDnsError(error) {
  const code = String(error?.code || error?.name || '').toUpperCase();
  const message = String(error?.message || '').toUpperCase();
  if (NO_ADDRESS_CODES.has(code) || /\bNXDOMAIN\b|NOT FOUND|NO DATA/.test(message)) return 'DNS_NO_PUBLIC_ADDRESS';
  if (TIMEOUT_CODES.has(code) || error?.name === 'AbortError' || /TIMEOUT|TIMED OUT/.test(message)) return 'DNS_RESOLUTION_TIMEOUT';
  if (code === 'DNS_REBINDING_DETECTED') return 'DNS_REBINDING_DETECTED';
  return 'DNS_RESOLVER_FAILURE';
}

function withTimeout(promise, timeoutMs) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(codedError('DNS_RESOLUTION_TIMEOUT')), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function resolveFamily(resolver, hostname, family, timeoutMs) {
  const method = family === 4 ? 'resolve4' : 'resolve6';
  if (!resolver || typeof resolver[method] !== 'function') throw codedError('DNS_RESOLVER_FAILURE');
  try {
    const values = await withTimeout(Promise.resolve(resolver[method](hostname)), timeoutMs);
    return Array.isArray(values) ? values.map((value) => typeof value === 'string' ? value : value?.address).filter(Boolean) : [];
  } catch (error) {
    const classified = classifyProjectSourceDnsError(error);
    if (classified === 'DNS_NO_PUBLIC_ADDRESS') return [];
    throw codedError(classified, error);
  }
}

export async function resolveProjectSourceHostname(hostname, options = {}) {
  const normalized = cleanHostname(hostname);
  if (!normalized) throw codedError('DNS_RESOLVER_FAILURE');
  if (isIpLiteral(normalized)) return [normalized.replace(/^\[/, '').replace(/\]$/, '')];

  const resolver = options.dns_resolver || dns.promises;
  const timeoutMs = Math.max(250, Math.min(Number(options.timeout_ms) || DEFAULT_TIMEOUT_MS, 5_000));
  const settled = await Promise.allSettled([
    resolveFamily(resolver, normalized, 4, timeoutMs),
    resolveFamily(resolver, normalized, 6, timeoutMs)
  ]);

  const addresses = settled.flatMap((item) => item.status === 'fulfilled' ? item.value : []);
  if (addresses.length) return [...new Set(addresses.map(String))];

  const failures = settled.filter((item) => item.status === 'rejected').map((item) => classifyProjectSourceDnsError(item.reason));
  if (!failures.length) return [];
  if (failures.includes('DNS_RESOLUTION_TIMEOUT')) throw codedError('DNS_RESOLUTION_TIMEOUT');
  throw codedError('DNS_RESOLVER_FAILURE');
}

function stableSet(values = []) {
  return [...new Set(values.map((value) => String(value).toLowerCase()))].sort();
}

export function createProjectSourceWorkerResolver(options = {}) {
  const pinned = new Map();
  const lastErrors = new Map();

  const resolveHostname = async (hostname) => {
    const key = cleanHostname(hostname);
    try {
      const addresses = stableSet(await resolveProjectSourceHostname(key, options));
      const prior = pinned.get(key);
      if (prior && (prior.length !== addresses.length || prior.some((value, index) => value !== addresses[index]))) {
        const error = codedError('DNS_REBINDING_DETECTED');
        lastErrors.set(key, error.code);
        throw error;
      }
      if (!prior) pinned.set(key, addresses);
      lastErrors.delete(key);
      return addresses;
    } catch (error) {
      const code = classifyProjectSourceDnsError(error);
      lastErrors.set(key, code);
      throw codedError(code, error);
    }
  };

  return {
    resolveHostname,
    errorFor(hostname) { return lastErrors.get(cleanHostname(hostname)) || null; },
    lastError() { return [...lastErrors.values()].at(-1) || null; },
    pinnedAddresses(hostname) { return [...(pinned.get(cleanHostname(hostname)) || [])]; },
    manifest: {
      schema: 'aurentara.project-source-worker-dns-resolver.v1',
      runtime: 'cloudflare-workers-node-dns',
      resolver_transport: 'node:dns',
      dns_rebinding_fail_closed: true,
      private_target_validation_delegated_to_existing_ssrf_validator: true,
      variable_cost_eur: 0,
      paid_provider_calls: 0,
      production_deploy: false
    }
  };
}
