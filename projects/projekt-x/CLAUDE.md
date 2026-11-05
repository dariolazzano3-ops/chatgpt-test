# Projekt X · Claude Code Briefing

**Spielidee:** Eigenständiger Eis-Clicker im Stil von Cookie Clicker. Benutzer tippen auf eine Eis-Kugel, erhalten Kugel-Punkte und investieren diese in passive Produktion und Klick-Upgrades.

**Projekt:** `projects/projekt-x`
**Referenz nur für Design:** `projects/gelato-donatello-premium-v6`. Die Referenz ist keine zu ändernde Zielanwendung.

## Verbindliche Regeln
- Isoliert arbeiten, niemals bestehende Gelato-Donatello-Projektdateien bearbeiten.
- Design: warmer Elfenbeinton `#f7f2e7`, Espresso `#4a291f`, dunkles Kakao `#311912`, Salbei `#68734e`, Terrakotta `#b76d53`. Hochwertige italienische Gelateria, keine generischen Gaming-Neonflächen.
- Mobile first: iPhone-Safari, große Touch-Flächen, reduzierte Bewegung respektieren.
- Daten lokal im Browser, kein Tracking, keine externen APIs oder Backend-Kosten.
- Geldwert der Kugeln ist ausschließlich spielintern. Kein Echtgeld, keine Gewinnversprechen.
- Bilder der 4 Sorten wurden aus der vorhandenen owner-provided Gelato-Referenz übernommen; keine Fremdbilder nachladen.
- Lokale Tests: `node --test projects/projekt-x/tests/*.test.mjs` aus Repository-Root. Zusätzliche Integritätsprüfung steht in `tests/static.test.mjs`.
- Für Produktivschaltung und Deployment eine separate Freigabe verlangen. Ein einmaliger Push des isolierten Projektbranches ist für die explizit gewünschte JARVIS-Projektanbindung erlaubt.
- Spielelogik ausschließlich in `economy.mjs` testen, UI in `game.js` und `styles.css`.
- Änderungen ausschließlich unter `projects/projekt-x/**` durchführen.
- Ein erfolgreicher Git-Commit ist noch kein Beweis einer verbundenen Claude-Ausführung.

## Aktuelle Gameplay-Funktionen
Klicker, 4 auswählbare Sorten, 8 skalierende Upgrades, passive Eisproduktion, Offline-Ertrag max. 8h, Meilensteine, Erfolge, lokale Speicherung, Reset, optionaler Sound.
