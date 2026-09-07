const arr = (v) => Array.isArray(v) ? v : [];
const text = (v, max = 300) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

const SUPPORTED = new Set([
  'page_entry','hero_reveal','text_reveal','image_reveal','scroll_reveal','parallax','hover','navigation',
  'section_transition','marquee','background_motion','video_hero',
  'fade','slide','sticky','microinteraction'
]);

const DEFAULT_DURATION = {
  page_entry:420,
  hero_reveal:520,
  text_reveal:420,
  image_reveal:480,
  scroll_reveal:360,
  parallax:0,
  hover:180,
  navigation:240,
  section_transition:320,
  marquee:0,
  background_motion:0,
  video_hero:0,
  fade:280,
  slide:320,
  sticky:0,
  microinteraction:160
};

const DEFAULT_TRIGGER = {
  page_entry:'page_ready',
  hero_reveal:'page_ready',
  text_reveal:'viewport_entry',
  image_reveal:'viewport_entry',
  scroll_reveal:'viewport_entry',
  parallax:'scroll_progress',
  hover:'pointer_hover',
  navigation:'navigation_state_change',
  section_transition:'viewport_entry',
  marquee:'continuous_when_visible',
  background_motion:'continuous_when_visible',
  video_hero:'media_ready',
  fade:'interaction',
  slide:'interaction',
  sticky:'scroll_threshold',
  microinteraction:'interaction'
};

const DEFAULT_EASING = {
  page_entry:'cubic-bezier(.2,.8,.2,1)',
  hero_reveal:'cubic-bezier(.16,1,.3,1)',
  text_reveal:'cubic-bezier(.2,.8,.2,1)',
  image_reveal:'cubic-bezier(.2,.8,.2,1)',
  scroll_reveal:'cubic-bezier(.2,.8,.2,1)',
  hover:'cubic-bezier(.2,.8,.2,1)',
  navigation:'cubic-bezier(.2,.8,.2,1)',
  section_transition:'cubic-bezier(.2,.8,.2,1)',
  fade:'ease-out',
  slide:'cubic-bezier(.2,.8,.2,1)',
  microinteraction:'cubic-bezier(.2,.8,.2,1)',
  sticky:'linear',
  parallax:'linear',
  marquee:'linear',
  background_motion:'linear',
  video_hero:'linear'
};

const GSAP_TYPES = new Set(['parallax','marquee','background_motion']);
const ESSENTIAL_DISABLE_TYPES = new Set(['parallax','marquee','background_motion','video_hero']);

function normalizeBreakpoints(item = {}) {
  const supplied=item.breakpoints&&typeof item.breakpoints==='object'?item.breakpoints:{};
  return {
    mobile:{enabled:supplied.mobile?.enabled!==false&&item.mobile!==false,min_width:0},
    tablet:{enabled:supplied.tablet?.enabled!==false&&item.tablet!==false,min_width:Number(supplied.tablet?.min_width||768)},
    desktop:{enabled:supplied.desktop?.enabled!==false&&item.desktop!==false,min_width:Number(supplied.desktop?.min_width||1200)}
  };
}

function normalizeReducedMotion(item = {}, type = 'microinteraction') {
  const supplied=item.reduced_motion&&typeof item.reduced_motion==='object'?item.reduced_motion:{};
  const behavior=text(supplied.behavior||item.reduced_motion_behavior||(ESSENTIAL_DISABLE_TYPES.has(type)?'disable':'reduce'),40);
  return {
    behavior:['disable','reduce','static'].includes(behavior)?behavior:'reduce',
    replacement:text(supplied.replacement||'static_final_state',120),
    media_query:'(prefers-reduced-motion: reduce)',
    required:true
  };
}

function engineFor(item = {}, type = 'microinteraction') {
  const requested=text(item.engine,40).toLowerCase();
  if(requested==='gsap' || requested==='css') return requested;
  return GSAP_TYPES.has(type)?'gsap':'css';
}

export function createMotionDesignContract(input = [], { quality_level = 'PREMIUM' } = {}) {
  const items = arr(input).slice(0, 32).map((item, index) => {
    const raw=String(item?.type||'');
    const type = SUPPORTED.has(raw) ? raw : 'microinteraction';
    const duration = Math.max(0, Math.min(1200, Number(item?.duration ?? DEFAULT_DURATION[type])));
    const purpose = text(item?.purpose || 'Support comprehension and interaction feedback', 300);
    const trigger = text(item?.trigger || DEFAULT_TRIGGER[type] || 'interaction', 120);
    const intensity = ['low','medium','high'].includes(String(item?.intensity)) ? String(item.intensity) : quality_level === 'STANDARD' ? 'low' : 'medium';
    const easing=text(item?.easing||DEFAULT_EASING[type]||'ease-out',120);
    const engine=engineFor(item,type);
    const reducedMotion=normalizeReducedMotion(item,type);
    const properties=arr(item?.properties).length?arr(item.properties).map((v)=>text(v,80)):['transform','opacity'];
    return {
      motion_id:text(item?.motion_id || ('motion-' + (index + 1)), 120),
      type,
      purpose,
      trigger,
      duration,
      easing,
      intensity,
      breakpoints:normalizeBreakpoints(item),
      reduced_motion:reducedMotion,
      engine,
      performance_budget:{
        duration_ms:duration,
        max_concurrent:Math.max(1,Math.min(6,Number(item?.max_concurrent||2))),
        properties,
        layout_affecting:false,
        compositor_preferred:true
      },
      accessibility_fallback:text(item?.accessibility_fallback || ('prefers-reduced-motion: ' + reducedMotion.behavior + '; replacement=' + reducedMotion.replacement), 300),
      decorative_only:false,
      reduced_motion_required:true,
      performance_budget_ms:duration
    };
  });
  const gsapRequired=items.some((item)=>item.engine==='gsap');
  return {
    schema:'riosystems.motion-design-contract.v1',
    status:'READY',
    items,
    allowed_types:[...SUPPORTED],
    reduced_motion_policy:'required',
    decorative_motion_without_purpose:false,
    gsap_required:gsapRequired,
    gsap_load_policy:gsapRequired?'load-on-demand-for-declared-motion-only':'do-not-load',
    global_gsap_load_allowed:false,
    default_engine:'css',
    performance_policy:{
      layout_thrashing_allowed:false,
      compositor_properties_preferred:['transform','opacity'],
      max_declared_duration_ms:1200,
      max_concurrent_per_motion:6
    }
  };
}

export function createMotionRuntimePlan(motion = {}) {
  const items=arr(motion.items);
  const gsapItems=items.filter((item)=>item.engine==='gsap');
  const cssItems=items.filter((item)=>item.engine!=='gsap');
  const gsapRequired=gsapItems.length>0;
  return {
    schema:'riosystems.motion-runtime-plan.v1',
    gsap:{
      import_required:gsapRequired,
      load_policy:gsapRequired?'dynamic-import-when-declared-motion-present':'not-loaded',
      motion_ids:gsapItems.map((item)=>item.motion_id),
      global_load:false
    },
    css:{
      native_motion_ids:cssItems.map((item)=>item.motion_id),
      reduced_motion_media_query_required:items.length>0
    },
    reduced_motion:{
      media_query:'(prefers-reduced-motion: reduce)',
      all_items_covered:items.every((item)=>item.reduced_motion?.required===true)
    },
    production_deploy:false
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
