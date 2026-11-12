# FollowClean | Private History V3

Stand: 12. November 2026 · Projekt: `apps/followclean/index.html`

## Implementierung

- Optionaler Snapshot-Speicher im Browser: `followclean:snapshots:v1` (localStorage).
- Der Nutzer muss **für jeden Stand** das separate Opt-in-Kästchen anklicken. Keine automatische Speicherung bei ZIP-Import.
- Pro Browser maximal vier vollständige Stände. Jeder Stand ist auf 650000 JSON-Zeichen begrenzt. Bei Speicherfehlern verständliche Fehlermeldung, keine heimliche Löschung älterer Stände.
- Ein Stand speichert nur: lokale ID, Speicherzeitpunkt, normalisierte Follower-Benutzernamen und Gefolgt-Benutzernamen. Keine ZIP-Binärdaten, Instagram-Zugangsdaten, Stripe-Daten oder serverseitigen Accounts.
- Verlaufsgrafik in SVG ohne externe JS-Bibliothek. Unterschiedliche Farbserien für Follower und Gefolgt; zusätzliche Zahlen pro Stand als barrierearmes Text-Backup.
- Vergleich mit dem derzeit hochgeladenen Export nur nach Bestätigung „gleiches Instagram-Konto“.
- Einzelner Stand löschbar, alle Stände löschbar, bisheriger globaler Button „Lokalen Fortschritt löschen“ entfernt zusätzlich Snapshots und lokale Wiederaufnahme.
- Eine Rückkehrnotiz zeigt die Zahl der lokal vorhandenen Stände nach Neuladen, ohne Daten an den Server zu übertragen.

## Datenschutz und Interpretation

Die Historie enthält **private Instagram-Benutzernamen in localStorage**. Für gemeinsam genutzte Geräte ist sie ungeeignet, und Browser-Speicher kann durch Nutzer oder Safari gelöscht werden. Keine automatische Synchronisierung. Eine lokale Browserhistorie ist kein sicherer verschlüsselter Tresor.

Der gespeicherte Zeitstempel zeigt **Speicherung bei FollowClean**, **nicht das ursprüngliche Instagram-Exportdatum**. Der Vergleich erkennt Differenzen zwischen Exports, nicht zweifelsfrei einen aktiven Entfolge-Vorgang. Kontolöschung, Blockierung oder Namensänderungen können Ergebnisse beeinflussen.

Ohne einen zweiten Export zeigt der Chart einen Punkt je Datenserie. Account-Identität lässt sich ohne Instagram-Login nicht technisch überprüfen, deshalb fordert der Vergleich eine ausdrückliche Bestätigung an.

## Regression / Sicherheitsgrenzen

- Gratis-Analyse und komplette Accountliste unverändert.
- ZIP-Analyse bleibt rein lokal.
- Kein externer Avatar-Service.
- Stripe-Testkauf und Rabattcode RIO bleiben ausdrücklich Sandbox; keine echten Zahlungen, kein neues Payment-Entitlement.
- Nicht indexiert, rechtliche Pflichtangaben bleiben vor kommerziellem Launch offen.
- Keine anderen Projekte oder Branches verändert.

## QA

Vor Deployment, mobile Chromium-Viewport 320x700 mit synthetischen Instagram-Daten:
- **33 von 33 Browserchecks bestanden**: ZIP-Import, manuelle Opt-in-Speicherung, keine automatische Speicherung, Chart, lokale Rückkehrnotiz, Vergleich, Checkbox „gleiches Konto“, Einzel-/Gesamtlöschung, kompletter lokaler Löschknopf, kostenfreie Liste, bestehende Filter und Stripe-Sandbox.
- Physisches iPhone Safari noch nicht für diese **neue** Funktion geprüft.

## Nächster größter Hebel

Prüfung mit einem echten iPhone Safari auf einem Testgerät sowie explizite Validierung nach einem vollständigen Browser-Neustart. Optional danach Speicherformat für große Exporte via IndexedDB evaluieren, aber keinen Wechsel ohne belegbaren Nutzen.


## V3.1 Verbesserungsloop, 12.11.2026

- **Lokale Backup-Datei:** Vom Nutzer ausdrücklich per Button heruntergeladene `followclean-private-verlauf-YYYY-MM-DD.json`. Enthält vollständige lokale Follower- und Following-Namen aus den ausdrücklich gespeicherten Ständen **im Klartext**. Datei verbleibt im Browser-Downloadordner und wird nie zu Stripe, Cloudflare oder anderen Anbietern hochgeladen.
- **Wiederherstellen vor ZIP-Upload:** Einklappbarer Importbereich auf der Startseite; überprüft JSON-Kennzeichnung `followclean-private-history`, Version, erlaubte Struktur und Größenlimits. Kein Import fremder JSON-Strukturen als gültige Snapshots.
- **Schonendes Zusammenführen:** Bereits gespeicherte Stände bleiben bestehen. Identische Inhalte werden unabhängig von ihrer Reihenfolge übersprungen; maximal vier Stände. Bei Überschreitung Fehlermeldung **ohne Schreibvorgang oder Datenverlust**.
- **Schnelle Duplikatserkennung:** Browser-native `Set`-Mitgliedschaft statt quadratischer Listenabfragen. Wiederholtes Speichern identischer Exporte verbraucht keine neuen Verlaufsplätze.
- **Datenschutztext erweitert:** Private JSON-Sicherung enthält Benutzernamen unverschlüsselt und soll nicht öffentlich geteilt werden. Die Sicherung enthält keine ZIP-Binärdateien, kein Instagram-Passwort, keine Stripe-Daten und keine FollowClean-Serverkopie.
- **Bestehender Löschweg** bleibt unverändert: gespeicherte Snapshots können einzeln oder vollständig entfernt werden.

### Abnahme vor Veröffentlichung

- 30/30 synthetische Browserprüfungen: Zustimmung, Duplikatsperre, Sicherungs-Download (gültiger JSON-Aufbau), Verlust und Wiederherstellung, doppelter Import ohne zusätzliche Stände, beschädigte/ungeeignete JSON-Dateien, Vergleich nach Wiederherstellung, kostenlose Liste, Stripe-Sandbox, globales Löschen und mobiles Layout.
- 7/7 zusätzliche Kapazitätsprüfungen: Duplikat in anderer Exportreihenfolge, genau vier Stände, Verweigerung des fünften sowie atomare Ablehnung eines Backup-Imports, der das Limit überschreitet.
- Browser Rendering liefert bei programmatischem Neuladen der Seite einen Kontextzerstörungsfehler; **echte Safari-Neustartabnahme weiterhin offen**. Eine weitere Prüfung im echten Browser ist nötig. Dieser technische Grenzfall ist keine Aussage darüber, ob Safari-Speicherung funktioniert.
- Echtgeldzahlungen bleiben deaktiviert; Stripe-Testkauf samt RIO unverändert. Andere Projekte/Branches nicht berührt.
