# Lukas Paff · Premium Website Factory V1

## Projektstatus
PRIVATE PREVIEW. Kein Produktionsdeploy, keine DNS-Änderung, keine personenbezogenen Datenverarbeitung.

## Architektur
- Quellen: Originalwebsite `https://www.lukaspaffantimobbing.com` und Google-Drive-Ordner `Website Paff,Lukas`.
- Präzise abgegrenzter Source: `projects/lukas-paff-premium-v1/preview.html`. Keine Änderungen an Gelato Donatello, HAMYREN oder LUNARA.
- Eigenständiger Cloudflare Worker `lukas-paff-private-preview-v1`, mit eigenem Cloudflare Access Owner-only.
- Noindex, keine Formularspeicherung, Kontakt nur per E-Mail / Telefon / WhatsApp.
- Zum Schutz gegen öffentliche Verbreitung keine Originalmedien im öffentlichen GitHub-Repo. Ausschließlich ein authentisches Portrait + optimiertes Video werden beim geschützten Deployment injiziert.
- Responsive HTML/CSS/JavaScript ohne Build-Abhängigkeiten. Animationen berücksichtigen Reduced Motion. Mobile Menü, FAQ und Links sind funktional.
- Rechtstext-Links zeigen auf die Bestandswebsite, noch nicht inhaltlich geprüft.
- Google Fonts sind noch extern geladen und vor einem öffentlichen Launch datenschutzrechtlich zu prüfen beziehungsweise selbst zu hosten.

## Asset-Inventar des tatsächlichen Google-Drive-Ordners (18.10.2026)
| Originaldatei | Format und Größe | Pixel / Laufzeit | Bewertung und Entscheidung |
|---|---|---|---|
| `204B031E-5F6E-4DC0-9D09-E8A37F29461D.png` | PNG · 1.78 MB | 1024×1024 | Lukas-Paff-Logo, transparent, optional für Markenbausteine; aktuelle Header-Marke bewusst dezenter |
| `51fc61e8-dd9a-4377-b44f-d68cab3c575e.jpg` | JPG · 247 kB | 1080×1350 | Herbstferien-Flyer, **zeitgebundener Termin**; nicht als aktuelles Angebot übernehmen |
| `IMG_6887.HEIC` | HEIC · 2.36 MB | 640×896 | unscharfe abstrakte Nahaufnahme ohne erkennbaren Projektbezug; zurückgestellt |
| `IMG_6504.AVIF` | AVIF · 26.5 kB | 690×612 | authentisches Porträt von Lukas, **Hero / Über-mich**, eingesetzt |
| `IMG_6498.AVIF` | AVIF · 16.6 kB | 592×336 | KI-Illustration Handlungsfähigkeit, niedrig aufgelöst, ersetzt durch CSS/SVG |
| `IMG_6499.AVIF` | AVIF · 31.7 kB | 592×342 | KI-Illustration Achtsamkeit, niedrig aufgelöst, ersetzt durch CSS/SVG |
| `IMG_6500.AVIF` | AVIF · 15.4 kB | 592×336 | KI-Illustration Körpersprache, niedrig aufgelöst, ersetzt durch CSS/SVG |
| `IMG_6501.AVIF` | AVIF · 19.9 kB | 592×336 | KI-Illustration Empathie, niedrig aufgelöst, ersetzt durch CSS/SVG |
| `IMG_6502.AVIF` | AVIF · 36.9 kB | 592×336 | KI-Illustration Schnitzeljagd; Text ins Bild gerendert; ersetzt durch neutrale Vektorillustration |
| `IMG_6505.AVIF` | AVIF · 36.6 kB | 592×336 | KI-Illustration Schnitzeljagd / Team, nicht verwendet |
| `3f704aeedbd44349b1a2f8dfcdf973f6.mov` | QuickTime HEVC/AAC · 98.70 MB | 1080×1920 · 91.1 s | erwachsener Sprecher Lukas; für private Vorschau nach H.264/AAC, 540×960, 1.25 MB konvertiert, Poster erzeugt; vor Veröffentlichung Rechte prüfen |

## Beobachtungen an der Bestandswebsite
- Hauptinhalte wurden übernommen: Handlungsfähigkeit, Achtsamkeit, Körpersprache, Empathie, Ferienprogramme, Einzelcoaching, Mobbing-Schnitzeljagd und Kombiprogramm (8 Stunden).
- Der alte Einstieg arbeitet mit einer beunruhigenden Mobbingstatistik und drastischen Folgerungen. Die neue Vorschau beginnt vertrauensvoll und ohne ungeprüfte Wirkungsversprechen.
- Leistungen und Kontakt stehen jetzt früher und klarer in der Nutzerführung.
- Bestehende Qualifikationsangaben sind aus der Website übernommen; Zertifikate sollten für die Freigabe dokumentiert werden.
- Der ehemalige Websitekontakt hat ein Formular. Unsere Vorschau nutzt statt unsicherer Datenspeicherung direkte, nachvollziehbare Kontaktlinks.
- Bestehende Rechtstexte wurden nicht vollständig überprüft.

## Tests
- Desktop 1440, Mobil 390 und Tablet 810 via lokaler Chromium/Playwright-Sichtprüfung.
- Ein Haupttitel, 5 FAQ-Einträge, mobile Menüöffnung und -schließung und Direktkontaktlinks geprüft.
- JavaScript-Seitenfehler: 0 auf drei Viewports.
- Horizontales Overflow: anfangs mobil erkannt und in Loop 1 behoben.
- Originalvideo mit ffmpeg transkodiert und ffprobe auf H.264/AAC sowie Dauer geprüft.
- Cloudflare Access per HTTP 302 vom VPS auf dem tatsächlichen Host verifiziert.
- Kein echter iPhone-Safari-Hardwaretest und noch kein authentifizierter Remote-Browsertest erfolgt.

## Freigaben vor Veröffentlichung
1. Zustimmung und Nutzungsrechte für Medien klären, insbesondere für Aufnahmen mit Kindern. Vorläufig nur Owner-only.
2. Impressum/Datenschutz, externe Fonts und Datenschutzhinweise juristisch abnehmen.
3. Angebots-/Preisdetails und aktuelle Ferienkurstermine von Lukas freigeben lassen.
4. Echtes iPhone Safari, Ladezeit, visuelle Details unter authentifizierter Session testen.
5. Eigenes ausdrückliches Produktions-GO abwarten.
