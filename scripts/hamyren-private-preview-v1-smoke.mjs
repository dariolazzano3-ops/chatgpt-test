import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const previewDir = path.join(root, 'projects/riosystems-public-website-v1/hamyren');

const read = (name) => fs.readFile(path.join(previewDir, name), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [indexHtml, experienceHtml, css, js, projectRaw, parentHeaders, aurentaraApp] = await Promise.all([
  read('index.html'),
  read('experience.html'),
  read('hamyren.css'),
  read('hamyren.js'),
  read('project.json'),
  fs.readFile(path.join(root, 'projects/riosystems-public-website-v1/_headers'), 'utf8'),
  fs.readFile(path.join(root, 'projects/riosystems-public-website-v1/app.js'), 'utf8')
]);

const project = JSON.parse(projectRaw);

assert(project.schema === 'aurentara.hamyren-private-preview.v1', 'Unexpected preview schema');
assert(project.product?.name === 'HAMYREN', 'HAMYREN product identity missing');
assert(project.product?.maker === 'AURENTARA SYSTEMS', 'AURENTARA maker identity missing');
assert(project.environment === 'private-preview', 'Preview environment must remain private-preview');
assert(project.runtime_rebuilt === false, 'Preview must not rebuild runtime');
assert(project.operator_control_plane_rebuilt === false, 'Preview must not rebuild Operator Control Plane');
assert(project.synthetic_demo_data_only === true, 'Synthetic demo data gate must remain true');
assert(project.external_network_requests === false, 'External network requests must remain false');
assert(project.real_customer_data === false, 'Real customer data must remain false');
assert(project.real_customer_ai_processing === false, 'Real-customer AI processing must remain false');
assert(project.public_customer_surface_active === false, 'Public Customer Surface must remain false');
assert(project.billing_active === false && project.stripe_active === false && project.checkout_active === false, 'Billing/Stripe/checkout must remain false');
assert(project.paid_provider_calls === false, 'Paid provider calls must remain false');
assert(project.production_deploy === false, 'Production deploy must remain false');
assert(project.domain_or_dns_change === false, 'Domain/DNS changes must remain false');
assert(project.variable_cost_limit_eur === 0, 'Variable cost limit must remain EUR 0');
assert(project.free_business_question_limit === 5, 'Documented free-question limit must remain exactly five');
assert(project.automatic_account_creation === false, 'Automatic account creation must remain false');
assert(project.automatic_subscription_activation === false, 'Automatic subscription activation must remain false');
assert(project.legal_privacy_review_complete === false, 'Legal/privacy review must not be represented as complete');

assert(parentHeaders.includes('X-Robots-Tag: noindex, nofollow'), 'Parent noindex header missing');
assert(parentHeaders.includes("connect-src 'none'"), 'Parent CSP must deny network connections for static preview');
assert(parentHeaders.includes('payment=()'), 'Payment browser permission must remain denied');

for (const [name, html] of [['index.html', indexHtml], ['experience.html', experienceHtml]]) {
  assert(/<meta\s+name="robots"\s+content="noindex,nofollow,noarchive"\s*\/?>/i.test(html), `${name} must remain noindex`);
  assert(!/<script[^>]+src=["']https?:/i.test(html), `${name} must not load external scripts`);
  assert(!/<link[^>]+href=["']https?:/i.test(html), `${name} must not load external styles/fonts`);
  assert(!/<form[^>]+action=/i.test(html), `${name} must not submit forms to a server`);
}

const forbiddenPreviewRuntimePatterns = [
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\bWebSocket\b/,
  /\bEventSource\b/,
  /sendBeacon\s*\(/,
  /\blocalStorage\b/,
  /\bsessionStorage\b/,
  /\bindexedDB\b/,
  /document\.cookie/,
  /\bStripe\s*\(/,
  /QUESTION_LIMIT/,
  /questionsUsed/,
  /simulatedAnswer/,
  /activateJourney\s*\(/,
  /completeJourney\s*\(/
];
for (const pattern of forbiddenPreviewRuntimePatterns) {
  assert(!pattern.test(js), `Static preview must not contain a duplicate product/trial engine: ${pattern}`);
}

assert(experienceHtml.includes('href="/customer"'), 'Bridge must point to canonical /customer Product Surface');
assert(experienceHtml.includes('No duplicate trial engine'), 'Bridge must explicitly preserve one-engine architecture');
assert(experienceHtml.includes('bestehende Account-Core'), 'Existing Account Core handoff statement missing');
assert(js.includes('data-canonical-pricing-bridge'), 'Static HAMYREN overview must replace duplicate pricing with canonical runtime bridge');
assert(js.includes("href=\"/customer\""), 'Canonical pricing bridge must target /customer');
assert(aurentaraApp.includes("const hamyrenHref = './hamyren/index.html';"), 'AURENTARA → HAMYREN entry point missing');
assert(aurentaraApp.includes('data.hamyrenEntry'), 'AURENTARA HAMYREN entry marker missing');
assert(indexHtml.includes('./experience.html'), 'HAMYREN overview must retain separate Test Experience bridge');
assert(indexHtml.includes('../index.html'), 'HAMYREN → AURENTARA return path missing');
assert(css.includes('@media(max-width:720px)'), 'Dedicated mobile product treatment missing');
assert(css.includes('@media(prefers-reduced-motion:reduce)'), 'Reduced-motion treatment missing');

console.log('HAMYREN private preview smoke: PASS');
console.log(JSON.stringify({
  product: project.product.name,
  environment: project.environment,
  static_trial_engine_present: false,
  static_pricing_source_of_truth: false,
  canonical_product_route: '/customer',
  aurentara_to_hamyren: true,
  hamyren_to_aurentara: true,
  free_business_question_limit: project.free_business_question_limit,
  public_customer_surface_active: project.public_customer_surface_active,
  real_customer_ai_processing: project.real_customer_ai_processing,
  billing_active: project.billing_active,
  production_deploy: project.production_deploy,
  variable_cost_limit_eur: project.variable_cost_limit_eur
}, null, 2));
