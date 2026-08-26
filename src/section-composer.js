function clean(value, max = 4000) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function stripTags(value = "") {
  return clean(String(value).replace(/<[^>]+>/g, " "), 4000);
}

function firstMatch(source, regex, fallback = "") {
  const match = regex.exec(String(source || ""));
  return match ? stripTags(match[1]) : fallback;
}

function collectMatches(source, regex, limit = 8) {
  const values = [];
  let match;
  while ((match = regex.exec(String(source || ""))) && values.length < limit) {
    const value = stripTags(match[1]);
    if (value && !values.includes(value)) values.push(value);
  }
  return values;
}

function inferDomain(text = "") {
  const value = clean(text, 12000).toLowerCase();
  const scores = {
    ai: ["ai", "ki", "künstliche intelligenz", "automation", "automatisierung", "systeme", "workflows", "digital products"],
    gelato: ["gelato", "eis", "eisbecher", "eistorte", "gelateria", "pistazie", "waffel"],
    automotive: ["reifen", "felgen", "kompletträder", "fahrzeug", "auto", "tyre"],
    agency: ["agentur", "webdesign", "branding", "marketing", "website", "creative"],
    generic: []
  };
  let best = "generic";
  let bestScore = 0;
  for (const [domain, terms] of Object.entries(scores)) {
    const score = terms.reduce((sum, term) => sum + (value.includes(term) ? 1 : 0), 0);
    if (score > bestScore) {
      best = domain;
      bestScore = score;
    }
  }
  return best;
}

