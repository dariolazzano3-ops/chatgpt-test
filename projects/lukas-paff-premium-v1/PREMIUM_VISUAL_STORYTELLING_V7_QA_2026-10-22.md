# Lukas Paff | Visual Storytelling V7, geprüfter Stand 22.10.2026

**Status:** PRIVATE PREVIEW DEPLOYED · PARTIAL VISUAL QA · NOT 90+ APPROVED.

## Technische Referenzen
- Repository: `dariolazzano3-ops/chatgpt-test`
- Branch: `factory/lukas-paff-premium-v1`
- Ausgangs-Commit: `d5e16dfc5a418e36d907d3bdee0c41a0eb4a48b7`
- Hauptimplementierung: `c634b8eb059a867ab49d9dc084ed0c038f916cdc`
- Mobiler Lesbarkeits-Fix: `91177dca4ea9e21f25ec64714aa4030eb55eb76c`
- Deploy: `fbdcb96f-00ac-4fa2-a84e-799328c58f3f`
- Aktive Version: `c97d8b40-eaa8-4cc4-8354-3a21e0859b83` (100 %)
- Preview: https://lukas-paff-private-preview-v1.gelato-donatello-dario-a5a5376c.workers.dev/

## Umgesetzt
1. Rad der Stärke als SVG-Kreis mit vier Stärken: einmalige Rotation beim Sichtbarwerden, kein Dauerloop.
2. "Der erste Schritt" als symbolische SVG-Szene: geschlossene Tür, Lichtaufbau, schrittweiser Übergang, ruhiges Endbild. Keine reale Trainingsdokumentation, keine Wirkungszusage.
3. Mobile Lesbarkeit nach echter Screenshotkritik erhöht: Legende nun einspaltig statt gedrängt, größere Schrift, kompaktes Rad.
4. CSS-, JS- und Accessibility-Fallbacks für reduzierte Bewegung; Inhalte sind ohne Bewegungs-JavaScript sichtbar.
5. Bestehende Porträt-/Video-Medien und sechs AI-Illustrationen erhalten, ohne neue öffentliche Medienpfade.

## Bildnachweise
Diese Bilder wurden mittels Cloudflare Browser Rendering aus dem tatsächlich ausgelesenen Worker-HTML bzw. aus dem verifizierten GitHub-Ausgangs-HTML erzeugt. Es sind **isolierte Abschnittsrenderings**, keine authentifizierten Full-Page-Browseraufnahmen.

- [Trainingsbereich vorher, 390 px](qa/strength-wheel-mobile-before.jpg)
- [Trainingsrad nach Mobile-Fix, 390 px](qa/strength-wheel-mobile-after.jpg)
- [Türszene Frame 0 ms](qa/first-step-frame-00.jpg)
- [Türszene Frame 2200 ms](qa/first-step-frame-02.jpg)
- [Türszene Frame 4400 ms](qa/first-step-frame-04.jpg)

Die drei Tür-Bilder sind kontrolliert angehaltene Schlüsselbilder der echten CSS-Keyframes. Sie sind **kein Nachweis einer realen Videoaufnahme oder natürlich bewegter menschlicher Gliedmaßen**.

## Nachgewiesene Prüfungen
- Git-Diff-Whitespace-Check und JavaScript-Syntaxprüfung bestanden.
- Cloudflare-API-Readback: aktuell neue HTML-Stile und beide Animationsbereiche; 9 <img>, sechs AI-Medienpfade, drei Originalmedienpfade, Video vorhanden; vorhandene Media-Maps unverändert.
- CSS `prefers-reduced-motion: reduce` und statische Endzustände im Code vorhanden (kein unabhängiger Screenreader-Gerätetest).
- Cloudflare Access Owner-only Policy vorhanden; anonyme HTTP-Anfragen für /, /robots.txt, AI-Medien und Video: HTTP 302 zur Anmeldung.
- noindex/nofollow/noarchive unverändert.
- Cloudflare Browser Rendering /content: **320 px** mit 320 px `scrollWidth`, 4 Skill-Reihen, 4 native Trainingsdetails, 6 AI-Motive, keine kaputten internen Anker.
- Visuell geprüft: zwei 390-px-Varianten des Trainingsbereichs und eine isolierte iPhone-Tür-Szene. Ein nachfolgender separater Content-Aufruf bei 390 px lief gegen das Browser-Rendering-Rate-Limit (HTTP 429).
- Nicht behauptet: vollständige Browserfunktionsprüfung in allen zehn Viewports, echter Safari-/iPhone-Hardwaretest, Formular-/Kontakt-Aktivierung, LCP/CLS/INP-Feldmessungen, Lighthouse oder WCAG-AA-Konformität.

## Qualitätsgrenzen und offene Arbeit
- Die sechs vorhandenen AI-Bilder sind **nicht** vollständig redaktionell neu illustriert. Eine echte harmonisierte Neufassung steht aus; die Originale bleiben sicher.
- Die Türanimation nutzt bewusst einfache vektorielle Figurbewegung; künstlerische Natürlichkeit für das Premium-Gate muss noch mit echter Motion-Kritik bewertet werden. Bei unzureichender Qualität statisch belassen oder professionell ersetzen.
- Screenshots von Hero, Angeboten, Desktop-Gesamtansicht und authentifiziertem Video sind noch offen.
- Weitere Responsive-Tests (360, 430, 768, 820, 1024, 1280, 1440, 1920 px), Tastatur-/Screenreader-Test, Performance- und Rechtsprüfung ausstehend.
- Originalporträt bleibt zentral. Keine fiktiven Referenzen, Qualifikationen, Kinderaufnahmen, Tracking oder Produktionsfreigabe ergänzt.

**Urteil:** Teilfortschritt beim visuellen Storytelling, kein fertiges 90–95-Punkte-Premium-Gate.
