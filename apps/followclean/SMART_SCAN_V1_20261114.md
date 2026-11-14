# FollowClean Smart Scan V1 | 10er-Suche (14.11.2026)

## Fertig umgesetzt
- Im Ergebnis-Bereich der bestehenden Website: mobile-first Smart-Scan-Karte, animierter Fortschritt, Profil-Link, Stoppen und „Weiteren Treffer suchen“.
- Nach einem vollständigen lokalen Instagram-Export erzeugt `fcCreateSmartScan` einen in-memory Follower-Index und eine Following-Reihenfolge.
- `fcScanNextTen` prüft **maximal zehn** gefolgte Accounts je Gruppe und hält **sofort beim ersten offenen Nicht-Rückfolger laut Export** an; sofern keiner vorhanden ist, folgt automatisch die nächste 10er-Gruppe. Bei erneuter Suche wird ohne Dopplung nach dem letzten Treffer fortgesetzt.
- Bereits auf „Erledigt“ oder „Behalten“ gesetzte Accounts werden beim nächsten Treffer übersprungen. Ergebnisse im Demo-Modus sind ausdrücklich Beispiele.
- Es werden keine ZIP-Daten an Server, Apify oder andere Dienste gesendet. Die Suche findet ausschließlich im Browser statt, mit 0 $ API-Kosten.
- Bei fehlendem oder uneindeutigem Follower-Snapshot wird die Suche abgewiesen. Es gibt keine negativen Aussagen aus unvollständigen 10/10-API-Samples, wie dem bisherigen `ysrrioo`-Pilotdatensatz.
- Bestehende ZIP-Analyse, Smart Cleanup, Profilbesuchs-Markierung, Dashboard, Stripe Sandbox, noindex und Cloudflare-Bindings bleiben bestehen.
- Der kostenpflichtige Actor-Start bleibt im Backend hart deaktiviert (`FC_PROVIDER_EXECUTION_ENABLED=false` und `POST /api/analysis/start` mit 503).

## Prüfungen
- 11/11 synthetische Logikprüfungen bestanden: echte erste 10 ohne Treffer, Treffer an Stelle 11, sofortiger Stopp, Fortsetzen, Überspringen bereits bearbeiteter, fehlende Follower-Liste, Dubletten, ungültige Handles und vollständige gegenseitige Beziehungen.
- Wiederholbarer Test: `node apps/followclean/tests/smart-scan-v1-smoke.mjs`.
- HTML-Modul- und Worker-JavaScript-Syntax unabhängig geprüft.

## Wichtige Grenze zur gewünschten ZIP-freien Version
**Derzeit ist die Suche für lokale Exportdaten umgesetzt, nicht für einen automatischen Apify-Lauf ohne ZIP.** Eine robuste API-Suche benötigt entweder:
1. Eine nachweislich vollständige Followerliste, die wir **einmal** ermitteln, plus paginierte/inkrementell prüfbare Following-Einträge in Batches von zehn mit zuverlässigem Cursor, oder
2. Eine autorisierte, zuverlässige Einzelabfrage „folgt Nutzer A dem Nutzer B?“ für jeden Kandidaten.

Es reicht NICHT, zehn Follower und zehn Following-Accounts gegeneinanderzustellen. Aus einer partiellen Followerliste resultieren falsche Nicht-Rückfolger.

Der etablierte LanceAPI-Actor hat auf Free-Tarif 100 je Beziehung und keine öffentlich abrufbaren internen Cursor; ein neues `resultsLimit:10` wiederholt die ersten zehn statt die nächsten zehn. Der günstige Dami-Studio-Actor verlangt für Following ein Instagram-Session-Cookie. Wir verwenden weder automatisiertes Instagram-Cookie-Sammeln noch einen unbelegten Datenvollständigkeitsstatus als Freigabe. Kommerzielle/DSGVO-Plattform-Abnahme ausstehend.

## Quellen
- https://apify.com/lance_api/instagram-followers-following-scraper
- https://apify.com/dami_studio/instagram-followers-following-scraper

## Abnahme
- Der Smart-Scan ist nur dann ein bestätigter Treffer **laut lokalem Export**, nicht ein Beweis für den aktuellen Instagram-Status. Dies wird in der UI kenntlich gemacht.
- Das Nutzerziel eines vollständigen ZIP-freien On-Demand-Scans bleibt ein nachfolgender Integrationsschritt, sobald verlässliche Providerabdeckung und Budgetkontrolle nachgewiesen sind.

## Cloudflare Veröffentlichung
- Veröffentlichung auf dem bestehenden Worker `followclean-mvp-preview` am 14.11.2026.
- Deployment `3580419c-f7f7-4cb1-839f-396166622e96`, Worker Version `62a5d204-582c-448f-9c09-9d03939aed45`, 100 % Traffic (über Cloudflare Deployments-API verifiziert).
- Geheimnisse `FC_APIFY_TOKEN`, `FC_IG_SESSION_SECRET` und D1 `FC_APIFY_BUDGET_DB` durch versionsgebundenes `inherit` erhalten, Werte wurden nicht ausgelesen.
- API-Scans bleiben gesperrt. Nur lokaler 10er-Abgleich ist freigeschaltet.
