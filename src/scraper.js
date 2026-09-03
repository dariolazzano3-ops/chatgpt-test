const MAX_PAGES_DEFAULT = 6;
const MAX_PAGES_HARD = 12;
const MAX_HTML_BYTES = 1_000_000;
const MAX_AUX_BYTES = 250_000;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;
const MAX_CRAWL_DEPTH = 2;

function clean(value, max = 500) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function decodeEntities(value = "") {
  return String(value)
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripTags(value = "", max = 2000) {
  return clean(
    decodeEntities(
      String(value)
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
        .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
        .replace(/<[^>]+>/g, " ")
    ),
    max
  );
}

function parseIpv4(host) {
  const parts = String(host || "").split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return parts;
}

function isBlockedIpv4(host) {
  const parts = parseIpv4(host);
  if (!parts) return false;
  const [a, b, c] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 100 && b >= 64 && b <= 127 ||
    a === 127 ||
    a === 169 && b === 254 ||
    a === 172 && b >= 16 && b <= 31 ||
    a === 192 && b === 0 && c === 0 ||
    a === 192 && b === 0 && c === 2 ||
    a === 192 && b === 168 ||
    a === 198 && (b === 18 || b === 19) ||
    a === 198 && b === 51 && c === 100 ||
    a === 203 && b === 0 && c === 113 ||
    a >= 224
  );
}

function normalizeIpv6(host) {
  return String(host || "").toLowerCase().replace(/^\[/, "").replace(/\]$/, "").replace(/%[0-9a-z._-]+$/i, "");
}

function isIpv6Literal(host) {
  return normalizeIpv6(host).includes(":");
}

function mappedIpv4FromIpv6(host) {
  const value = normalizeIpv6(host);
  const match = /^(?:::ffff:)(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(value);
  return match?.[1] || null;
}

function isBlockedIpv6(host) {
  const value = normalizeIpv6(host);
  if (!isIpv6Literal(value)) return false;
  const mapped = mappedIpv4FromIpv6(value);
  if (mapped) return isBlockedIpv4(mapped);
  return (
    value === "::" ||
    value === "::1" ||
    value.startsWith("fc") ||
    value.startsWith("fd") ||
    /^fe[89ab][0-9a-f]:/i.test(value) ||
    value.startsWith("2001:db8:")
  );
}

function isBlockedHostname(hostname) {
  const h = String(hostname || "").toLowerCase().replace(/\.$/, "");
  return (
    !h ||
    h === "localhost" ||
    h.endsWith(".localhost") ||
    h.endsWith(".local") ||
    h.endsWith(".internal") ||
    h === "metadata" ||
    h === "metadata.google.internal" ||
    isBlockedIpv4(h) ||
    isBlockedIpv6(h)
  );
}

export function validatePublicUrl(input) {
  let url;
  try { url = new URL(String(input || "")); } catch { return { ok: false, error: "INVALID_URL" }; }
  if (!["http:", "https:"].includes(url.protocol)) return { ok: false, error: "UNSUPPORTED_PROTOCOL" };
  if (url.username || url.password) return { ok: false, error: "URL_CREDENTIALS_NOT_ALLOWED" };
  if (isBlockedHostname(url.hostname)) return { ok: false, error: "PRIVATE_OR_LOCAL_HOST_BLOCKED" };
  url.hash = "";
  return { ok: true, url };
}

function firstMatch(html, regex, max = 500) {
  const match = regex.exec(html);
  return match ? clean(stripTags(match[1], max), max) : null;
}

function allMatches(html, regex, limit = 30, max = 300) {
  const out = [];
  let match;
  regex.lastIndex = 0;
  while ((match = regex.exec(html)) && out.length < limit) {
    const value = clean(stripTags(match[1], max), max);
    if (value && !out.includes(value)) out.push(value);
  }
  return out;
}

function attr(tag, name) {
  const m = new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i").exec(tag);
  return m ? decodeEntities(m[1]).trim() : null;
}

function metaContent(html, key) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const name = (attr(tag, "name") || attr(tag, "property") || "").toLowerCase();
    if (name === key.toLowerCase()) return clean(attr(tag, "content"), 600) || null;
  }
  return null;
}

