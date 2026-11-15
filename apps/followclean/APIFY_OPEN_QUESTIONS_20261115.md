# FollowClean | Apify: offene Console-Angaben und Alternativen zur 20er-Stichprobe | 15.11.2026

## Ergebnis der kostenlosen Leseprüfung
Nicht möglich. Aus der Entwicklungsumgebung sind weder `api.apify.com` noch die Store-Seiten der beiden Actors erreichbar, und die Websuche findet die Seiten `instagram-data-api/instagram-followers-scraper` und `instagram-data-api/instagram-follower-checker` nicht. Preise, Mindestgrenzen und Schemas beider Actors sind damit **unverifiziert**.

## Benötigte Angaben aus der Apify Console
Je Actor (`LFWuGJErve4ycMo6l` Following, `5DvofmvZ6Tzdo4b56` Checker), abzulesen ohne Lauf:

| Nr. | Wo | Was genau |
|---|---|---|
| 1 | Actor → Pricing | Preismodell (Pay per event, Pay per result, Rental) und jede Preiszeile mit Ereignisname und Preis |
| 2 | Actor → Pricing | Steht dort „+ usage“ bzw. „Pay per event + usage“? |
| 3 | Actor → Input → Run options | Kleinster akzeptierter Wert bei „Maximum cost per run“. 0,05 eintragen und prüfen, ob eine Fehlermeldung zum Mindestwert erscheint (nicht starten) |
| 4 | Actor → Input → JSON | Vollständiges Input-JSON mit Standardwerten |
| 5 | Actor → Information/README | Beispiel-Output einer Zeile, inklusive Summary- und Fehlerzeilen, sowie ein eventuelles Bild-URL-Feld |
| 6 | Actor → README | Aussage zu Limits im kostenlosen Tarif (die 20 Ergebnisse) und zu Paginierung oder Fortsetzung |
| 7 | Settings → API & Integrations → Token „Followclean“ | Liste der Ressourcen und Rechte, Zustand des Schalters für Default-Run-Storages |
| 8 | Settings → Billing → Limits | Aktuelles monatliches Ausgabenlimit und bisheriger Verbrauch im Abrechnungszeitraum |
| 9 | Runs | Für Lauf `3qcGw5hkmwWfO1Ua5`: endgültige Kosten (Abgleich mit den verbuchten 0,032 USD) |

Screenshots oder kopierter Text genügen. Token nicht mitschicken.

## Alternativen zur 20er-Stichprobe

| Option | Vollständig? | Kosten | Bewertung |
|---|---|---|---|
| **A. Export als Kandidatenquelle, Checker nur für ausgewählte Accounts** | Ja, die Following-Liste kommt vollständig aus der ZIP | nur Checker-Läufe, 10 Accounts je Lauf | **Empfohlen.** Nutzt beide bestehenden Bausteine. Der Following-Actor mit seinem 20er-Limit entfällt. Der Checker wird zur optionalen Aktualitätsprüfung für Treffer aus dem Export |
| B. Nur Export (heutiger Stand) | Ja | 0 | Liefert bereits jetzt das vollständige, belegte Ergebnis. Nachteil: Wartezeit auf den Export |
| C. Bezahlter Tarif des Following-Actors | unbekannt, siehe Nr. 6 | neues Abo | Ausgeschlossen: keine neuen Abonnements |
| D. Anderer Listen-Actor mit Paginierung | laut Anbieterangaben teils ja | etwa 0,30 bis 0,50 USD je 1.000 Profile laut Store | Ersetzt eine bestehende Integration, deshalb nicht umgesetzt. Mehrere Anbieter verlangen den Session-Cookie des Nutzers, was die Projektregeln ausschließen |
| E. Follower-Liste abrufen und selbst vergleichen | nein | hoch | Ungeeignet. Ein Anbieter dokumentiert, dass Instagram bei verifizierten Konten nur etwa 50 Follower ausliefert. Unvollständige Listen beweisen nichts |

### Folgerung
Der Kernnutzen hängt nicht an Apify. Mit Option A wird der Live-Teil zu einer kleinen Zusatzfunktion: „Treffer aus deinem Export jetzt aktuell prüfen“. Das Ergebnismodell passt bereits: negative Checker-Antwort plus vollständige Exportliste ergibt `CONFIRMED_NONFOLLOWER`; meldet der Checker inzwischen eine Gegenfolge, entsteht ein Widerspruch und der Account wird `UNKNOWN` statt fälschlich als Treffer gezeigt. `fcV2NextStep` und das Ledger können dafür unverändert genutzt werden; nur die Kandidatenquelle wechselt.

Budgetwirkung im Pilot: 0,15 USD reichen für drei Checker-Läufe, also 30 Accounts, statt 20 mit vorgeschaltetem Following-Lauf.
