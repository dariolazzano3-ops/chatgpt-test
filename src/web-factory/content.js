const pickLanguage = (language = 'de') => String(language).toLowerCase().startsWith('en') ? 'en' : 'de';

function serviceItems(mission) {
  return mission.services.map((name, index) => ({
    title: name,
    body: pickLanguage(mission.language) === 'en'
      ? `${name} is presented with a clear outcome, fit and next step for ${mission.target_audience}.`
      : `${name} wird mit klarem Nutzen, passender Zielgruppe und einem eindeutigen nächsten Schritt dargestellt.`,
    order: index + 1
  }));
}

function faqItems(mission) {
  const en = pickLanguage(mission.language) === 'en';
  return [
    {
      question: en ? `What does ${mission.business_name} offer?` : `Was bietet ${mission.business_name} an?`,
      answer: en ? `The core offer includes ${mission.services.join(', ')}.` : `Zum Kernangebot gehören ${mission.services.join(', ')}.`
    },
    {
      question: en ? 'Who is the offer for?' : 'Für wen ist das Angebot gedacht?',
      answer: mission.target_audience
    },
    {
      question: en ? 'What is the next step?' : 'Was ist der nächste Schritt?',
      answer: mission.conversion_goal
    }
  ];
}

export function createContentContract(mission, blueprint) {
  const en = pickLanguage(mission.language) === 'en';
  const existing = mission.existing_content || {};
  const services = existing.services || serviceItems(mission);
  const proof = Array.isArray(existing.proof) ? existing.proof : [];
  const gallery = Array.isArray(existing.gallery) ? existing.gallery : [];
  const stats = Array.isArray(existing.stats) ? existing.stats : [];
  const testimonials = Array.isArray(existing.testimonials) ? existing.testimonials : [];

  const pageContent = Object.fromEntries(blueprint.pages.map((page) => {
    const headlineByPage = {
      home: existing.headline || (en ? `${mission.business_name}: ${mission.primary_goal}` : `${mission.business_name}: ${mission.primary_goal}`),
      services: en ? `Services built around a clear outcome.` : `Leistungen mit einem klaren Ergebnis.`,
      about: en ? `Built around ${mission.brand_positioning}.` : `Ausgerichtet auf ${mission.brand_positioning}.`,
      contact: en ? `Make the next step simple.` : `Der nächste Schritt soll einfach sein.`,
      faq: en ? `Questions before the next step.` : `Fragen vor dem nächsten Schritt.`,
      gallery: en ? `Selected work and visual proof.` : `Ausgewählte Arbeiten und visueller Nachweis.`
    };
    const introByPage = {
      home: existing.subheadline || (en ? `For ${mission.target_audience}. Clear positioning, focused information and one primary conversion path.` : `Für ${mission.target_audience}. Klare Positionierung, fokussierte Informationen und ein eindeutiger Conversion-Pfad.`),
      services: en ? `Explore the core offer and how it supports ${mission.primary_goal}.` : `Das Kernangebot und wie es ${mission.primary_goal} unterstützt.`,
      about: en ? `A focused digital expression of ${mission.brand_positioning}.` : `Eine fokussierte digitale Übersetzung von ${mission.brand_positioning}.`,
      contact: en ? mission.conversion_goal : mission.conversion_goal,
      faq: en ? `The most important information in one place.` : `Die wichtigsten Informationen an einem Ort.`,
      gallery: en ? `Only approved and relevant assets should appear here.` : `Hier erscheinen nur freigegebene und relevante Assets.`
    };
    return [page.id, {
      schema: 'riosystems.web-content-page.v1',
      headline: headlineByPage[page.id] || `${mission.business_name} · ${page.label}`,
      subheadline: introByPage[page.id] || mission.brand_positioning,
      body: existing.body || mission.brand_positioning,
      benefits: existing.benefits || mission.services.slice(0, 4).map((service) => en ? `Clear path to ${service}` : `Klarer Zugang zu ${service}`),
      services,
      proof,
      stats,
      testimonials,
      gallery,
      faq: existing.faq || faqItems(mission),
      cta: {
        label: existing.cta?.label || (en ? 'Start a conversation' : 'Kontakt aufnehmen'),
        href: '/contact/',
        goal: mission.conversion_goal
      },
      legal_placeholder: ['legal-notice', 'privacy'].includes(page.id)
        ? { approved_content_required: true, text: en ? 'Operator-approved legal content required before production.' : 'Vor Production sind operator-freigegebene Rechtstexte erforderlich.' }
        : null
    }];
  }));

  return {
    schema: 'riosystems.web-content.v1',
    language: mission.language,
    business_name: mission.business_name,
    shared: { services, proof, stats, testimonials, gallery },
    pages: pageContent,
    ai_provider_required: false,
    deterministic_fixture_supported: true
  };
}
