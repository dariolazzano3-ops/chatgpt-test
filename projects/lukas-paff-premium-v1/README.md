# Lukas Paff | Editorial Redesign V2 (Private Preview)

**Status:** PRIVAT DEPLOYED. Kein Live-Launch, keine DNS-Änderung, keine neuen Dienste.

## Referenzrecherche am 18.10.2026
Primäre Designreferenz: https://kidstricks.de/ und https://kidstricks.de/uber-uns/ (redaktioneller Informationsaufbau, große klare Headlines, persönliche Haltung, Trennung der Leistungen).
Sekundäre UX-Referenz: https://www.carina-zembrod.de/ (verständliche Angebotshierarchie, Coach-Profil, FAQ, einfacher Erstkontakt).
Weitere verglichene Seiten: https://heute-schon-loewenkinder.de/, https://ifeelkids.de/, https://www.maike-wurzelstark.de/, https://www.kinder.training/, https://www.stepup-heroes.de/.
Es wurden keine fremden Texte, Bilder oder Designelemente kopiert. Inspiration betrifft allein Prinzipien für die Struktur und visuelle Sprache.

## Gestaltungsentscheidung
- Editorial / modern: helle gebrochene Weißflächen, Schwarz, ein Orange-Akzent (#d4512f).
- Starke großformatige Typografie, klare Sektionstypen, großzügiges Raster statt Kartenwüste.
- Entfernt: grüne Symbole, verspielte Sterne, dekorative Spruchkästen, künstliche Trust-Sticker, zufällige Füllflächen.
- Hero mit authentischem Porträt. Weitere Sektion mit echtem Videostill; Video bleibt on-demand.
- Bereiche: Hero, Haltung, vier Angebotsarten, vier Trainingsschwerpunkte, Lukas-Profil, Module A/B/C, Video, FAQ, Kontakt.
- Responsive: Desktop 1440 px, Tablet 820 px, Mobil 390 px.
- Rechtliche Hinweise & Quellenanschluss: Rechtsseiten verlinken die bisherige Website. Vor Produktionsstart auf Aktualität prüfen.

## Technische Architektur
- Quelltext `projects/lukas-paff-premium-v1/preview.html` enthält keine privaten Originalmedien.
- Originalmedien werden ausschließlich zur Bereitstellung im Cloudflare Worker injiziert.
- Worker `lukas-paff-private-preview-v1` mit eigener Cloudflare-Access-Anwendung Owner Only.
- / und /media/lukas-intro.mp4 sind durch Access gesichert; nicht angemeldete Anfragen erhalten HTTP 302.
- Videos: aus MOV komprimiertes H.264/AAC-MP4 mit ca. 1,25 MB, posterbasiert, ohne Autoplay. Byte-Range-Requests werden unterstützt.
- Noindex, Robots-Disallow, kein Tracking, keine Speicherung von Kontaktformularen.
- Keine extern geladenen Webfonts. Keine neuen kostenpflichtigen Abonnements.

## Lokale Qualitätsrunde V2
- Chromium Headless Desktop (1440×900), Tablet (820×1080), Mobile (390×844) gerendert und Screenshots geprüft.
- 1× H1, 2× Bilder vollständig geladen; kein horizontaler Overflow; keine JavaScript-Laufzeitfehler.
- Mobiles Menü auf/zu inklusive Anker-Navigation funktioniert; FAQ öffnet.
- Deployed Worker mit Cloudflare-API-Readback geprüft und Cloudflare-Access-Owner-Policy gelesen.
- Extern von VPS getestet: HTTP 302 auf / und /media/lukas-intro.mp4.
- Kein echter Safari-Hardwaretest und kein eingeloggter Browser-End-to-End-Test erfolgt.

## Vor dem öffentlichen Launch
1. Nutzungsrechte für die Originalmedien, insbesondere alle Aufnahmen mit Kindern, klären.
2. Qualifikationen/Coach-Zertifikate und alle fachlichen Aussagen mit Lukas bestätigen.
3. Rechtstexte und Kontaktangaben prüfen.
4. Safari iPhone, eingeloggte Video-Wiedergabe, Performance und Barrierefreiheit abschließend testen.
5. Nur mit explizitem GO Produktion/DNS veröffentlichen.

## Projektisolation
Keine Änderungen an Gelato Donatello, HAMYREN oder Lunara. Kein direktes JARVIS-/Hermes-/Claude-Code-Routing behauptet.

## V3 — Inhaltstiefe und Original-KI-Illustrationen | 18.10.2026

### Inhaltliche Prüfung
Referenz: https://www.lukaspaffantimobbing.com/ (Originalwebsite, am 18.10.2026 ausgelesen).
Verglichen mit V2: Sichtbare Textmenge ohne Navigation/Footer: 615 Wörter (V2) → 1.114 Wörter (V3), etwa +81 %.
Wiederhergestellt / vertieft:
- Ausführliche Beschreibungen der vier Schwerpunkte Handlungsfähigkeit, Achtsamkeit, Körpersprache, Empathie.
- Ferienprogramme, Zielgruppen, Orte, überregionale Einsatzplanung.
- Einzelcoaching und persönliche Terminabsprache.
- Modul B mit Detektivgeschichte, fiktivem Fall, Rollen und Teamaufgaben.
- Modul C als Kombination aus A+B, acht Stunden.
- Kostenloses Erstgespräch und individuelle transparente Preisgestaltung, Hinweis auf pädagogischen Förderpreis.
- Schulsozialarbeiter, B.A. Soziale Arbeit, DEKRA-zertifizierter Coach und persönliche Motivation aus dem Original.
- Fachliche Abgrenzung als pädagogische Prävention/Intervention, keine Therapie oder Diagnostik.
- FAQs: 5 → 7 inklusive Dauer, Preis und Einzelcoaching.

### Medien
Sechs vorhandene KI-Illustrationen aus dem freigegebenen Original-Drive integriert:
- IMG_6498.AVIF — Handlungsfähigkeit
- IMG_6499.AVIF — Achtsamkeit
- IMG_6500.AVIF — Körpersprache
- IMG_6501.AVIF — Empathie
- IMG_6502.AVIF — Schnitzeljagd
- IMG_6505.AVIF — Teamarbeit
Originalbilder werden weder inhaltlich verändert noch im öffentlichen GitHub gespeichert.
Das Logo und datierte Kursflyer sind bewusst nicht als allgemeine Angebotsfotos integriert.
Alle KI-Grafiken sind ausdrücklich als Konzeptillustrationen gekennzeichnet. Sie geben keine echten Kursszenen vor.
Originalporträt, Videostill und Video bleiben erhalten.
Responsive crop v3 korrigiert, damit eingebrannte Texte auf den Illustrationen vollständig sichtbar sind.

### QA / Einschränkungen
- Lokale Chromium-Browserprüfung via page.set_content() bei 1440, 820, 390 Pixeln.
- 8 von 8 Bildern dekodiert, 1 H1, 7 FAQ-Einträge, JavaScript-Seitenfehler: 0.
- Kein horizontaler Überlauf auf Desktop/Tablet/iPhone-Viewport.
- Mobiles Menü öffnet und schließt korrekt.
- Neue Cloudflare-Worker-Version direkt ausgelesen, 6 KI-Bilder und Originalmedien bestätigt.
- Cloudflare Access bleibt Owner-only; anonyme requests zu / und /media/lukas-intro.mp4 werden nach Login umgeleitet (HTTP 302).
- Nicht geprüft: authentifizierte Videoabspielung auf realem Safari-Gerät.
- Vor Produktion zu klären: Medienrechte, Qualifikationsnachweise, Datenschutz/Impressum, aktuelle Kurstermine.
- Absichtlich nicht blind übernommen: ungeprüfte epidemiologische Aussage / Wirkungsversprechen, denn sie erfordern belastbare Quellen.
- Bewusste Abweichung: keine aktive Dateneingabe in einer öffentlich erreichbaren Kontaktform; stattdessen E-Mail/Telefon/WhatsApp.