function isAuthLikeUrl(url) {
  const value = `${url.pathname}${url.search}`.toLowerCase();
  return /(?:^|\/)(?:login|log-in|signin|sign-in|auth|oauth|account|admin|wp-admin|checkout|cart)(?:\/|$|\?)/.test(value);
}

function extractLinks(html, baseUrl) {
  const links = [];
  const tags = html.match(/<a\b[^>]*href\s*=\s*["'][^"']+["'][^>]*>/gi) || [];
  for (const tag of tags) {
    const href = attr(tag, "href");
    if (!href || href.startsWith("#") || /^(?:mailto|tel|javascript|data):/i.test(href)) continue;
    try {
      const u = new URL(href, baseUrl);
      u.hash = "";
      if (u.origin === baseUrl.origin && ["http:", "https:"].includes(u.protocol) && !isAuthLikeUrl(u)) {
        const normalized = u.toString();
        if (!links.includes(normalized)) links.push(normalized);
      }
    } catch {}
  }
  return links.slice(0, 100);
}

function extractContacts(html) {
  const emails = [...new Set((html.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []).map((v) => v.toLowerCase()))].slice(0, 10);
  const phones = [...new Set((stripTags(html, 100_000).match(/(?:\+?\d[\d\s().\/-]{6,}\d)/g) || []).map((v) => clean(v, 40)))].slice(0, 10);
  return { emails, phones };
}

function extractPrices(html) {
  const text = stripTags(html, 100_000);
  return [...new Set((text.match(/\b\d{1,5}(?:[.,]\d{1,2})?\s?(?:€|EUR)\b/gi) || []).map((v) => clean(v, 30)))].slice(0, 50);
}

function extractJsonLd(html) {
  const blocks = [];
  const regex = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html)) && blocks.length < 20) {
    const raw = match[1].trim();
    if (!raw || raw.length > 200_000) continue;
    try { blocks.push(JSON.parse(raw)); } catch { blocks.push({ parse_error: true, raw_excerpt: clean(raw, 1000) }); }
  }
  return blocks;
}

function extractCandidateLinks(html, baseUrl) {
  const socialHosts = ["instagram.com", "facebook.com", "linkedin.com", "youtube.com", "tiktok.com", "x.com", "twitter.com"];
  const social = [];
  const legal = [];
  const tags = html.match(/<a\b[^>]*href\s*=\s*["'][^"']+["'][^>]*>/gi) || [];
  for (const tag of tags) {
    const href = attr(tag, "href");
    if (!href) continue;
    try {
      const url = new URL(href, baseUrl);
      if (socialHosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))) social.push(url.toString());
      if (/impressum|imprint|datenschutz|privacy|agb|terms|legal/i.test(`${url.pathname} ${stripTags(tag, 120)}`)) legal.push(url.toString());
    } catch {}
  }
  return { social_links: [...new Set(social)].slice(0, 20), legal_links: [...new Set(legal)].slice(0, 20) };
}

function extractImageCandidates(html, baseUrl) {
  const out = [];
  const tags = html.match(/<(?:img|source)\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const src = attr(tag, "src") || attr(tag, "data-src") || (attr(tag, "srcset") || "").split(/\s*,\s*/)[0]?.split(/\s+/)[0];
    if (!src || /^(?:data|blob):/i.test(src)) continue;
    try {
      const url = new URL(src, baseUrl);
      if (!["http:", "https:"].includes(url.protocol)) continue;
      const alt = clean(attr(tag, "alt"), 200) || null;
      const className = clean(attr(tag, "class"), 200) || null;
      const role = /logo/i.test(`${src} ${alt || ""} ${className || ""}`) ? "LOGO_CANDIDATE" : "IMAGE_CANDIDATE";
      if (!out.some((item) => item.url === url.toString())) out.push({ url: url.toString(), role, alt });
    } catch {}
    if (out.length >= 80) break;
  }
  return out;
}

