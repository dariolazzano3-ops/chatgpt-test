# Gelato Donatello &mdash; Premium Website V5 (Final)

Eigenstaendige, private Markenseite fuer Gelato Donatello im AURENTARA-Projekt,
mit 41 bestaetigten Sorten, vollstaendiger Eisbecher-Karte und bestaetigten Extras/Preisen. Statische,
abhaengigkeitsfreie Frontend-Codebasis (kein Build-Schritt notwendig) &mdash;
HTML/CSS/ESM-JavaScript, konsistent mit den anderen `projects/*` Websites in
diesem Repository.

Dieses Projekt ist eine **eigenstaendige Neuimplementierung**. Die
bestehenden Ordner `projects/gelato-donatello-website-v5/` und
`projects/gelato-donatello-premium-v5/` wurden **nicht veraendert** und
**nicht** als Code- oder Content-Basis kopiert (siehe Mission-Vorgabe); es
wurden lediglich bereits etablierte Repo-Konventionen wiederverwendet
(Dateistruktur, Design-Tokens-Ansatz, Safety-/Indexing-Pattern, CSP-sichere
Komponentenmuster, Reuse-first).

## Status

- Environment: `private-staging`
- Indexing: `NOINDEX` (robots-Meta, `robots.txt`, `_headers` X-Robots-Tag)
- Keine Produktions-, DNS-, Billing- oder externen Schreibaktionen. Siehe
  `project.json` &rarr; `safety`.

## Struktur

```
index.html                     Start
sortiment/index.html           Sortiment: 41 echte Sortennamen (30 Regular, 11 Specials)
eisbecher/index.html           Vollstaendige Eisbecher-Karte + Sossen/Cremes/Likoere/Toppings
eistorten-eisbomben/index.html Eistorten (18-26cm), Eisbomben (40/60 Kugeln), Spaghetti-Eistorten + Anfrage
eisvitrine/index.html          Eisvitrine mieten (Miete/Kaution/Inhalt) + Anfrage
kontakt/index.html             Besuch & Kontakt
assets/css/tokens.css          Design-Tokens (Farben, Typografie, Abstand)
assets/css/style.css           Globales Stylesheet, mobile first, inkl. Preis-Komponenten
assets/js/app.js               Einstiegspunkt: Header/Footer, Reveal, Hydration
assets/js/components/*         Wiederverwendbare UI-Komponenten (Nav, Bilder,
                                Sortenraster, Anfrage-Formular)
assets/js/data/*                Strukturierte Fakten-, Sorten- und Preisdaten (ESM)
assets/manifest.json           Stabile, root-relative Asset-Pfade fuer Owner-Fotos
project.json                   Mission, Seiten, Safety-Flags, bekannte Luecken
confirmed-project-inputs.json  Fakten mit Herkunft (OPERATOR_CONFIRMED vs.
                                PENDING_OWNER_CONFIRMATION)
```

## Design

Premium Food Editorial: bilddominant, grosser Weissraum, grosse
Produktmomente, starke Typografie, ruhige Bewegung
(`prefers-reduced-motion` respektiert), mobile first (390px Referenz) bis
Desktop (1440px Referenz). Keine Corporate-Dashboard-Optik, keine externen
Font-/Script-CDNs (CSP: `script-src 'self'`, `style-src 'self'`, kein
`unsafe-inline`). Buonissimo dient nur als Prinzipienreferenz (Bild-Fokus,
Weissraum), es wurde nichts kopiert.

## Fakten & Datenintegritaet

Alle im Frontend gezeigten Fakten stammen aus `confirmed-project-inputs.json`
und sind dort mit Quelle/Status versehen:

- **Geschaeftsfakten** (Name, Geschichte, Adresse, Telefon, Eislabor):
  `OPERATOR_CONFIRMED`.
- **41 Sortennamen**: vollstaendig und woertlich aus dem Owner-Mission-Brief
  uebernommen (`assets/js/data/flavors.js`), `OPERATOR_CONFIRMED`, keine
  Platzhalter.
