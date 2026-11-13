# FollowClean V13 · Apify Provider Adapter · 13.11.2026

## Was umgesetzt ist
- Nutzername-zuerst-Vorschau mit optischer Ladeanimation und echter Anfrage **nur** an den eigenen Cloudflare Worker.
- API GET /api/analysis/provider/status: Apify-Adapterstatus, öffentlich abrufbar, aber keine Token/Sessiondetails.
- API POST /api/analysis/provider/plan: überprüft einen Instagram-Namen, sendet ihn **nicht** zu Apify; gibt kontrolliert "Anbindung vorbereitet, nicht aktiviert" zurück.
- API POST /api/analysis/quote und GET /api/analysis/policy bleiben für unverbindliche hypothetische Kostenberechnungen bestehen.
- API POST /api/analysis/start bleibt ausnahmslos deaktiviert (503), selbst wenn jemand künftige Zugangsdaten im Worker hinterlegt.
- Interner Actor-Adapter für lance_api~instagram-followers-following-scraper erstellt einen inaktiven, budgetbegrenzten Auftragsentwurf: one profile, BOTH, eindeutiges Limit beider Listen, maxTotalChargeUsd = 0,20, maxPaidDatasetItems und restartOnError=false.
- Offline-Ergebnisprüfung mit synthetischen Daten: verifizierte Zähler, vollständige Coverage pro Richtung, eindeutige stabile IDs, kein Mischprofil, kein Kandidat aus PARTIAL/INSTAGRAM_LIMITED.
- Kein neuer VPS, kein Apify-Key im Repository, keine externe kostenpflichtige Abfrage, kein Zugang zu privaten Listen, kein Browser-Bot.
- Vorhandene ZIP-Analyse, Fortschritt, Stripe-Sandbox-Test mit RIO und noindex unverändert.

## Preisberichtigung gegenüber V12
Wir verwenden nun **konkret LanceAPI Free** als technische Tarifannahme:
  $1,50 je 1.000 tatsächlich gelieferte Einträge plus $0,001 Actor-Start und $0,001 Profil.
  Beide Beziehungsrichtungen werden in EINEM Actor-Lauf verarbeitet.
  Formel = ((followers + following) / 1.000 × $1,50 + $0,002) × 1,20 + $0,01 Sicherheitsreserve.
  Aufrunden auf vier Nachkommastellen.
  Vorläufiges Betriebslimit: $0,20. Das kaufmännische Ziel bleibt maximal 0,25 EUR. Eine USD-/EUR-Absicherung fehlt.
  Beispiel bei 636 Followern und 476 Abonnierten: ungefähr $2,014 einschließlich Reserve, über unserem Limit. Nicht ausführbar.
  Bei 35+35 Einträgen: ca. $0,1385 einschließlich Reserve, lediglich möglicher Budget-Kandidat.

Die beworbenen $0,80 / 1.000 gehören bei diesem Actor zum Gold-Tarif, nicht zum Free-Tarif!
Quellen:
https://apify.com/lance_api/instagram-followers-following-scraper
https://docs.apify.com/api/v2/actor-run-sync-get-dataset-items-post

## Warum nach der Implementierung noch keine echten Instagram-Profile geprüft sind
Weder ein Apify-Zugangstoken noch von der Nutzerin/dem Nutzer kontrollierte, ausdrücklich freigegebene Testaccounts sind in dieser Unterhaltung oder Cloudflare nachgewiesen. Wir kaufen nichts blind, verwechseln teilweise lesbare Listen nicht mit vollständigen und scannen nicht ungefragt fremde Konten. Nicht einmal ein angeblicher Provider-Coverage-Status COMPLETE kann garantieren, dass Instagram wirklich alle öffentlich gezählten Nutzer zugänglich macht.

## Noch notwendige Freigabeschritte
1. Geeignete zulässige Datenzugriffsberechtigung/Meta-Erlaubnis und DSGVO-Verantwortlichkeiten nachweisen; Apify-Actor ist kein offizieller Instagram-Zugangsweg.
2. Nur eigene ausdrücklich bereitgestellte Testaccounts. Datenqualität gegen den eigenen Originalexport vergleichen.
3. Apify API Token ausschließlich als Cloudflare Worker-Secret, nicht in Repo/HTML/URL.
4. Vertrauenswürdige Account-Zähler vor dem BEZAHLTEN Lauf. Nur Name ist keine verifizierte Größenangabe.
5. Dauerhafter globaler Ausgabenzähler, synchronisierte idempotente Reservierungen, Benutzer-Authentisierung, Abuse- und Wiederholschutz; keine zahlungspflichtige Route ohne diese.
6. Tatsächliche Kontotarife, übergreifende Gebühren und FX-Reserve überprüfen. Providerseitiges maxTotalChargeUsd wirklich per Testkonto abnehmen.
7. Bezahl- und Public-Traffic-GO gesondert erteilen, erst nach nachgewiesener Einhaltung der Plattformregeln.

## Prüfungen
- 16/16 direkt ausgeführte synthetische Logik-/Sicherheitsprüfungen für V13 erfolgreich (Kosten, 1 Mio.-Fall, fehlendes Profil, untrusted counts, falsche User-ID, unvollständige Coverage, fehlende Freigabe).
- Wiederholbare Node-Skripte im Repository: tests/analysis-budget-smoke.mjs und tests/apify-adapter-smoke.mjs. Noch kein echter Instagram- oder Apify-End-to-End-Test.
- Ein Live-Cloudflare-Deployment bestätigt keine echte Instagram-Datenqualität. Ohne API-Key, berechtigte Konten und kontrollierte Provider-Abnahme bleiben die Bezahlrouten ausgeschaltet.

## Deployment evidence
- 2026-11-13T17:06:27Z: Cloudflare Worker followclean-mvp-preview accepted V13 bundled HTML + worker template.
- Deployment f0f4ed95-7d0d-4c1b-b48c-8c8d93942175, version fbc72835-934b-417a-99ca-24ec5bf86743, 100% as reported by Cloudflare deployments API.
- Existing binding FC_IG_SESSION_SECRET remains as secret_text; no Apify secrets and no other new paid service.
- Code-level synthetic V13 checks 16/16 PASS; this does not prove a paid Actor call or real Instagram result.
- Direct live HTTP fetch could not be verified from this tool environment due DNS/network restrictions. No false E2E PASS.