function extractOpeningHourCandidates(html, jsonLd = []) {
  const candidates = [];
  const text = stripTags(html, 100_000);
  const patterns = [
    /(?:mo|montag|di|dienstag|mi|mittwoch|do|donnerstag|fr|freitag|sa|samstag|so|sonntag)[^\n.;]{0,60}\b\d{1,2}[:.]\d{2}\s*(?:-|–|bis)\s*\d{1,2}[:.]\d{2}/gi,
    /(?:öffnungszeiten|opening hours)[^\n]{0,160}/gi
  ];
  for (const pattern of patterns) for (const match of text.match(pattern) || []) candidates.push(clean(match, 220));
  const walk = (value) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) return value.forEach(walk);
    if (value.openingHours) candidates.push(clean(Array.isArray(value.openingHours) ? value.openingHours.join("; ") : value.openingHours, 500));
    if (value.openingHoursSpecification) candidates.push(clean(JSON.stringify(value.openingHoursSpecification), 1000));
    Object.values(value).forEach(walk);
  };
  jsonLd.forEach(walk);
  return [...new Set(candidates.filter(Boolean))].slice(0, 30);
}

function extractAddressCandidates(html, jsonLd = []) {
  const candidates = [];
  const text = stripTags(html, 100_000);
  for (const match of text.match(/\b[A-ZÄÖÜ][A-Za-zÄÖÜäöüß .'-]{2,60}\s+\d{1,4}[a-zA-Z]?,?\s+\d{5}\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß .'-]{2,60}\b/g) || []) candidates.push(clean(match, 220));
  const walk = (value) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) return value.forEach(walk);
    if (value.address) candidates.push(clean(typeof value.address === "string" ? value.address : JSON.stringify(value.address), 1000));
    Object.values(value).forEach(walk);
  };
  jsonLd.forEach(walk);
  return [...new Set(candidates.filter(Boolean))].slice(0, 30);
}

function extractServiceProductCandidates(html, jsonLd = []) {
  const candidates = [];
  const collect = (value) => {
    const cleaned = clean(value, 160);
    if (cleaned && cleaned.length >= 2 && cleaned.length <= 160) candidates.push(cleaned);
  };
  allMatches(html, /<(?:h2|h3|li)[^>]*>([\s\S]*?)<\/(?:h2|h3|li)>/gi, 80, 160).forEach(collect);
  const walk = (value) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) return value.forEach(walk);
    const type = Array.isArray(value['@type']) ? value['@type'].join(' ') : String(value['@type'] || '');
    if (/Product|Service|Offer|MenuItem/i.test(type)) collect(value.name || value.description);
    Object.values(value).forEach(walk);
  };
  jsonLd.forEach(walk);
  return [...new Set(candidates)].slice(0, 80);
}

function extractBrandSignals(html) {
  return {
    theme_color: metaContent(html, "theme-color"),
    og_site_name: metaContent(html, "og:site_name"),
    og_image: metaContent(html, "og:image"),
    favicon: (() => {
      const tags = html.match(/<link\b[^>]*>/gi) || [];
      for (const tag of tags) if (/icon/i.test(attr(tag, "rel") || "")) return attr(tag, "href");
      return null;
    })()
  };
}

