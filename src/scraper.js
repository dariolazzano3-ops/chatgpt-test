const MAX_PAGES_DEFAULT = 6;
const MAX_PAGES_HARD = 12;
const MAX_HTML_BYTES = 1_000_000;
const FETCH_TIMEOUT_MS = 10_000;

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

function stripTags(value = "") {
  return clean(decodeEntities(String(value).replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")), 2000);
}

function isPrivateIpv4(host) {
  const parts = host.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = parts;
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function isBlockedHostname(hostname) {
  const h = hostname.toLowerCase().replace(/\.$/, "");
  return h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h === "::1" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80:") || isPrivateIpv4(h);
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

function firstMatch(html, regex) {
  const match = regex.exec(html);
  return match ? clean(stripTags(match[1]), 500) : null;
}

function allMatches(html, regex, limit = 30) {
  const out = [];
  let match;
  regex.lastIndex = 0;
  while ((match = regex.exec(html)) && out.length < limit) {
    const value = clean(stripTags(match[1]), 300);
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

function extractLinks(html, baseUrl) {
  const links = [];
  const tags = html.match(/<a\b[^>]*href\s*=\s*["'][^"']+["'][^>]*>/gi) || [];
  for (const tag of tags) {
    const href = attr(tag, "href");
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) continue;
    try {
      const u = new URL(href, baseUrl);
      u.hash = "";
      if (u.origin === baseUrl.origin && ["http:", "https:"].includes(u.protocol)) {
        const normalized = u.toString();
        if (!links.includes(normalized)) links.push(normalized);
      }
    } catch {}
  }
  return links.slice(0, 100);
}

function extractContacts(html) {
  const emails = [...new Set((html.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []).map((v) => v.toLowerCase()))].slice(0, 10);
  const phones = [...new Set((stripTags(html).match(/(?:\+?\d[\d\s().\/-]{6,}\d)/g) || []).map((v) => clean(v, 40)))].slice(0, 10);
  return { emails, phones };
}

function extractPrices(html) {
  const text = stripTags(html);
  return [...new Set((text.match(/\b\d{1,4}(?:[.,]\d{1,2})?\s?(?:€|EUR)\b/gi) || []).map((v) => clean(v, 30)))].slice(0, 30);
}

function analyzeHtml(html, url) {
  const title = firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const h1 = allMatches(html, /<h1[^>]*>([\s\S]*?)<\/h1>/gi, 10);
  const h2 = allMatches(html, /<h2[^>]*>([\s\S]*?)<\/h2>/gi, 25);
  const navLabels = allMatches(html, /<a[^>]*>([\s\S]*?)<\/a>/gi, 40).filter((x) => x.length <= 80);
  const contacts = extractContacts(html);
  const prices = extractPrices(html);
  const links = extractLinks(html, url);
  const text = stripTags(html);
  const ctaWords = ["kontakt", "anrufen", "buchen", "bestellen", "anfragen", "termin", "angebot", "jetzt", "reservieren"];
  const ctas = navLabels.filter((label) => ctaWords.some((word) => label.toLowerCase().includes(word))).slice(0, 15);

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
    headings: { h1, h2 },
    navigation_labels: navLabels,
    contacts,
    prices,
    ctas,
    internal_links: links,
    signals: {
      has_viewport: /<meta[^>]+name=["']viewport["']/i.test(html),
      has_description: Boolean(metaContent(html, "description")),
      has_h1: h1.length > 0,
      has_contact_signal: contacts.emails.length > 0 || contacts.phones.length > 0,
      has_cta_signal: ctas.length > 0,
      text_length: text.length
    }
  };
}

async function fetchHtml(url) {
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
    if (text.length > MAX_HTML_BYTES) return { error: "HTML_TOO_LARGE" };
    const finalValidation = validatePublicUrl(response.url || url.toString());
    if (!finalValidation.ok) return { error: "REDIRECT_TARGET_BLOCKED" };
    return { html: text, url: finalValidation.url };
  } catch (error) {
    return { error: error?.name === "AbortError" ? "FETCH_TIMEOUT" : "FETCH_FAILED" };
  } finally {
    clearTimeout(timeout);
  }
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
    const fetched = await fetchHtml(checked.url);
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
