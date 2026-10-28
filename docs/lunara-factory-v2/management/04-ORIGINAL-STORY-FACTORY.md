# Track 04 | Originale Lunara-Geschichtenproduktion
**Mission:** Originalqualität reproduzierbar, sicher und möglichst kosteneffizient erzeugen.

**Nicht verändern:** Die originale 90-Modul-Factory 5464576 bleibt unberührte Referenz. Keine generischen neuen Prompts anstelle der Originalversion.

## Verifizierter Stand
- V2 29-Modul-Sandbox 8209196 hat reale synthetische Geschichte → QA → PDF → R2 erfolgreich getestet, ist inaktiv.
- Die fünf Kernstufen 291/82/83/84/179 haben **exakt dieselben Prompts** und Modelle wie die Originalversion: Dreamworld, Rohgeschichte, Endredaktion, Premium-Feinschliff, erste QA.
- In V2 fehlt der Original-Fail→Reparatur (187)→zweite QA (192/193)-Pfad. Alte 90-Modul-Factory hat zwei nicht angeschlossene Modulwarnungen, kein automatischer Totalausfallnachweis.
- Ein neuer Make→Cloudflare-Transfer wurde zuvor durch Sicherheitsprüfung blockiert; nicht umgehen.

## Aufgaben
- [ ] Original-Qualitätsvertrag inhaltlich unverändert dokumentieren; positives und negatives Testsample.
- [ ] Den Fail→Reparatur→QA2-Pfad in einer autorisierten Sandbox integrieren, inklusive maximaler kontrollierter Aufrufzahl.
- [ ] Fail-closed: schlechte QA führt weder zu PDF, E-Mail noch automatischer Abrechnung doppelter KI-Aufrufe.
- [ ] D1-Claim **vor** kostenpflichtigem Modellaufruf, Duplikat → 409; Kostenbudget je Auftrag.
- [ ] Finalen Story-Output strukturiert ausgeben (Titel, Fließtext, Abschluss, Alter, Qualitätsstatus) als `lunara.story.qa.v1`.
- [ ] Autorisierte einmalige Übergabe an 05/07; keine direkten, offen zugänglichen Story-Webhooks.
- [ ] QA-Messung: Kindname und Plüschtier konsistent, beruhigender Schluss, altersgerechter Ton, keine Wiederholungen, keine erfundenen Details.

**Definition of Done:** Einen positiven synthetischen Auftrag und einen erzwungenen QA-Fehler einschließlich Reparatur und QA2 bestanden. Pro Order maximal eine Produktion, keine manuelle Textkopie, reale Make-Logs und Kosten nachgewiesen.
**Abhängigkeiten:** 06 Paid-Claim, 05 PDF, 07 Storage; 10 Datenschutz.
**Status:** PARTIAL / BLOCKED on transfer.