function analyzeHtml(html, url) {
  const title = firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const h1 = allMatches(html, /<h1[^>]*>([\s\S]*?)<\/h1>/gi, 10);
  const h2 = allMatches(html, /<h2[^>]*>([\s\S]*?)<\/h2>/gi, 25);
  const h3 = allMatches(html, /<h3[^>]*>([\s\S]*?)<\/h3>/gi, 40);
  const navLabels = allMatches(html, /<a[^>]*>([\s\S]*?)<\/a>/gi, 50).filter((x) => x.length <= 80);
  const contacts = extractContacts(html);
  const prices = extractPrices(html);
  const links = extractLinks(html, url);
  const jsonLd = extractJsonLd(html);
  const visibleText = stripTags(html, 100_000);
  const ctaWords = ["kontakt", "anrufen", "buchen", "bestellen", "anfragen", "termin", "angebot", "jetzt", "reservieren"];
  const ctas = navLabels.filter((label) => ctaWords.some((word) => label.toLowerCase().includes(word))).slice(0, 15);
  const candidates = extractCandidateLinks(html, url);

  return {
    url: url.toString(),
    title,
    description: metaContent(html, "description"),
    canonical: (() => {
      const tags = html.match(/<link\b[^>]*>/gi) || [];
      for (const tag of tags) {
        if ((attr(tag, "rel") || "").toLowerCase().split(/\s+/).includes("canonical")) return attr(tag, "href");
      }
      return null;
    })(),
    headings: { h1, h2, h3 },
    navigation_labels: navLabels,
    visible_text: visibleText,
    contacts,
    prices,
    service_product_candidates: extractServiceProductCandidates(html, jsonLd),
    opening_hour_candidates: extractOpeningHourCandidates(html, jsonLd),
    address_candidates: extractAddressCandidates(html, jsonLd),
    json_ld: jsonLd,
    ...candidates,
    image_candidates: extractImageCandidates(html, url),
    brand_signals: extractBrandSignals(html),
    ctas,
    internal_links: links,
    signals: {
      has_viewport: /<meta[^>]+name=["']viewport["']/i.test(html),
      has_description: Boolean(metaContent(html, "description")),
      has_h1: h1.length > 0,
      has_contact_signal: contacts.emails.length > 0 || contacts.phones.length > 0,
      has_cta_signal: ctas.length > 0,
      has_forms: /<form\b/i.test(html),
      text_length: visibleText.length
    }
  };
}

function aggregate(pages, source) {
  const pageTitles = pages.map((p) => p.title).filter(Boolean);
  const h1 = [...new Set(pages.flatMap((p) => p.headings.h1))].slice(0, 30);
  const h2 = [...new Set(pages.flatMap((p) => p.headings.h2))].slice(0, 60);
  const emails = [...new Set(pages.flatMap((p) => p.contacts.emails))].slice(0, 20);
  const phones = [...new Set(pages.flatMap((p) => p.contacts.phones))].slice(0, 20);
  const prices = [...new Set(pages.flatMap((p) => p.prices))].slice(0, 50);
  const ctas = [...new Set(pages.flatMap((p) => p.ctas))].slice(0, 30);

  const gaps = [];
  if (!pages.some((p) => p.signals.has_description)) gaps.push("missing_or_weak_meta_descriptions");
  if (!pages.every((p) => p.signals.has_viewport)) gaps.push("mobile_viewport_not_consistent");
  if (!pages.some((p) => p.signals.has_contact_signal)) gaps.push("contact_information_not_easily_detectable");
  if (!pages.some((p) => p.signals.has_cta_signal)) gaps.push("weak_or_missing_conversion_ctas");
  if (pages.some((p) => !p.signals.has_h1)) gaps.push("heading_hierarchy_inconsistent");

  return {
    source_url: source.toString(),
    pages_analyzed: pages.length,
    business_facts: { emails, phones, observed_prices: prices },
    information_architecture: {
      page_urls: pages.map((p) => p.url),
      page_titles: pageTitles,
      primary_headings: h1,
      secondary_headings: h2
    },
    conversion_inventory: { detected_ctas: ctas },
    detected_gaps: gaps,
    rebuild_policy: {
      purpose: "Create an improved independent implementation from public business facts and structural observations.",
      do_not_copy_verbatim: ["long-form copy", "proprietary imagery", "logos without permission", "distinctive protected visual expression"],
      safe_to_reuse_as_facts: ["business contact details", "opening hours when detected", "public prices", "service/category names", "public locations"]
    }
  };
}

async function legacyFetchHtml(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url.toString(), {
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": "ChatGPT-Project-Factory/1.5 (+public-site-analysis)" }
    });
    if (!response.ok) return { error: `HTTP_${response.status}` };
    const type = response.headers.get("content-type") || "";
    if (!type.toLowerCase().includes("text/html")) return { error: "NOT_HTML" };
    const length = Number(response.headers.get("content-length") || 0);
    if (length > MAX_HTML_BYTES) return { error: "HTML_TOO_LARGE" };
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > MAX_HTML_BYTES) return { error: "HTML_TOO_LARGE" };
    const finalValidation = validatePublicUrl(response.url || url.toString());
    if (!finalValidation.ok) return { error: "REDIRECT_TARGET_BLOCKED" };
    return { html: text, url: finalValidation.url };
  } catch (error) {
    return { error: error?.name === "AbortError" ? "FETCH_TIMEOUT" : "FETCH_FAILED" };
  } finally {
    clearTimeout(timeout);
  }
}

