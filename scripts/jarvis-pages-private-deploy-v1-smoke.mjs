import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow = fs.readFileSync('.github/workflows/jarvis-pages-private-deploy-v1.yml', 'utf8');

assert.match(workflow, /jarvis-private-core/);
assert.match(workflow, /private-staging/);
assert.match(workflow, /--commit-hash/);
assert.match(workflow, /JARVIS_PAGES_CLOUDFLARE_PREFLIGHT_OK/);
assert.match(workflow, /secrets\.JARVIS_CLOUDFLARE_API_TOKEN/);
assert.match(workflow, /secrets\.JARVIS_CLOUDFLARE_ACCOUNT_ID/);
assert.doesNotMatch(workflow, /secrets\.CLOUDFLARE_API_TOKEN/);
assert.doesNotMatch(workflow, /secrets\.CLOUDFLARE_ACCOUNT_ID/);
assert.doesNotMatch(workflow, /ysrio\.com/i);
assert.doesNotMatch(workflow, /workers\.dev/i);
assert.doesNotMatch(workflow, /--branch\s+production-disabled/);
assert.doesNotMatch(workflow, /JARVIS_PERSONAL_MEMORY_SUPABASE_SERVICE_ROLE_KEY:\s*\$\{\{/);
assert.doesNotMatch(workflow, /JARVIS_ACCESS_AUD:\s*\$\{\{/);

console.log('JARVIS Pages Exact-Head Deploy Gate V1 smoke: PASS');
