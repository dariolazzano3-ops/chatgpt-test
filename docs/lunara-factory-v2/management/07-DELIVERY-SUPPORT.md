# Track 07 | Sichere Auslieferung, Kundenservice & Rückfragen
**Mission:** Nach Kauf zuverlässig liefern, Erfolg bestätigen und bei Problemen verständlich helfen.

## Ist-Zustand
- Private R2-PDF-Speicherung mit D1-Claim und einmaligem Upload synthetisch erfolgreich. Kein verifizierter echter E-Mail-Versand/Endnutzer-Download.
- R2-Testobjekte mit 30-Tage-Lifecycle; D1-Datensatz-Ablauf benötigt separate Umsetzung.
- Google-Mail/Docs sind **keine** gewünschte dauerhafte Produktionsabhängigkeit.

## Aufgaben
- [ ] Transaktionalen E-Mail-Anbieter auswählen (Reuse-First, Domain/DMARC/SPF/DKIM, Zustellbarkeit, EU-/Datenschutzprüfung). Kein neues Abo ohne Bewertung.
- [ ] Auslieferungsvertrag: Bestellung paid, QA pass, R2 stored, **entitled** Link, Frist, Downloadlimit, neutrale Betreffzeile.
- [ ] Tokenisiertes Abrufen, keine öffentlichen R2-URLs, Schutz gegen ID-Raten und Zugriff auf fremde Geschichten.
- [ ] Synthetische Zustellung an ausdrücklich freigegebenes Testpostfach; E-Mail-Inhalt, Link, Ablauf, PDF und Spamstatus prüfen.
- [ ] Replays: kein Doppelversand durch Event-Wiederholung; kontrollierter manueller erneuter Versand bei Support.
- [ ] Support-FAQ: fehlende Lieferung, Fehler in Namen, Download, Reklamation, Erstattung, Löschungsanfragen; keine KI-generierten unautorisierten Antworten an Kunden.
- [ ] Aufbewahrung/automatische Löschung in 10; keine personenbezogenen Daten in Logs.

**Definition of Done:** Testkäufer erhält auf erlaubtem Kanal genau einen sicheren, funktionierenden PDF-Zugang; nicht berechtigte Person erhält keinen Zugriff; Retention und Störfallbearbeitung dokumentiert.
**Abhängigkeiten:** 04, 05, 06, 10.
**Status:** BLOCKED.