export async function analyzePublicWebsite(input = {}) {
  const validated = validatePublicUrl(input.source_url);
  if (!validated.ok) return { error: validated.error };
  const maxPages = Math.min(MAX_PAGES_HARD, Math.max(1, Math.floor(Number(input.max_pages) || MAX_PAGES_DEFAULT)));
  const source = validated.url;
  const queue = [source.toString()];
  const visited = new Set();
  const pages = [];
  const errors = [];

  while (queue.length && pages.length < maxPages) {
    const next = queue.shift();
    if (visited.has(next)) continue;
    visited.add(next);
    const checked = validatePublicUrl(next);
    if (!checked.ok || checked.url.origin !== source.origin) continue;
    const fetched = await legacyFetchHtml(checked.url);
    if (fetched.error) { errors.push({ url: next, error: fetched.error }); continue; }
    const page = analyzeHtml(fetched.html, fetched.url);
    pages.push(page);
    for (const link of page.internal_links) {
      if (!visited.has(link) && queue.length < 100) queue.push(link);
    }
  }

  if (!pages.length) return { error: "NO_PAGES_ANALYZED", fetch_errors: errors };
  return {
    ok: true,
    version: "1.5-alpha",
    ...aggregate(pages, source),
    pages: pages.map(({ internal_links, ...page }) => page),
    fetch_errors: errors
  };
}

function normalizeResolvedAddresses(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(normalizeResolvedAddresses);
  if (typeof value === "string") return [value];
  if (typeof value === "object") {
    if (value.address) return normalizeResolvedAddresses(value.address);
    if (value.data) return normalizeResolvedAddresses(value.data);
    if (Array.isArray(value.Answer)) return value.Answer.map((item) => item?.data).filter(Boolean);
  }
  return [];
}

