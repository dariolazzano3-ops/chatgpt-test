# FollowClean | Smart Scan V2: Budget-Ledger und 10er-Orchestrierung | 14.11.2026

Status: **implementiert und synthetisch getestet. Nicht deployt, Migration nicht angewendet, nicht live getestet, nicht produktionsreif.** Echte Ausführung bleibt deaktiviert.

## Befund vor der Änderung
- Die bestehende D1-Tabelle `fc_apify_budget_reservations_v1` begrenzt nur 1 USD/Tag und 5 USD/Monat. Die Gesamtgrenze von 0,20 USD für den Testauftrag war in D1 **nicht** durchgesetzt.
- `UNIQUE(owner, profile, day)` erlaubt nur eine Reservierung pro Profil und Tag. V2 braucht bis zu drei Läufe (1 Following, 2 Checker).
- V2 hatte keine Idempotenz je Lauf und keine Ablaufsteuerung zwischen den 10er-Gruppen.

## Umsetzung
- `sql/fc_apify_budget_v2_pilot.sql`: Tabelle `fc_apify_v2_runs`, Trigger für atomare Gesamtgrenze 0,20 USD je Scope, unveränderliche Felder, nur vorwärts laufende Zustände, kein Löschen. Der LanceAPI-Lauf vom 13.11. ist mit der reservierten Summe 0,05 USD vorbelegt (gemeldet 0,032 USD).
- Worker-Template, Block `FC_APIFY_V2_LEDGER_START/END`:
  - `fcV2RunKey`: SHA-256-Idempotenzschlüssel, unabhängig von der Reihenfolge der Kandidaten.
  - `fcV2Reserve`: ein INSERT, Trigger entscheidet. Duplikat, Budget erschöpft, fehlende Tabelle oder fehlende DB ergeben immer `mayStart:false`.
  - `fcV2Advance`, `fcV2BudgetStatus`: Jede Zeile zählt mit `MAX(Reserve, tatsächliche Kosten)`. Fehlgeschlagene Läufe geben kein Budget frei und werden nicht wiederholt.
  - `fcV2Classify`: `CONFIRMED_NONFOLLOWER` nur bei negativer Checker-Antwort **und** vollständiger, autorisierter Followerliste ohne den Account. Widersprüche in beide Richtungen ergeben `UNKNOWN`.
  - `fcV2NextStep`: erste zehn prüfen, bei bestätigtem Treffer stoppen (mit Profil-Link), Fortsetzen nach gezeigtem Treffer, bereits geprüfte Accounts nie erneut senden, Ende nach der gelieferten Stichprobe (max. 20).
- Der Block enthält keinen Netzwerkaufruf. `FC_PROVIDER_EXECUTION_ENABLED=false` und HTTP 503 auf `/api/analysis/start` sind unverändert.

## Budgetrechnung
0,20 gesamt − 0,05 (Altlauf, konservativ) = 0,15 USD = genau drei Läufe à 0,05 USD Obergrenze: 1 Following-Lauf und 2 Checker-Gruppen für 20 Kandidaten. Kein Spielraum für Wiederholungen.

## Tests
`node apps/followclean/tests/apify-v2-ledger-orchestration-smoke.mjs` (Node ≥ 22.5): 18/18. Die echte Migration läuft gegen SQLite im Speicher hinter einer D1-förmigen Hülle. Der Paralleltest läuft dort seriell; die Garantie stammt aus dem Trigger im einzelnen INSERT. Gegen echtes D1 nicht getestet.

## Offen
1. Apify-Token: Rechte für beide Actors weiterhin unbestätigt (letzter Stand HTTP 404). Aus dieser Sitzung nicht prüfbar, da weder Cloudflare- noch Apify-Zugang vorhanden ist.
2. Migration auf D1 anwenden und Worker deployen.
3. Preise und Schemas der beiden Actors gegen aktuelle Anbieterseiten prüfen.
4. Rechtliche und plattformvertragliche Prüfung vor jeder produktiven Datenerhebung.
