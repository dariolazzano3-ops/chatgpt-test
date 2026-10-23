# Lukas Paff | Audience Experience V2 | Private QA

**Datum:** 23.10.2026 · **Scope:** ausschließlich `#zielgruppen` in `projects/lukas-paff-premium-v1/preview.html` · **Launch:** private Access-geschützte Preview

## Umsetzung
- Headline: „Zwei Wege. Ein gemeinsames Ziel.“; Subline „Kinder stärken. Individuell und gemeinsam.“
- Karte 01: warme, beige-terracotta Editorial-Komposition, Einzelcoaching `#einzelcoaching`.
- Karte 02: dunkles gedecktes Grün, ruhiges großes „Wir.“-Typomotiv, Gruppenangebote `#schulangebote`.
- Erhaltene private Textur `/media/original/weitere-originalaufnahme.jpg` wird ausschließlich als subtile Hintergrunddetailaufnahme in Karte 02 weitergenutzt. Keine neuen privaten Dateien im öffentlichen GitHub. Keine bestehenden Kinder-KI-Bilder als echte Fotografien ausgegeben.
- Beide Karten sind jeweils **ein** semantischer Link, inklusive tastaturbedienbarem Fokus. Keine verschachtelten Links oder Buttons.
- Einmaliges Scroll-Reveal über IntersectionObserver (19 px, 600 ms), dezenter Desktop-Hover (1.025×). Reduced Motion schaltet die Animationen aus; ohne JavaScript bleiben sämtliche Inhalte sichtbar.
- Kompaktes responsives Layout, zwei Karten untereinander unter 760 px.

## Automatisierte Browser-Tests
VPS Chromium/Playwright, lokale HTML-Prüfung mit geschütztem Originalporträt im QA-only HTML und vorhandener Originaldetailtextur. Beide werden nicht in GitHub committed.

| Viewport | vorher Gesamthöhe Zielgruppen | danach | Test |
|---|---:|---:|---|
| 320 px | 978 px | 932 px | PASS |
| 375 px | 913 px | 881 px | PASS |
| 390 px | 920 px | 887 px | PASS |
| 430 px | 948 px | 846 px | PASS |
| 820 px | 813 px | 795 px | PASS |
| 1440 px | 882 px | 929 px | PASS; bewusst großzügiger Desktop |

- Keine seitlichen Überläufe in allen sechs Viewports. Keine Browser-JavaScript-Fehler.
- Exakte Abschnittsreihenfolge unverändert (`start,ueber,zielgruppen,angebote,methode,ablauf,einblicke,fragen,kontakt`).
- Original-CTAs real angeklickt: `#einzelcoaching` sowie `#schulangebote` existieren und werden angesprungen.
- Weitere Navigationsanker, FAQ (6), Kontaktwege, `/ferienkurse/`-Link und Originalvideo bleiben vorhanden.
- JS-Syntax mittels `node --check` bestanden, `git diff --check` bestanden.
- `prefers-reduced-motion: reduce`: beide Karten sichtbar; JavaScript ausgeschaltet: beide Karten sichtbar.
- Progressive Reveal (beide sichtbar nach Scroll) bestanden; Hover-Transform nach 650 ms = 1.025; Tastatur-Fokus mit sichtbarer Outline bestanden.
- 320/390/1440 Vorher-Nachher-Screenshots auf privatem VPS: `/home/jarvis/lukas-paff-audience-v2-20261023/.qa/`.

## Restliche Grenzen
- Der verwendete echte Originalmaterial-Ausschnitt ist eine abstrahierte Textur, **keine** Aufnahme aus einer Trainingssituation. Das wurde bewusst gewählt, da die vorhandenen KI-Illustrationen künstlich und mit eingebrannten Texten versehen sind.
- Kein physischer iPhone-Safari-Test, kein authentifiziertes Browser-E2E hinter Cloudflare Access. Automatisierte Tests liefen lokal in Chromium.
- Beim Deployment muss die bestehende Cloudflare-Access-Sperre (302), die Ferienkursroute und `noindex` per Readback erhalten bleiben.
