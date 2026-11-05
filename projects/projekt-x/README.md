# PROJEKT X 🍦

Ein eigenständiges, mobiloptimiertes Eis-Clicker-Spiel, inspiriert von der gestalterischen Welt der Gelato-Donatello-Website.

## Spielen
```bash
cd projects/projekt-x
python3 -m http.server 8080 --bind 127.0.0.1
```
Öffne `http://127.0.0.1:8080/` im Browser. Ein Webserver ist erforderlich, weil die Spiellogik ES Modules verwendet.

## Features
- Tippen auf Eis für Kugeln und Upgrades für mehr Klickleistung.
- Passive Produktion durch Assistent, Maschine, Wagen, Labor und weitere Filialen.
- Vanille, Erdbeere, Schokolade, Pistazie als visuelle Sorten.
- Kostenkurve von 17% je Kauf, 7 Meilensteine und 4 Erfolge.
- Automatischer lokaler Spielstand und Offline-Produktion bis 8 Stunden.
- Keine Cookies vom Server, kein Backend, keine Konten und keine externen Abhängigkeiten.

## Tests
```bash
node --test projects/projekt-x/tests/*.test.mjs
```

## Einbindung in JARVIS / Claude
Claude-Code-Anweisungen: `projects/projekt-x/CLAUDE.md`.
Repository-Branch: `factory/projekt-x-eis-clicker-v1`.
Ein separater Claude.ai-Web-Projektordner wird durch den Git-Workspace **nicht** automatisch angelegt. Eine entsprechende Claude-Integration muss dafür nachgewiesen werden.

## Sicherheit
Nicht produktiv geschalteter Prototyp. Isolierter GitHub-Projektbranch für JARVIS/Claude-Anbindung; kein Deployment und keine produktive Veröffentlichung ohne zusätzliche Freigabe.
