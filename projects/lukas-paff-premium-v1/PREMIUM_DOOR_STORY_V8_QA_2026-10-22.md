# Lukas Paff | Türszene Premium V8
Geprüfter Stand: 22.10.2026. **Nur private Preview, keine Produktionsveröffentlichung.**

## Auftrag
Bisherige flache SVG-Illustration „Der erste Schritt“ durch die freigegebene hochwertigere, wärmere Bildwelt ersetzen. Bestehende Angebote, Kinder-Trainingsillustrationen und Kontakte unverändert erhalten.

## Tatsächlich umgesetzt
- Bestehenden Abschnitt `#ablauf` gezielt überarbeitet, kein Website-Neubau.
- Großformatige symbolische KI-Bildszene eines Kindes an einer Haustür, passendes Terrakotta-/Creme-Design, kurze emotionale Botschaft und direkt verlinktes Erstgespräch.
- Vier individuelle, textfreie Bildausschnitte zu „Zögern“, „Die Tür öffnet sich“, „Der erste Schritt“, „Zuversicht“. Eingebrannte Nummern aus dem Referenzmockup wurden in einer zweiten Qualitätsrunde ausgeschnitten; Nummern sind ausschließlich HTML.
- Originale drei Informationsschritte (Anfrage senden, Situation besprechen, passendes Angebot erhalten) in nativ aufklappbaren `details/summary` erhalten.
- Mobile 2×2-Bilderraster, mobile CTA, responsiver Bildausschnitt und `prefers-reduced-motion`-schonende Effekte.
- Symbolbilder weiterhin klar als KI-Illustrationen gekennzeichnet, keine dokumentierten Trainingssituationen oder psychologischen Wirkungsversprechen.

## Versionen
- GitHub-Baseline: `0dac5f7c754c430add001e70d53a9c45feb2e8fc`
- HTML-Änderung: `67833761bb84286e47e22d1df4fc60f1aaedae85`
- Erste Medien-Einbindung: `4722b222109fbc411ecc478510d2f0a25f76b4a6`
- Korrigierte Bildnummern: `1b84288e9475490288518c57f9dee9fa100be128`
- Worker-Deployment: `a195df04-08c5-4d90-8793-3b59118a931e`
- Worker-Version: `87ca89d8-9e3e-449a-9c44-8b6d5c28c3ab` (100 %)
- Preview: https://lukas-paff-private-preview-v1.gelato-donatello-dario-a5a5376c.workers.dev/

## Dateien / Auslieferung
- `projects/lukas-paff-premium-v1/preview.html`
- `projects/lukas-paff-premium-v1/assets/story/door-hero.webp`
- `projects/lukas-paff-premium-v1/assets/story/door-step-{1..4}.webp`
- Alle fünf Medien werden ausschließlich über `/media/story/` des bereits geschützten Workers mit `image/webp` ausgeliefert; Größen ca. 4,9 bis 33,7 KB.
- Bestehende ORIGINAL_MEDIA, AI_MEDIA, Video und das echte Lukas-Porträt wurden beim Worker-Upload erhalten.

## Nachgewiesene QA
- JS parsebar, Git diff geprüft, HTML enthält fünf neue Story-Bilder, vier Trainingseinheiten und vier vorhandene Angebote.
- Cloudflare read-back bestätigt alle Medienpfade und aktive Worker-Version zu 100 %.
- Bilddaten validiert als WebP; Cloudflare Access Policy weiterhin Owner-only; noindex aktiv.
- Anonyme HTTP-Tests für /, neue Bilder, alte AI-Illustrationen und Video leiten jeweils per HTTP 302 zum Access-Login weiter.
- Cloudflare Browser Rendering auf **320 px**: kein horizontaler Überlauf (`scrollWidth=320`), vier Story-Karten, vier Trainingsbereiche, interne Anker vollständig, ausklappbare Ablaufdetails und mobiles Menü funktional. Die Zahl der sofort dekodierten Bilder wurde bei DOMContentLoaded abgefragt, bevor Bildladen vollständig abgeschlossen war, und ist **kein Bilderlade-Nachweis**.

## Noch offen
- Echte authentifizierte Full-Page-Screenshots, vollständige 390/430/768/820/1024/1280/1440/1920 Browser-Runs (weitere Browser-Rendering-Aufrufe erreichten HTTP 429).
- iPhone Safari Hardware-Test, Core Web Vitals, WCAG-2.2-AA-Abnahme und authentifizierte Video-Wiedergabe.
- Die sechs bisherigen AI-Trainingsillustrationen wurden nicht neu gestaltet. Kein 90+-Score behauptet.
- Die KI-Türszene ist eine **statische Bildsequenz**, keine natürlich bewegte Videosequenz. Das vermeidet die bemängelten, mechanischen SVG-Bewegungen und stimmt mit dem freigegebenen Bildentwurf überein.

Status: **Visuelle V8-Integration erfolgreich privat deployed, vollständige QA-Freigabe ausstehend.**
