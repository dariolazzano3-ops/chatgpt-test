# Build-Notizen &mdash; Gelato Donatello Premium Website V5 (Final)

## Lokal ansehen

Reine statische Dateien, kein Build-Schritt. Lokal mit einem beliebigen
statischen Server aus dem Projektordner ausliefern, z. B.:

```
npx serve projects/gelato-donatello-v5-final
```

(oder jeder andere lokale statische Webserver). Direktes Oeffnen per
`file://` funktioniert fuer das Layout, aber ES-Module-Imports
(`type="module"`) verlangen in den meisten Browsern `http(s)://`.

## Abgrenzung zu den bestehenden V5-Ordnern

Dieses Projekt wurde unabhaengig unter `projects/gelato-donatello-v5-final/`
aufgebaut. Weder `projects/gelato-donatello-website-v5/` noch
`projects/gelato-donatello-premium-v5/` wurden kopiert, importiert oder in
irgendeiner Form veraendert &mdash; beide wurden ausschliesslich lesend als
Konventionsreferenz genutzt. Wesentliche inhaltliche Weiterentwicklung
gegenueber `gelato-donatello-premium-v5`:

- **Die komplette Eisbecher-Karte ist jetzt strukturiert hinterlegt**: 7 Kategorien, 68 Quelleneintraege und alle bestaetigten Einzelpreise. Das doppelte Waldbeer in der Joghurt-Quelle bleibt markiert erhalten.
- **Alle Extras sind strukturiert hinterlegt**: 13 Sossen, 2 Cremes, 9 Likoere und 9 Toppings.
- **Kernpreise sind bestaetigt und veroeffentlicht**: Kugel 1,60 €,
  Sahne 1,20 €, Sosse 1 €, Creme 1,50 €, Likoer 1,50 €, Streusel 1 €
  (`assets/js/data/pricing.js`, zuvor in `gelato-donatello-premium-v5` als
  `PENDING_OWNER_CONFIRMATION` gefuehrt und nicht angezeigt).
- **Eistorten-, Eisbomben- und Eisvitrine-Preise sind jetzt bestaetigt**:
  Eistorten 18/20/24/26 cm = 65/75/95/109 €, 2 Sorten inklusive, Premium
  +5 €; Eisbomben 40/60 Kugeln = 75/109 €, bis 6 Sorten, Premium +5 €;
  Eisvitrine 250 € Miete, 100 € Kaution, 5 L Eis, 4 Sorten, Zubehoer
  inklusive, ca. 90 x 75 x 45 cm.
- Neue CSS-Komponenten `.price-table`, `.price-cards`, `.price-card`,
  `.price-facts` in `assets/css/style.css` fuer eine editoriale
  Preis-Darstellung ohne Inline-Styles (CSP-konform).
- Die 41 Sortennamen und Geschaeftsfakten sind unveraendert aus dem
  Owner-Brief uebernommen (identisch zu `gelato-donatello-premium-v5`).

## Asset-Ingest (neue Fotos ergaenzen, ohne Redesign)

1. `assets/manifest.json` oeffnen und den Ziel-Pfad fuer das gewuenschte Motiv
   nachschlagen (z. B. `/assets/images/shop/interior-long.webp`), oder fuer Sorten
   `assets/manifest.json` &rarr; `flavor_assets.slots` nach `slug` durchsuchen.
2. Die Bilddatei exakt unter diesem Pfad (als Datei relativ zum Projekt-Root,
   ohne das fuehrende `/`) ablegen.
3. `rights` in `assets/manifest.json` von `"pending"` auf `"owned"` oder
   `"licensed"` aktualisieren, sobald die Bildrechte bestaetigt sind.
4. Nichts weiter aendern: `assets/js/components/asset-image.js` zeigt das Foto
   automatisch an; ohne Datei bleibt der gestaltete Platzhalter ("Foto folgt")
   sichtbar, es entsteht kein kaputtes Bild-Icon.
5. Fuer Sortenfotos gilt das Pfadmuster `/assets/images/flavors/{slug}.webp` aus
   `assets/js/data/flavors.js` (`flavorImagePath`). Die 41 Slugs sind in
   `assets/manifest.json` &rarr; `flavor_assets.slots` einzeln aufgefuehrt.

In dieser Session wurden **keine Owner-Bilder physisch in den Workspace
eingebracht** (kein Netzwerkzugriff verfuegbar, keine Dateien bereitgestellt).
Alle Manifest-Eintraege stehen auf `"pending"`. Es wird an keiner Stelle im
Code oder in der Dokumentation behauptet, dass Bilder bereits ingestiert
sind. Oeffentliche Donatello-Bilder oder generische Stockfotos duerfen nicht
ohne denselben Rechte-Nachweis wie Owner-Material eingebunden werden.

## Alle Pfade sind root-relativ (absolut)

Jeder `data-asset-path` sowie `flavorImagePath()` nutzt einen Pfad, der mit
`/` beginnt (z. B. `/assets/images/flavors/pistazie.webp`). Das ist notwendig,
damit Bilder auch auf Unterseiten wie `/eisbecher/` korrekt relativ zur
Domain statt zur aktuellen Verzeichnis-URL aufgeloest werden.

## CSP-Konformitaet

`_headers` setzt `style-src 'self'` ohne `'unsafe-inline'`. Alle Komponenten
in `assets/js/components/*` verwenden ausschliesslich CSS-Klassen (keine
`style="..."`-Attribute und keine `element.style.*`-Zuweisungen) und die
Kontaktseite nutzt Schema.org-Microdata (Attribute auf bestehenden
Elementen) statt `<script type="application/ld+json">`, damit nichts durch
die CSP blockiert wird. `form-action 'none'` in `_headers` stellt sicher,
dass die Anfrage-Formulare (ohne bestaetigten digitalen Kanal) technisch
nicht an einen externen Endpunkt senden koennen.

