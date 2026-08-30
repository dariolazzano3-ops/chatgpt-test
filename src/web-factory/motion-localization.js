const arr = (v) => Array.isArray(v) ? v : [];
const text = (v, max = 300) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const SUPPORTED = new Set(['hover','fade','slide','scroll_reveal','sticky','parallax','microinteraction','section_transition']);
const DEFAULT_DURATION = { hover:180, fade:280, slide:320, scroll_reveal:360, sticky:0, parallax:0, microinteraction:160, section_transition:320 };

export function createMotionDesignContract(input = [], { quality_level = 'PREMIUM' } = {}) {
  const items = arr(input).slice(0, 24).map((item, index) => {
    const type = SUPPORTED.has(String(item?.type)) ? String(item.type) : 'microinteraction';
    const duration = Math.max(0, Math.min(1200, Number(item?.duration ?? DEFAULT_DURATION[type])));
    const purpose = text(item?.purpose || 'Support comprehension and interaction feedback', 300);
    const trigger = text(item?.trigger || (type === 'hover' ? 'pointer_hover' : type === 'scroll_reveal' ? 'viewport_entry' : 'interaction'), 120);
    const intensity = ['low','medium','high'].includes(String(item?.intensity)) ? String(item.intensity) : quality_level === 'STANDARD' ? 'low' : 'medium';
    return {
      motion_id:text(item?.motion_id || `motion-${index + 1}`, 120), type, purpose, trigger, duration,
      intensity, accessibility_fallback:text(item?.accessibility_fallback || 'disable or reduce transform/opacity motion when prefers-reduced-motion is enabled', 300),
      decorative_only:false, reduced_motion_required:true, performance_budget_ms:duration
    };
  });
  return {
    schema:'riosystems.motion-design-contract.v1', status:'READY', items,
    allowed_types:[...SUPPORTED], reduced_motion_policy:'required', decorative_motion_without_purpose:false
  };
}

const SLUGS = {
  de:{home:'',services:'leistungen',about:'ueber-uns',contact:'kontakt',faq:'faq',gallery:'galerie'},
  en:{home:'',services:'services',about:'about',contact:'contact',faq:'faq',gallery:'gallery'},
  fr:{home:'',services:'services',about:'a-propos',contact:'contact',faq:'faq',gallery:'galerie'},
  it:{home:'',services:'servizi',about:'chi-siamo',contact:'contatti',faq:'faq',gallery:'galleria'}
};

export function createLocalizationArchitecture(mission = {}, input = {}) {
  const primary = text(input.primary_language || mission.language || 'de', 10).toLowerCase();
  const languages = [...new Set([primary, ...arr(input.languages).map((lang) => text(lang,10).toLowerCase())])].slice(0, 12);
  const country = text(input.country || mission.country || 'Germany', 80);
  const currency = text(input.currency || 'EUR', 8).toUpperCase();
  const pages = mission.required_pages || ['home','services','about','contact','faq'];
  const locales = languages.map((language) => ({
    language,
    slugs:Object.fromEntries(pages.map((page) => [page, SLUGS[language]?.[page] ?? page])),
    metadata:{ localized_title:true, localized_description:true, local_seo_context:true },
    hreflang_ready:true,
    country_context:country,
    currency
  }));
  return {
    schema:'riosystems.web-localization.v1', status:'READY', primary_language:primary, languages, locales,
    hreflang_ready:true, local_seo:true, country_specific_business_context:true,
    currency_policy:{ currency, automatic_currency_change:false, source:input.currency ? 'project_rule' : 'default_eur_policy' }
  };
}