async function defaultResolveHostname(hostname, deps = {}) {
  if (parseIpv4(hostname) || isIpv6Literal(hostname)) return [hostname];
  const fetcher = deps.fetcher || globalThis.fetch;
  if (typeof fetcher !== "function") throw new Error("DNS_RESOLVER_UNAVAILABLE");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.min(FETCH_TIMEOUT_MS, 5_000));
  try {
    const values = [];
    for (const type of ["A", "AAAA"]) {
      const endpoint = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=${type}`;
      const response = await fetcher(endpoint, {
        method: "GET",
        redirect: "error",
        signal: controller.signal,
        headers: { accept: "application/dns-json", "user-agent": "Aurentara-Project-Source-Intake/1.0" }
      });
      if (!response.ok) continue;
      const body = await response.json();
      values.push(...normalizeResolvedAddresses(body.Answer));
    }
    return [...new Set(values)];
  } finally {
    clearTimeout(timeout);
  }
}

async function validateResolvedPublicTarget(url, deps = {}) {
  const base = validatePublicUrl(url);
  if (!base.ok) return base;
  const resolver = deps.resolveHostname || ((hostname) => defaultResolveHostname(hostname, deps));
  let addresses;
  try { addresses = normalizeResolvedAddresses(await resolver(base.url.hostname)); }
  catch { return { ok: false, error: "DNS_RESOLUTION_FAILED" }; }
  if (!addresses.length) return { ok: false, error: "DNS_NO_PUBLIC_ADDRESS" };
  for (const address of addresses) {
    if (isBlockedIpv4(address) || isBlockedIpv6(address) || isBlockedHostname(address)) {
      return { ok: false, error: "DNS_PRIVATE_TARGET_BLOCKED", address };
    }
  }
  return { ok: true, url: base.url, addresses };
}

async function readBoundedResponse(response, maxBytes) {
  const declared = Number(response.headers?.get?.("content-length") || 0);
  if (declared > maxBytes) return { ok: false, error: "RESPONSE_TOO_LARGE" };
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) return { ok: false, error: "RESPONSE_TOO_LARGE" };
  return { ok: true, text };
}

async function safeFetch(url, options = {}, deps = {}) {
  const fetcher = deps.fetcher || globalThis.fetch;
  if (typeof fetcher !== "function") return { ok: false, error: "FETCH_UNAVAILABLE" };
  const maxBytes = Math.max(1, Math.min(Number(options.max_bytes) || MAX_HTML_BYTES, MAX_HTML_BYTES));
  let currentValidation = await validateResolvedPublicTarget(url, deps);
  if (!currentValidation.ok) return currentValidation;
  let current = currentValidation.url;
  const redirects = [];

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.min(Math.max(1, Number(options.timeout_ms) || FETCH_TIMEOUT_MS), FETCH_TIMEOUT_MS));
    let response;
    try {
      response = await fetcher(current.toString(), {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: { "user-agent": "Aurentara-Project-Source-Intake/1.0 (+bounded-readonly-import)", ...(options.headers || {}) }
      });
    } catch (error) {
      clearTimeout(timeout);
      return { ok: false, error: error?.name === "AbortError" ? "FETCH_TIMEOUT" : "FETCH_FAILED" };
    }
    clearTimeout(timeout);

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers?.get?.("location");
      if (!location) return { ok: false, error: "REDIRECT_LOCATION_MISSING" };
      if (hop >= MAX_REDIRECTS) return { ok: false, error: "REDIRECT_LIMIT_EXCEEDED" };
      let target;
      try { target = new URL(location, current); } catch { return { ok: false, error: "REDIRECT_TARGET_INVALID" }; }
      const checked = await validateResolvedPublicTarget(target, deps);
      if (!checked.ok) return { ok: false, error: "REDIRECT_TARGET_BLOCKED", cause: checked.error };
      redirects.push({ from: current.toString(), to: checked.url.toString() });
      current = checked.url;
      continue;
    }

    if (!response.ok) return { ok: false, error: `HTTP_${response.status}`, status: response.status, final_url: current.toString(), redirects };
    const type = String(response.headers?.get?.("content-type") || "").toLowerCase();
    if (options.expected_mime && !type.includes(options.expected_mime)) return { ok: false, error: "INVALID_MIME", mime_type: type || null };
    const body = await readBoundedResponse(response, maxBytes);
    if (!body.ok) return body;
    return { ok: true, text: body.text, mime_type: type, url: current, redirects };
  }
  return { ok: false, error: "REDIRECT_LIMIT_EXCEEDED" };
}

function parseRobots(text = "") {
  const disallow = [];
  const sitemaps = [];
  let applies = false;
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === "user-agent") applies = value === "*" || /aurentara|chatgpt-project-factory/i.test(value);
    else if (key === "disallow" && applies && value) disallow.push(value);
    else if (key === "sitemap" && value) sitemaps.push(value);
  }
  return { disallow: [...new Set(disallow)], sitemaps: [...new Set(sitemaps)].slice(0, 5) };
}

function robotsAllows(url, rules) {
  const path = `${url.pathname || "/"}${url.search || ""}`;
  if (rules.disallow.includes("/")) return false;
  return !rules.disallow.some((prefix) => prefix && path.startsWith(prefix));
}

async function discoverSitemapUrls(sitemaps, origin, deps) {
  const urls = [];
  for (const sitemap of sitemaps.slice(0, 3)) {
    const checked = validatePublicUrl(sitemap);
    if (!checked.ok || checked.url.origin !== origin) continue;
    const fetched = await safeFetch(checked.url, { max_bytes: MAX_AUX_BYTES, expected_mime: "xml" }, deps);
    if (!fetched.ok) continue;
    const matches = [...fetched.text.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((match) => decodeEntities(match[1]).trim());
    for (const value of matches) {
      try {
        const url = new URL(value);
        if (url.origin === origin && !isAuthLikeUrl(url) && !urls.includes(url.toString())) urls.push(url.toString());
      } catch {}
      if (urls.length >= 20) return urls;
    }
  }
  return urls;
}

export async function quickImportProjectWebsite(input = {}, deps = {}) {
  const validated = validatePublicUrl(input.source_url);
  if (!validated.ok) return { ok: false, error: validated.error, import_status: "IMPORT_BLOCKED", variable_cost_eur: 0, paid_provider_calls: 0 };
  const maxPages = Math.min(MAX_PAGES_HARD, Math.max(1, Math.floor(Number(input.max_pages) || MAX_PAGES_HARD)));
  const maxDepth = Math.min(MAX_CRAWL_DEPTH, Math.max(0, Math.floor(Number(input.max_depth) || MAX_CRAWL_DEPTH)));

  const rootFetched = await safeFetch(validated.url, { expected_mime: "text/html", max_bytes: MAX_HTML_BYTES }, deps);
  if (!rootFetched.ok) return { ok: false, error: rootFetched.error, cause: rootFetched.cause || null, import_status: "IMPORT_BLOCKED", variable_cost_eur: 0, paid_provider_calls: 0 };
  const source = rootFetched.url;
  const rootPage = analyzeHtml(rootFetched.text, source);
  const pages = [{ ...rootPage, crawl_depth: 0 }];
  const visited = new Set([source.toString()]);
  const errors = [];

  let robots = { disallow: [], sitemaps: [] };
  let robotsStatus = "NOT_FOUND";
  try {
    const robotsUrl = new URL("/robots.txt", source);
    const robotsFetched = await safeFetch(robotsUrl, { max_bytes: MAX_AUX_BYTES }, deps);
    if (robotsFetched.ok) {
      robots = parseRobots(robotsFetched.text);
      robotsStatus = "RESPECTED";
    } else if (robotsFetched.status === 404 || robotsFetched.error === "HTTP_404") robotsStatus = "NOT_FOUND";
    else robotsStatus = "UNAVAILABLE_CONSERVATIVE";
  } catch { robotsStatus = "UNAVAILABLE_CONSERVATIVE"; }

  if (!robotsAllows(source, robots)) {
    return {
      ok: false,
      error: "ROBOTS_DISALLOWS_IMPORT",
      import_status: "IMPORT_BLOCKED",
      robots_status: robotsStatus,
      pages_analyzed: 0,
      paid_provider_calls: 0,
      variable_cost_eur: 0,
      production_deploy: false
    };
  }

  const queue = rootPage.internal_links.map((url) => ({ url, depth: 1 }));
  if (input.discover_sitemap !== false && robots.sitemaps.length) {
    const discovered = await discoverSitemapUrls(robots.sitemaps, source.origin, deps);
    for (const url of discovered) queue.push({ url, depth: 1 });
  }

  while (queue.length && pages.length < maxPages) {
    const item = queue.shift();
    if (!item || item.depth > maxDepth || visited.has(item.url)) continue;
    visited.add(item.url);
    const checked = validatePublicUrl(item.url);
    if (!checked.ok || checked.url.origin !== source.origin || isAuthLikeUrl(checked.url) || !robotsAllows(checked.url, robots)) continue;
    const fetched = await safeFetch(checked.url, { expected_mime: "text/html", max_bytes: MAX_HTML_BYTES }, deps);
    if (!fetched.ok) { errors.push({ url: item.url, error: fetched.error, cause: fetched.cause || null }); continue; }
    if (fetched.url.origin !== source.origin) { errors.push({ url: item.url, error: "CROSS_ORIGIN_REDIRECT_SKIPPED" }); continue; }
    const page = analyzeHtml(fetched.text, fetched.url);
    pages.push({ ...page, crawl_depth: item.depth });
    if (item.depth < maxDepth) for (const link of page.internal_links) if (!visited.has(link) && queue.length < 100) queue.push({ url: link, depth: item.depth + 1 });
  }

  const sparseHtml = pages.every((page) => page.signals.text_length < 250);
  const importStatus = sparseHtml || robotsStatus === "UNAVAILABLE_CONSERVATIVE" || errors.length ? "IMPORT_PARTIAL" : "IMPORTED";
  const observations = aggregate(pages, source);
  return {
    ok: true,
    schema: "aurentara.project-website-import.v1",
    import_status: importStatus,
    source_url: validated.url.toString(),
    canonical_source_url: source.toString(),
    limits: { max_pages: maxPages, max_depth: maxDepth, max_html_bytes_per_page: MAX_HTML_BYTES, timeout_ms: FETCH_TIMEOUT_MS, max_redirects: MAX_REDIRECTS },
    robots_status: robotsStatus,
    pages_analyzed: pages.length,
    ...observations,
    pages: pages.map(({ internal_links, ...page }) => page),
    asset_candidates: pages.flatMap((page) => page.image_candidates || []).filter((item, index, all) => all.findIndex((candidate) => candidate.url === item.url) === index).slice(0, 100),
    extracted_candidates: {
      contacts: { emails: [...new Set(pages.flatMap((page) => page.contacts.emails))], phones: [...new Set(pages.flatMap((page) => page.contacts.phones))] },
      prices: [...new Set(pages.flatMap((page) => page.prices))],
      services_products: [...new Set(pages.flatMap((page) => page.service_product_candidates))].slice(0, 100),
      opening_hours: [...new Set(pages.flatMap((page) => page.opening_hour_candidates))].slice(0, 50),
      addresses: [...new Set(pages.flatMap((page) => page.address_candidates))].slice(0, 50),
      social_links: [...new Set(pages.flatMap((page) => page.social_links))].slice(0, 50),
      legal_links: [...new Set(pages.flatMap((page) => page.legal_links))].slice(0, 50)
    },
    provenance_policy: { extracted_is_verified: false, candidate_origin: "EXTRACTED" },
    forms_submitted: 0,
    post_requests: 0,
    authentication_attempts: 0,
    paid_provider_calls: 0,
    ai_inference_calls: 0,
    cost_reservations: 0,
    variable_cost_eur: 0,
    production_deploy: false,
    fetch_errors: errors
  };
}

export async function validateProjectAssetFetchTarget(input = {}, deps = {}) {
  const checked = await validateResolvedPublicTarget(input.url, deps);
  if (!checked.ok) return checked;
  return { ok: true, url: checked.url.toString(), resolved_addresses: checked.addresses, production_deploy: false };
}
