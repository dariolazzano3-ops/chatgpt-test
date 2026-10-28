# Track 03 | Web-App, Story Builder & Reader
**Mission:** Personalisieren und auf jedem Handy angenehm lesen können, ohne eine native App zu installieren.

**Definition:** Die Web-App ist die interaktive Funktion **innerhalb der Website**. Native iOS-/Android-Apps und eine installierbare PWA stehen auf **DEFERRED**, bis Kundenbedarf und Wirtschaftlichkeit belegt sind.

## Bereits geprüft
- Vier Wizard-Schritte: Name/Alter, freiwillige Lieblingsdetails, Traumwelt, Zusammenfassung.
- Sechs sanfte Themen. iPad-Darstellung, Vollbild, Scrollen, sichere Textdarstellung, iPhone-Browsertests.
- Private Reader-API lädt bisher Originalgeschichte „Mia“ aus D1; neuester-Story-Reader-Code wurde vorbereitet, aber Deployment nicht nachgewiesen.

## Aufgaben
- [ ] Formularversion und Eingabevertrag `lunara.story.draft.v1` verbindlich dokumentieren; für Eltern verständliche Felder und Fehlertexte.
- [ ] Altersfreigabe mit 01 und originalen Prompts synchronisieren; keine falsche Altersaussage.
- [ ] Datensparsamkeit, Consent und Übergabe nur nach serverseitiger Bestellung; keine persönlichen Daten in Analytics/URLs.
- [ ] Reader strikt unterscheiden: **Demo** vs. berechtigter **gekaufter Inhalt**, nie generische neueste Kundengeschichte öffentlich zeigen.
- [ ] Leer-, Lade-, Fehler-, Schließen- und Zoomzustände; Mobile-Scroll und Fokus testen.
- [ ] Echte eigene Geschichte erst nach 06/07 und berechtigtem Zugriff verfügbar machen.
- [ ] Native App separat nur bei nachgewiesener Nachfrage/Retention und positivem ROI prüfen.

**Definition of Done:** End-to-End-Test eines anonymen Demo-Besuchers und eines autorisierten Testkäufers, ohne Datenüberschneidung und ohne Freigabe fremder Geschichten. Zugriffs- und Mobiltests dokumentiert.
**Abhängigkeiten:** 01, 06, 07, 10.
**Status:** PARTIAL.