## Tests ausfuehren &mdash; Ausfuehrungsstatus dieser Session

```
node scripts/gelato-donatello-v5-final-smoke.mjs
```

Das Skript (`scripts/gelato-donatello-v5-final-smoke.mjs`) folgt der
Repo-Konvention (`node:assert/strict`, kein externer Test-Runner, liest
Dateien direkt und importiert `flavors.js`/`pricing.js`/`business.js`
dynamisch) und prueft:

- Alle 6 Routen + `404.html` existieren, sind in der Navigation verlinkt,
  haben `noindex`-Meta, binden `style.css`/`app.js` ein und enthalten genau
  ein `<h1>`.
- `assets/js/data/flavors.js` enthaelt genau 41 Eintraege (30 `regular`,
  11 `special`), alle `status: 'confirmed'`, keine Duplikate; Stichproben
  echter Sortennamen sind vorhanden.
- `assets/js/data/pricing.js` enthaelt zusaetzlich die vollstaendige Eisbecher-Karte (7 Kategorien / 68 Quelleneintraege) und 33 Extras; das doppelte Waldbeer der Joghurt-Quelle ist explizit markiert.
- `assets/js/data/pricing.js` entspricht den bestaetigten Kernpreisen, Eistorten-/Eisbomben-Groessen und der Eisvitrine-Konditionen aus der Owner-Quelle.
- Die bestaetigten Preise erscheinen tatsaechlich im HTML-Inhalt der
  jeweiligen Seiten (Eisbecher, Eistorten & Eisbomben, Eisvitrine).
- Geschaeftsfakten stimmen mit dem Owner-Brief ueberein; Oeffnungszeiten
  bleiben bewusst `null`.
- `assets/manifest.json` ist gueltiges JSON mit 41 Sorten-Slots und allen
  Bildkategorien; alle Eintraege stehen auf `rights: "pending"`.
- `project.json`-Safety-Flags, `_headers` (CSP, X-Robots-Tag) und
  `robots.txt` sind vollstaendig privat/nicht-oeffentlich.
- `style.css`/`tokens.css` enthalten mobile Breakpoints bis 1440px und einen
  `prefers-reduced-motion`-Block; keine Inline-`style="..."`-Attribute oder
  `element.style.*`-Zuweisungen in HTML/JS (CSP-Konformitaet).
- Die bestehenden Ordner `gelato-donatello-website-v5/` und
  `gelato-donatello-premium-v5/` sind weiterhin vorhanden und unveraendert.

**Ausfuehrungsstatus (verifizierter Release-Checkout, 2026-10-05):**
`node scripts/gelato-donatello-v5-final-smoke.mjs` wurde in einem sauberen,
isolierten Checkout des AURENTARA-Branches tatsaechlich ausgefuehrt und mit
PASS abgeschlossen. Geprueft wurden alle 6 Routen, exakt 41 Sorten
(30 regular/11 special), bestaetigte Kernpreise, Eistorten/Eisbomben,
Eisvitrine, Safety/NOINDEX, CSP, Asset-Manifest, 1440px-Responsive-Regeln
und `prefers-reduced-motion`. Zusaetzlich bestanden alle Dateien unter
`assets/js/` einen `node --check`, und alle JSON-Dateien wurden erfolgreich
geparst. Der Release-Checkout basiert auf Base-Commit
`4f3e6d57cf5869add3718cea9bedca9c7148724c`. Lokale Quarantaene-Kandidaten
sind keine Laufzeitabhaengigkeit dieses Releases.

## Bekannte Luecken (siehe auch `project.json` &rarr; `known_gaps`)

- Keine Oeffnungszeiten bestaetigt.
- Owner-Fotomaterial ist angekuendigt, aber in dieser Session noch nicht
  physisch im Workspace eingegangen; alle Manifest-Eintraege `pending`.
- Kein bestaetigter digitaler Anfrage-Kanal (E-Mail/CRM) &rarr; Anfrage-Formulare
  fassen lokal zusammen statt zu versenden (technisch durch `form-action 'none'`
  in `_headers` zusaetzlich abgesichert).
- Impressum/Datenschutz bewusst ausserhalb des beauftragten 6-Seiten-Scopes.
- Der V5-Smoke wurde im isolierten Release-Checkout tatsaechlich ausgefuehrt und PASS verifiziert.

## Daten-Pass Acceptance

Am 2026-10-05 wurde der erweiterte V5-Smoke nach Integration der vollstaendigen Eisbecher- und Extras-Daten tatsaechlich ausgefuehrt. PASS: 6 Routen, 41 Sorten, 68 Becher-Quelleneintraege, 33 Extras, Kernpreise, Eistorten/Eisbomben, Eisvitrine, Safety/NOINDEX, Asset-Manifest und responsive CSS. Alle Projekt-JavaScript-Dateien bestanden node --check; alle JSON-Dateien wurden erfolgreich geparst.

## Asset-Ingest Acceptance

Asset-Paket V1 enthaelt 78 aus Owner-Uploads abgeleitete WebP-Dateien mit SHA-256-Provenance. Alle 41 Sortenbilder sind physisch vorhanden. Eisbecher, Eistorten/Eisbomben, Logo und Ladenfotos sind in die private V5-Oberflaeche verdrahtet. Die mobile Mietvitrine bleibt mangels eindeutigem Owner-Foto absichtlich im Placeholder-Zustand. Production/Public bleiben OFF.
