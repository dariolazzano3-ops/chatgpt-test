# FollowClean | Apify Smart Scan V2 | 14.11.2026

## Auftrag
Nach Ablauf des ChatGPT Work-Kontingents die bestehende FollowClean-Integration im GitHub-Branch `factory/followclean-mvp-v1-20261109` über bestehendes Cloudflare fortsetzen. Testkonto `ysrrioo`, Gesamtgrenze 0,20 USD, keine neuen Abonnements, keine Instagram-Passwörter/Session-Cookies, niemals falsche bestätigte Nicht-Rückfolger.

## Verifizierte Actor-Schnittstellen
| Zweck | Actor ID | Input |
|---|---|---|
| Following-Liste | `LFWuGJErve4ycMo6l` | `{"usernames":["ysrrioo"],"listType":"following","maxPerProfile":20,"onlyNew":false}` |
| Follower-Einzelprüfung | `5DvofmvZ6Tzdo4b56` | `{"usernames":["candidate1",...],"account":"ysrrioo","addSummaryRow":true}` |

Dokumentation: https://apify.com/instagram-data-api/instagram-followers-scraper und https://apify.com/instagram-data-api/instagram-follower-checker/input-schema ; Output: https://apify.com/instagram-data-api/instagram-follower-checker/output-schema .

Ein Folgeaufruf mit `maxPerProfile=20` ist **kein** Cursor für `maxPerProfile=10`; die ersten zehn können wiederkommen. Bis echte Fortsetzung/pagination nachgewiesen ist, bleibt V2 auf maximal 20 initial gelieferte Kandidaten begrenzt. Work hatte beim Anbieter einen Free-Tarif-Cap von 20 Ergebnissen je Lauf beobachtet; aktiver Account-/Tarif-Cap ist vor Echtbetrieb zu verifizieren.

## Umsetzung
- Neue Funktionen im Worker-Template zwischen `FC_APIFY_SMARTSCAN_V2_START/END`: `fcV2Plan`, `fcV2ReadFollowing`, `fcV2MakeCheckerBatch`, `fcV2ReviewChecks`.
- Only `ysrrioo` als autorisiertes Pilotkonto; keine anderen Accounts testweise starten.
- Following-Datensatz wird auf Zielkonto, Listenrichtung, valide Instagram-Handles, Dubletten und Höchstmenge geprüft.
- Checker-Batches enthalten höchstens 10 Namen; nächste Batch beginnt bei Index 10 und ohne erfundene Cursor.
- Nur exaktes `follows: true` mit passender Kontozuordnung gilt als gegenseitig. `follows:false` ist **UNVERIFIED_NEGATIVE**, niemals bestätigter Treffer. Fehler, `null`, fehlende und widersprüchliche Werte sind **UNKNOWN**. Definitive Ergebnisse benötigen unabhängigen Nachweis (z. B. vollständigen autorisierten Instagram-Export).
- Bei unvollständiger Abfrage zeigt die Software keinerlei falsche Negativtreffer.
- Pro theoretischem Actor-Lauf `maxTotalChargeUsd: 0.05`, Gesamtrahmen `0.20`, **dauerhafte D1-Budgetreservierung ist Pflicht**, bevor eine echte Ausführung implementiert werden darf. Die einzelnen Runs allein garantieren keine globale Kostengrenze.
- Externes Ausführen weiterhin **DEAKTIVIERT** (`FC_PROVIDER_EXECUTION_ENABLED = false`, `/api/analysis/start` gibt HTTP 503).
- Live-Endpoint `POST /api/analysis/provider/v2/plan` nur same-origin und ausschließlich als kostenfreier DRY RUN. Keine Apify-Token-Ausgabe.
- Regressionstests: `apps/followclean/tests/apify-two-actor-smartscan-v2-smoke.mjs`. 17/17 synthetische Testfälle bestanden; keine kostenpflichtigen Tests.

## Cloudflare-Abnahme
- V16 Worker-Version `315389f2-6138-4ca2-84a3-14a43b442f5e`, Deployment `00264dca-b54d-4f21-be89-0dcc2bef5644`, 100 Prozent Traffic.
- Bindings vollständig erhalten: `FC_APIFY_TOKEN`, `FC_IG_SESSION_SECRET` als Geheimnisse und `FC_APIFY_BUDGET_DB` D1. Werte nicht ausgelesen.
- Öffentlicher POST-Plan-Endpunkt Browser-Test: HTTP 200, `mode=DRY_RUN_ONLY`, `executionEnabled=false`, beide richtigen Actor-IDs, `globalReservationRequired=true`.
- Website per Cloudflare Browser Rendering geprüft: ZIP-Analyse, Smart Scan V1, Stripe Sandbox, noindex unverändert.
- Kein neuer Actor-Lauf, keine kostenpflichtige Instagram-Abfrage durch diese Arbeit.

## Berechtigungscheck des eingeschränkten Tokens
Ein temporärer, unerratbarer und nur lesender Worker-Diagnosepfad nutzte den vorhandenen `FC_APIFY_TOKEN` **nur serverseitig**, ohne Secret-Weitergabe und ohne POST an Apify:
- `GET /v2/acts/LFWuGJErve4ycMo6l/runs?limit=1` → **HTTP 404**
- `GET /v2/acts/5DvofmvZ6Tzdo4b56/runs?limit=1` → **HTTP 404**

Beide Actor-IDs sind öffentlich nachgewiesen. Die Antwort 404 beweist noch nicht allein die konkrete Fehlerursache, ist aber **kein erfolgreicher Token-Lesezugriff**. Die beiden Rechte sind für den hinterlegten eingeschränkten Token noch nicht nachgewiesen. Work-Session-Browserautorisierung ist nicht dasselbe wie dieser Token.

Die temporäre Prüfversion `6c3a49b6-fb80-47b0-9941-9f02ccd59aad` wurde nach der Prüfung auf 0 Prozent Live-Traffic zurückgesetzt; Cloudflare bestätigt, dass V16 `315389f2-6138-4ca2-84a3-14a43b442f5e` wieder 100 Prozent Traffic hat. Die Prüfversion bleibt nur als nicht deployte Worker-Historie gespeichert und wurde nicht gelöscht. Die öffentliche Prüfroute ist nicht mehr aktiv.

## Echte nächste Schritte
1. In Apify Console (eigene Anmeldung) bestehenden **eingeschränkten** Token für beide Actor-IDs mit `Read/List Runs`, `Run` und für Ergebnisabruf passende Datasets-Scope aktualisieren; alte Rechte behalten, keine kontoweite Freigabe. Token nicht im Chat posten.
2. Lesende Berechtigungsprüfung erneut; dann bereits existierende Work-Lauf-ID (falls vorhanden) auslesen, um doppelte Kosten zu vermeiden.
3. Sichtbare Accounts und `follows`-Antworten auf Widersprüche prüfen; negative Treffer unabhängig validieren.
4. Erst danach mit dauerhaftem D1-Gesamtbudget eine _einzelne_ auf `ysrrioo` begrenzte kostenpflichtige Ausführung aktivieren. Dokumentierte Freigabe ist keine Erlaubnis, ungebremst weitere Läufe zu starten.