export function analyzeContentContext(html = "") {
  const brand = firstMatch(html, /<a[^>]*class=["'][^"']*brand[^"']*["'][^>]*>([\s\S]*?)<\/a>/i,
    firstMatch(html, /<title>([\s\S]*?)<\/title>/i, "Projekt"));
  const title = firstMatch(html, /<title>([\s\S]*?)<\/title>/i, brand);
  const headline = firstMatch(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i, brand);
  const description = firstMatch(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i,
    firstMatch(html, /<p[^>]*>([\s\S]*?)<\/p>/i, ""));
  const cardHeadings = collectMatches(html, /<h3[^>]*>([\s\S]*?)<\/h3>/gi, 10);
  const headings = collectMatches(html, /<h2[^>]*>([\s\S]*?)<\/h2>/gi, 10);
  const corpus = [brand, title, headline, description, ...cardHeadings, ...headings].join(" ");
  return {
    brand,
    title,
    headline,
    description,
    card_headings: cardHeadings,
    section_headings: headings,
    domain: inferDomain(corpus)
  };
}

const contentProfiles = {
  ai: {
    faq: [
      ["Wie startet ein Projekt?", "Wir beginnen mit Zielbild, Prozessen und vorhandenen Systemen. Daraus entsteht ein priorisierter Umsetzungsplan mit klaren Schnittstellen und messbaren Ergebnissen."],
      ["Was lässt sich automatisieren?", "Vor allem wiederkehrende Abläufe, Datenübergaben, interne Freigaben und digitale Kundenprozesse. Entscheidend ist, dass die Automatisierung zum bestehenden Betrieb passt."],
      ["Wie schnell gibt es eine erste Version?", "Ein klar abgegrenzter Funktionskern kann früh als Preview entstehen. Danach wird iterativ erweitert, getestet und an reale Nutzung angepasst."]
    ],
    services: [
      ["AI Systems", "Intelligente Systeme für konkrete Geschäftsprozesse, von Assistenzfunktionen bis zu autonomen Workflows."],
      ["Automation", "Verknüpfte Abläufe, Datenflüsse und Integrationen, die manuelle Übergaben reduzieren."],
      ["Digital Products", "Websites und Interfaces, deren Oberfläche und technische Logik als ein zusammenhängendes Produkt gedacht werden."]
    ],
    references: [
      ["Operations Intelligence", "Prozesse werden analysiert, verbunden und mit KI dort erweitert, wo sie tatsächlich Entscheidungen beschleunigt."],
      ["Connected Experience", "Frontend, Daten und Automationen greifen ineinander, statt als getrennte Einzellösungen nebeneinander zu stehen."],
      ["Scalable Core", "Die Architektur bleibt modular, damit neue Funktionen und Systeme später ohne kompletten Neuaufbau andocken können."]
    ]
  },
  gelato: {
    faq: [
      ["Welche Sorten gibt es?", "Das Sortiment kann klassische und saisonale Sorten kombinieren. Verfügbarkeit und Premium-Sorten lassen sich direkt auf der Website hervorheben."],
      ["Kann man Eis für Feiern bestellen?", "Ja. Produkte, Mengen und mögliche Mietangebote können passend zur Veranstaltung zusammengestellt werden."],
      ["Gibt es besondere Sorten?", "Premium-Varianten wie Pistazie oder besondere Schokoladenkreationen können separat gekennzeichnet und bepreist werden."]
    ],
    services: [["Gelato", "Handwerkliche Sorten und saisonale Highlights."], ["Eistorten", "Individuelle Größen und Sortenkombinationen für besondere Anlässe."], ["Events", "Eisvitrinen und passende Ausstattung für Feiern und Veranstaltungen."]],
    references: [["Sortiment", "Ein klar aufgebautes Angebot, das Gäste schnell durch Sorten und Kategorien führt."], ["Feiern", "Produkte und Mietangebote für Geburtstage, Events und private Anlässe."], ["Saison", "Neue Sorten und Aktionen lassen sich flexibel hervorheben."]]
  },
  automotive: {
    faq: [["Wie finde ich den passenden Reifen?", "Fahrzeugdaten, Dimensionen und gewünschte Nutzung bilden die Grundlage für eine passende Auswahl."], ["Sind Preise und Bestand aktuell?", "Live angebundene Produktdaten können Preis, Bestand und Lieferzeit direkt aus dem Handelssystem übernehmen."], ["Kann ich Kompletträder bestellen?", "Reifen, Felgen und passende Kombinationen können als zusammenhängender Kaufprozess aufgebaut werden."]],
    services: [["Reifen", "Passende Sommer-, Winter- und Ganzjahresreifen für Fahrzeug und Einsatzprofil."], ["Felgen", "Felgenauswahl mit passenden Dimensionen und Fahrzeugbezug."], ["Kompletträder", "Vorkonfigurierte Kombinationen aus Reifen und Felgen mit transparentem Bestellprozess."]],
    references: [["Live Product Data", "Produktdaten, Preise und Verfügbarkeit direkt aus angebundenen Systemen."], ["Vehicle Fit", "Auswahl und Filterung orientieren sich am konkreten Fahrzeug."], ["Fast Ordering", "Ein klarer Prozess reduziert Reibung zwischen Suche, Auswahl und Bestellung."]]
  },
  generic: {
    faq: [["Wie starten wir?", "Wir klären Ziel, Umfang und Prioritäten und übersetzen sie in einen klaren Umsetzungsplan."], ["Wie läuft die Zusammenarbeit?", "Ergebnisse werden früh sichtbar gemacht und anschließend iterativ verbessert."], ["Kann das System später erweitert werden?", "Ja. Die Struktur wird so aufgebaut, dass neue Inhalte und Funktionen modular ergänzt werden können."]],
    services: [["Strategy", "Klare Ziele, Prioritäten und eine belastbare Umsetzungslogik."], ["Build", "Konzeption und technische Umsetzung als zusammenhängender Prozess."], ["Evolve", "Kontinuierliche Weiterentwicklung auf Basis echter Nutzung und neuer Anforderungen."]],
    references: [["Clarity", "Komplexe Anforderungen werden in verständliche, nutzbare Strukturen übersetzt."], ["Quality", "Gestaltung und Technik werden gemeinsam statt getrennt gedacht."], ["Scale", "Die Lösung bleibt erweiterbar, ohne ihren Kern bei jeder Änderung neu bauen zu müssen."]]
  }
};

function profileFor(context) {
  return contentProfiles[context?.domain] || contentProfiles.generic;
}

export function composeSectionContent(type, context = {}) {
  const profile = profileFor(context);
  const brand = clean(context.brand || context.title || "Das Projekt", 120);

  if (type === "faq") {
    return {
      eyebrow: "FAQ",
      headline: `Fragen zu ${brand}.`,
      items: profile.faq.map(([title, body]) => ({ title, body }))
    };
  }

  if (type === "services") {
    return {
      eyebrow: "Leistungen",
      headline: context.domain === "ai" ? "Systeme, die zusammenarbeiten." : `Was ${brand} anbietet.`,
      items: profile.services.map(([title, body]) => ({ title, body }))
    };
  }

  if (type === "references") {
    return {
      eyebrow: "Referenzen",
      headline: context.domain === "ai" ? "Von einzelnen Tools zu verbundenen Systemen." : `So schafft ${brand} Mehrwert.`,
      items: profile.references.map(([title, body]) => ({ title, body }))
    };
  }

  if (type === "cta") {
    return {
      eyebrow: "Nächster Schritt",
      headline: context.domain === "ai" ? "Bereit, aus Komplexität ein funktionierendes System zu bauen?" : `Bereit für den nächsten Schritt mit ${brand}?`,
      cta: "Projekt besprechen"
    };
  }

  return null;
}
