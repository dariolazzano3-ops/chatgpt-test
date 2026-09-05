#!/usr/bin/env node
import { quickImportProjectWebsite } from '../src/scraper.js';

const result = await quickImportProjectWebsite({
  source_url: 'https://gelato-donatello.de/',
  max_pages: 20,
  max_depth: 2,
  discover_sitemap: true
});

if (!result.ok) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}

const pageSummaries = (result.pages || []).map((page) => ({
  url: page.url,
  title: page.title,
  description: page.description,
  h1: page.headings?.h1 || [],
  h2: page.headings?.h2 || [],
  h3: page.headings?.h3 || [],
  contacts: page.contacts || {},
  prices: page.prices || [],
  services_products: page.service_product_candidates || [],
  opening_hours: page.opening_hour_candidates || [],
  addresses: page.address_candidates || [],
  legal_links: page.legal_links || [],
  social_links: page.social_links || [],
  ctas: page.ctas || [],
  image_candidates: page.image_candidates || [],
  visible_text: String(page.visible_text || '').slice(0, 20000)
}));

console.log(JSON.stringify({
  schema: 'aurentara.gelato-live-source-closure-capture.v1',
  captured_at: new Date().toISOString(),
  import_status: result.import_status,
  source_url: result.source_url,
  canonical_source_url: result.canonical_source_url,
  pages_analyzed: result.pages_analyzed,
  robots_status: result.robots_status,
  business_facts: result.business_facts,
  conversion_inventory: result.conversion_inventory,
  extracted_candidates: result.extracted_candidates,
  asset_candidates: result.asset_candidates,
  pages: pageSummaries,
  fetch_errors: result.fetch_errors,
  safety: {
    forms_submitted: result.forms_submitted,
    post_requests: result.post_requests,
    authentication_attempts: result.authentication_attempts,
    paid_provider_calls: result.paid_provider_calls,
    ai_inference_calls: result.ai_inference_calls,
    variable_cost_eur: result.variable_cost_eur,
    production_deploy: result.production_deploy
  }
}, null, 2));
