# FollowClean | Voraussetzungen für den Livebetrieb von Smart Scan V2 | 15.11.2026

Kein Punkt dieser Liste ist erfüllt, solange er nicht ausdrücklich als nachgewiesen markiert ist.

## 1. Was D1 leistet und was nicht
- D1 entscheidet, ob ein **neuer** Lauf gestartet werden darf. Die Gesamtgrenze von 0,20 USD gilt für Reservierungen.
- D1 kann Kosten, die beim Anbieter bereits entstanden sind, **nicht** verhindern oder zurückholen. Meldet Apify mehr als die Reserve, wird der Betrag wahrheitsgemäß verbucht, `overBudget` wird gesetzt und jeder weitere Lauf abgelehnt.
- Die harte Kostengrenze je Lauf muss deshalb beim Anbieter liegen.

## 2. Providerseitige Kostenobergrenze (nicht verifiziert)
Laut Apify-API-Dokumentation begrenzt `maxTotalChargeUsd` die Gesamtkosten eines Laufs und wird als **Query-Parameter** des Run-Aufrufs übergeben. Offen und vor dem ersten Lauf zu prüfen:
- [ ] Akzeptieren beide Actors 0,05 USD? Das Run-Objekt kennt `minimalMaxTotalChargeUsd`; es gibt Actors mit Mindestwert 0,50 USD. Liegt der Mindestwert über 0,05 USD, passt der Lauf nicht in das Testbudget und darf nicht starten.
- [ ] Preismodell beider Actors: reines Pay-per-Event oder „Pay per event + usage“? Im zweiten Fall kommen Plattformkosten hinzu.
- [ ] Wird der Wert im Run-Objekt des gestarteten Laufs tatsächlich zurückgemeldet? Vor dem Abruf der Ergebnisse prüfen, sonst Lauf abbrechen.
- [ ] Monatliches Ausgabenlimit im Apify-Konto als zweite Sicherung setzen (nur in der Console möglich).
- [ ] `restartOnError=false`, feste `timeout`, keine automatischen Wiederholungen.

## 3. Token und Zugriffe (nicht verifiziert, letzter Stand HTTP 404)
- [ ] Token „Followclean“: Lesen und Ausführen für `LFWuGJErve4ycMo6l` und `5DvofmvZ6Tzdo4b56`.
- [ ] Schalter für Default-Run-Storages aktiv, sonst sind Ergebnisse nicht lesbar (früher HTTP 403).
- [ ] Verbrauch lässt sich mit einem eingeschränkten Token nicht über den Limits-Endpunkt abfragen. Verbrauch je Lauf aus dem Run-Objekt lesen.

## 4. Datenschemas (nicht verifiziert)
Die Felder im Code stammen aus der Projektdoku vom 14.11., nicht aus einer eigenen Prüfung. Die Actor-Seiten waren aus der Entwicklungsumgebung nicht abrufbar.
- Following: Input `usernames`, `listType`, `maxPerProfile`, `onlyNew`; erwartete Zeilen `sourceUsername`, `listType`, `username`.
- Checker: Input `account`, `usernames`, `addSummaryRow`; erwartete Zeilen `account`, `username`, `follows`.
- [ ] Erste echte Antwort gegen diese Felder prüfen. Der Code verwirft abweichende Zeilen und liefert dann `UNKNOWN`, nie einen Treffer.
- [ ] Enthält die Antwort Bild-URLs? Wenn ja: Ablaufzeit, Herkunftsdomain und Rechtsgrundlage klären, bevor irgendein Bild angezeigt wird.
- [ ] Echte Paginierung nachweisen. Ohne Nachweis bleibt die Stichprobe bei 20.

## 5. D1
- [ ] Migration `sql/fc_apify_budget_v2_pilot.sql` anwenden (gesonderte Freigabe).
- [ ] Parallelitätstest gegen echtes D1. Bisher nur SQLite mit getrennten Prozessen. Die Garantie beruht darauf, dass die Prüfung im Trigger desselben INSERT läuft.
- [ ] Worker-Code an das Ledger anbinden: reservieren, Lauf starten, `submitted` mit Run-ID, Kosten nachführen, `settled` oder `failed`.

## 6. Recht und Plattform
- [ ] Zulässigkeit automatisierter Abrufe nach den Nutzungsbedingungen von Instagram/Meta und Apify.
- [ ] DSGVO: Rechtsgrundlage für Daten Dritter (Follower-Namen), Auftragsverarbeitung, Speicherfristen.
- [ ] Nur das autorisierte Pilotkonto, bis diese Punkte geklärt sind.

## Quellen
- https://docs.apify.com/api/v2/actors-runs-post.md
- https://docs.apify.com/actors/publishing/monetize/pay-per-event.md
- https://docs.apify.com/platform/integrations/api
