const PAGE_LIBRARY = {
  home: {
    label: 'Home', purpose: 'Explain the core value quickly and create the primary conversion path',
    sections: ['hero', 'feature_grid', 'services', 'about', 'stats', 'testimonials', 'cta'], seo_intent: 'brand + primary offer', cta: 'primary'
  },
  services: {
    label: 'Services', purpose: 'Explain the offer, outcomes and fit in enough detail to support a buying decision',
    sections: ['hero', 'services', 'feature_grid', 'faq', 'cta'], seo_intent: 'commercial service intent', cta: 'primary'
  },
  about: {
    label: 'About', purpose: 'Build trust by explaining positioning, operating principles and proof',
    sections: ['hero', 'about', 'stats', 'testimonials', 'cta'], seo_intent: 'brand trust intent', cta: 'secondary'
  },
  contact: {
    label: 'Contact', purpose: 'Make the conversion action simple, accessible and transparent',
    sections: ['hero', 'contact', 'faq'], seo_intent: 'brand contact intent', cta: 'contact'
  },
  faq: {
    label: 'FAQ', purpose: 'Resolve common objections and information gaps before conversion',
    sections: ['hero', 'faq', 'cta'], seo_intent: 'informational support intent', cta: 'primary'
  },
  gallery: {
    label: 'Gallery', purpose: 'Show relevant visual proof or portfolio material without blocking the core conversion path',
    sections: ['hero', 'gallery', 'cta'], seo_intent: 'visual proof intent', cta: 'secondary'
  },
  'legal-notice': {
    label: 'Legal Notice', purpose: 'Reserve a controlled location for jurisdiction-specific legal information',
    sections: ['legal_placeholder'], seo_intent: 'legal utility', cta: 'none'
  },
  privacy: {
    label: 'Privacy', purpose: 'Reserve a controlled location for an approved privacy notice',
    sections: ['legal_placeholder'], seo_intent: 'legal utility', cta: 'none'
  }
};

const normalizePage = (page) => {
  const slug = String(page || '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
  const aliases = { leistungen: 'services', services: 'services', uber: 'about', 'ueber-uns': 'about', about: 'about', kontakt: 'contact', contact: 'contact', faq: 'faq', home: 'home', start: 'home', galerie: 'gallery', gallery: 'gallery', impressum: 'legal-notice', datenschutz: 'privacy' };
  return aliases[slug] || slug;
};

function pagePath(id) {
  return id === 'home' ? '/' : `/${id}/`;
}

export function planWebsite(mission) {
  const requested = [...new Set((mission.required_pages || []).map(normalizePage).filter(Boolean))];
  const ordered = [...new Set(['home', ...requested.filter((p) => p !== 'home'), 'services', 'about', 'contact', 'faq'])];
  if (!ordered.includes('legal-notice')) ordered.push('legal-notice');
  if (!ordered.includes('privacy')) ordered.push('privacy');

  const pages = ordered.map((id) => {
    const base = PAGE_LIBRARY[id] || {
      label: id.split('-').map((x) => x.charAt(0).toUpperCase() + x.slice(1)).join(' '),
      purpose: `Provide focused information for ${id.replace(/-/g, ' ')}`,
      sections: ['hero', 'feature_grid', 'cta'],
      seo_intent: `${mission.industry} ${id.replace(/-/g, ' ')}`,
      cta: 'primary'
    };
    return {
      id,
      path: pagePath(id),
      label: base.label,
      purpose: base.purpose,
      target_audience: mission.target_audience,
      conversion_goal: base.cta === 'none' ? 'Inform only' : mission.conversion_goal,
      sections: [...base.sections],
      content_requirements: base.sections.map((section) => ({ section, source: section === 'legal_placeholder' ? 'operator-approved legal content required' : 'structured content contract' })),
      seo_intent: `${base.seo_intent}; ${mission.seo_location}`,
      cta_strategy: base.cta
    };
  });

  return {
    schema: 'riosystems.website-blueprint.v1',
    project: { slug: mission.project_slug, business_name: mission.business_name },
    strategy: {
      primary_goal: mission.primary_goal,
      conversion_goal: mission.conversion_goal,
      target_audience: mission.target_audience,
      positioning: mission.brand_positioning,
      language: mission.language,
      country: mission.country
    },
    pages,
    navigation: pages.filter((page) => !['legal-notice', 'privacy'].includes(page.id)).map(({ label, path }) => ({ label, path })),
    legal_placeholders: ['legal-notice', 'privacy'],
    production_deploy: false
  };
}
