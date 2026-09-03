import assert from 'node:assert/strict';
import {
  classifyProjectSourceDnsError,
  createProjectSourceWorkerResolver,
  resolveProjectSourceHostname
} from '../src/project-source-worker-dns-resolver-v1.js';
import { importProjectWebsiteSource } from '../src/project-source-website-import-v1.js';
import { validateProjectAssetFetchTarget } from '../src/scraper.js';

function dnsError(code, message = code) {
  return Object.assign(new Error(message), { code });
}

// Reproduce the canonical defect: scraper's legacy fallback couples DNS to an HTTP DoH
// subrequest and collapses its thrown transport error to DNS_RESOLUTION_FAILED.
{
  const legacy = await validateProjectAssetFetchTarget({ url: 'https://example.com/' }, {
    fetcher: async (input) => {
      assert.equal(String(input).startsWith('https://cloudflare-dns.com/dns-query?'), true);
      throw new TypeError('simulated Worker DoH transport failure');
    }
  });
  assert.equal(legacy.ok, false);
  assert.equal(legacy.error, 'DNS_RESOLUTION_FAILED');
}

// A valid public A answer survives an absent AAAA answer.
{
  const dns_resolver = {
    async resolve4() { return ['93.184.216.34']; },
    async resolve6() { throw dnsError('ENODATA'); }
  };
  assert.deepEqual(await resolveProjectSourceHostname('example.com', { dns_resolver }), ['93.184.216.34']);
}

// NXDOMAIN / no address is not a transport failure, including the full Source Intake path.
{
  const dns_resolver = {
    async resolve4() { throw dnsError('ENOTFOUND'); },
    async resolve6() { throw dnsError('ENODATA'); }
  };
  assert.deepEqual(await resolveProjectSourceHostname('missing.invalid', { dns_resolver }), []);
  const result = await importProjectWebsiteSource({ source_url: 'https://missing.invalid/' }, {
    dns_resolver,
    fetcher: async () => { throw new Error('site fetch must not run without a public address'); }
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'DNS_NO_PUBLIC_ADDRESS');
}

// Timeout is distinct from resolver/transport failure, including the full Source Intake path.
{
  const dns_resolver = {
    async resolve4() { throw dnsError('ETIMEOUT'); },
    async resolve6() { throw dnsError('ETIMEOUT'); }
  };
  await assert.rejects(() => resolveProjectSourceHostname('timeout.example', { dns_resolver }), (error) => error.code === 'DNS_RESOLUTION_TIMEOUT');
  assert.equal(classifyProjectSourceDnsError(dnsError('ETIMEOUT')), 'DNS_RESOLUTION_TIMEOUT');
  const result = await importProjectWebsiteSource({ source_url: 'https://timeout.example/' }, {
    dns_resolver,
    fetcher: async () => { throw new Error('site fetch must not run on DNS timeout'); }
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'DNS_RESOLUTION_TIMEOUT');
  assert.equal(result.legacy_error, 'DNS_RESOLUTION_FAILED');
}

// SERVFAIL / resolver transport failure is distinct from NXDOMAIN and timeout.
{
  const dns_resolver = {
    async resolve4() { throw dnsError('ESERVFAIL'); },
    async resolve6() { throw dnsError('ECONNREFUSED'); }
  };
  await assert.rejects(() => resolveProjectSourceHostname('resolver-failure.example', { dns_resolver }), (error) => error.code === 'DNS_RESOLVER_FAILURE');
  const result = await importProjectWebsiteSource({ source_url: 'https://resolver-failure.example/' }, {
    dns_resolver,
    fetcher: async () => { throw new Error('site fetch must not run on resolver failure'); }
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'DNS_RESOLVER_FAILURE');
  assert.equal(result.legacy_error, 'DNS_RESOLUTION_FAILED');
}

// Rebinding is fail-closed when a hostname changes answers during one import session.
{
  let round = 0;
  const dns_resolver = {
    async resolve4() { round += 1; return [round <= 1 ? '93.184.216.34' : '10.0.0.7']; },
    async resolve6() { throw dnsError('ENODATA'); }
  };
  const session = createProjectSourceWorkerResolver({ dns_resolver });
  assert.deepEqual(await session.resolveHostname('rebinding.example'), ['93.184.216.34']);
  await assert.rejects(() => session.resolveHostname('rebinding.example'), (error) => error.code === 'DNS_REBINDING_DETECTED');
}

// Private DNS answers are still blocked by the existing SSRF validator before any site fetch.
{
  let fetched = false;
  const dns_resolver = {
    async resolve4() { return ['10.0.0.7']; },
    async resolve6() { throw dnsError('ENODATA'); }
  };
  const result = await importProjectWebsiteSource({ source_url: 'https://private.example/' }, {
    dns_resolver,
    fetcher: async () => { fetched = true; throw new Error('must not fetch private target'); }
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'DNS_PRIVATE_TARGET_BLOCKED');
  assert.equal(fetched, false);
}

// Metadata/link-local literal remains blocked before DNS or fetch.
{
  let fetched = false;
  const result = await importProjectWebsiteSource({ source_url: 'http://169.254.169.254/latest/meta-data' }, {
    fetcher: async () => { fetched = true; throw new Error('must not fetch metadata'); }
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'PRIVATE_OR_LOCAL_HOST_BLOCKED');
  assert.equal(fetched, false);
}

console.log(JSON.stringify({
  ok: true,
  suite: 'project-source-dns-resolver-v1',
  legacy_dns_resolution_failed_reproduced: true,
  public_a_with_no_aaaa: 'PASS',
  nxdomain_no_public_address: 'PASS',
  timeout_classification: 'PASS',
  resolver_transport_failure_classification: 'PASS',
  private_target_fail_closed: 'PASS',
  metadata_fail_closed: 'PASS',
  dns_rebinding_fail_closed: 'PASS',
  variable_cost_eur: 0,
  paid_provider_calls: 0,
  production_deploy: false
}, null, 2));