- **Kernpreise** (Kugel 1,60 €, Sahne 1,20 €, Sosse 1 €, Creme 1,50 €,
  Likoer 1,50 €, Streusel 1 €), **Eistorten** (18/20/24/26 cm =
  65/75/95/109 €, 2 Sorten inklusive, Premium +5 €), **Eisbomben**
  (40 Kugeln 75 €, 60 Kugeln 109 €, bis 6 Sorten, Premium +5 €) und
  **Eisvitrine** (250 € Miete, 100 € Kaution, 5 L Eis, 4 Sorten, Zubehoer
  inklusive, ca. 90 x 75 x 45 cm): alle `OPERATOR_CONFIRMED`, woertlich aus
  dem Owner-Brief (`assets/js/data/pricing.js`).
- **Oeffnungszeiten**: nicht genannt, daher nicht veroeffentlicht.
- **Eisbecher-Karte**: 7 Kategorien mit 68 Quelleneintraegen und bestaetigten Einzelpreisen. Das doppelte Waldbeer bei den Joghurtbechern bleibt als markierter Quellen-Datensatz erhalten.
- **Extras**: 13 Sossen, 2 Cremes, 9 Likoere und 9 Toppings mit bestaetigten Preisen.

## Wiederverwendung (reuse-first)

- Projekt-, Safety- und Indexing-Konventionen 1:1 aus
  `projects/gelato-donatello-premium-v5` uebernommen (`_headers`,
  `robots.txt`, `project.json`-Schema, `confirmed-project-inputs` Pattern,
  CSP-sichere Komponenten ohne Inline-Styles, Asset-Platzhalter-Pattern).
- Keine neuen npm-Abhaengigkeiten; reines ESM ohne Bundler.
- Die bestehenden Ordner `gelato-donatello-website-v5/` und
  `gelato-donatello-premium-v5/` wurden ausschliesslich **lesend** als
  Konventionsreferenz verwendet und in keiner Weise veraendert.

## Owner-Bilder

Es sind noch keine Owner-Bilder physisch im Workspace vorhanden. Siehe
`assets/manifest.json` fuer alle vorbereiteten, stabilen Drop-in-Pfade
(z. B. `/assets/images/flavors/pistazie.webp`) und `BUILD-NOTES.md` fuer das
Ingest-Verfahren. Alle Manifest-Eintraege stehen auf `rights: "pending"`;
es wird an keiner Stelle behauptet, dass Bilder bereits eingebunden sind.

## Tests / Acceptance

```
node scripts/gelato-donatello-v5-final-smoke.mjs
```

Prueft Routen, die 41 Sortendaten, die komplette Eisbecher-Karte (68 Quelleneintraege), 33 Extras, die bestaetigten Kernpreise (Eisbecher,
Eistorten, Eisbomben, Eisvitrine), das Asset-Manifest, Safety-Flags,
mobile/1440px CSS-Breakpoints, `prefers-reduced-motion`, CSP-Konformität
(keine Inline-Styles) sowie, dass die bestehenden Alt-Ordner weiterhin
vorhanden sind (Existenzpruefung; ein vollstaendiger Unveraendert-Nachweis
per Diff erfordert Git-/Shell-Zugriff, den diese statische Pruefung nicht
hat). Siehe `BUILD-NOTES.md` fuer den genauen Ausfuehrungsstatus dieser
Session.

## Asset-Ingest V1

78 owner-provided Bilddateien wurden fuer die private Vorschau als WebP integriert: 41 Sorten, 6 Eisbecher, 24 Torten/Eisbomben/Spaghetti-Eistorten, 5 Ladenfotos, 1 Logo und 1 Sortenposter. Die Produktions-/Public-Nutzung bleibt bis zur finalen Rechtebestaetigung gesperrt. Bilder der mobilen Mietvitrine fehlen weiterhin und bleiben bewusst als Platzhalter sichtbar.
