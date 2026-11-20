# FollowClean

Web-App, die aus dem eigenen Instagram-Export zeigt, wer nicht zurückfolgt. Ohne Instagram-Passwort, ohne automatisches Entfolgen.

Stand: 15.11.2026 · Branch `factory/followclean-mvp-v1-20261109` · Beta, `noindex`, keine echten Zahlungen, kein Live-Scan.

## Was heute funktioniert

| Bereich | Status |
|---|---|
| Lokale ZIP-/JSON-Analyse im Browser (JSZip lokal eingebunden) | live in der Preview |
| Smart Scan V1: 10er-Suche auf dem lokalen Export | live in der Preview |
| Filter, Verlauf, CSV, Smart Cleanup, Fortschritt im lokalen Speicher | live in der Preview |
| Profilbesuch leuchtet automatisch grün (ohne Rückfrage), „Erledigt“ bleibt separat manuell | V17.1 implementiert, Preview-Version 67 hochgeladen, noch nicht auf Live-Traffic |
| Erklärung „Warum kein Live-Ergebnis“ mit vier Ergebnisstufen | implementiert, in Chrome getestet, nicht deployt |
| Stripe-Sandbox-Link (1,00 EUR, Code RIO) | Sandbox, kein Entitlement |
| Instagram-Login für Profilzahlen (Business/Creator) | Code vorhanden, ohne Meta-App-Secrets inaktiv |
| Apify Smart Scan V2: Plan, Ledger, 10er-Orchestrierung | implementiert, synthetisch getestet, Ausführung gesperrt |
| Export + optionaler Checker V1 (Aktualitätshinweis für Export-Treffer) | Dry-Run, synthetisch getestet, keine Oberfläche, Ausführung gesperrt |
| Landing V21: Hero nach Brief, Funktionsvorschau (animiertes Beispiel-Dashboard), So funktioniert’s, Zwei Wege, Sicherheit, Preise, FAQ, Schluss-CTA, Motion-System mit reduced motion | V21-Kandidat, in Chrome getestet, nicht deployt |

## Aufbau

- `index.html`: gesamte Oberfläche (CSS, Markup, ES-Modul). Analyse der Exportdatei nur im Browser.
- `worker.instagram-template.mjs`: Cloudflare Worker. Liefert die Seite aus und stellt `/api/instagram/*` sowie `/api/analysis/*` bereit.
- `build-instagram-worker.mjs`: bettet `index.html` in den Worker ein, Ausgabe `dist/worker.mjs` (nicht eingecheckt).
- `sql/`: D1-Migrationen. Beide sind in der eigenen Datenbank `followclean-db` angewendet. Der Worker ist noch an die alte, geteilte Datenbank gebunden; siehe `D1_ISOLATION_20261115.md`.
- `tests/`: Regressionstests, alle ohne Kosten und ohne Instagram-Zugriff.

Worker `followclean-mvp-preview`, D1-Binding `FC_APIFY_BUDGET_DB`, Secrets `FC_APIFY_TOKEN` und `FC_IG_SESSION_SECRET`.

## Server-Endpunkte

| Endpunkt | Verhalten |
|---|---|
| `GET /api/analysis/policy`, `GET /api/analysis/provider/status` | nur Statusangaben |
| `POST /api/analysis/quote`, `/provider/plan`, `/provider/v2/plan`, `/provider/export-check/plan` | same-origin, reine Trockenläufe, kein Apify-Aufruf |
| `POST /api/analysis/start` | immer HTTP 503, bezahlte Ausführung gesperrt |
| `/api/instagram/*` | offizieller Instagram-Login, nur mit konfigurierten Secrets |

Der Worker enthält keinen Netzwerkaufruf zu Apify.

## Lokal starten und testen

```bash
cd apps/followclean && python3 -m http.server 4173   # http://localhost:4173

for t in analysis-budget-smoke apify-adapter-smoke apify-two-actor-smartscan-v2-smoke \
  instagram-live-worker-smoke smart-scan-v1-smoke apify-v2-ledger-orchestration-smoke \
  apify-v2-ledger-hardening-smoke export-checker-v1-smoke chrome-ux-smoke landing-v21-smoke release-verify; do node apps/followclean/tests/$t.mjs; done
```

- Node ≥ 22.5 (für `node:sqlite`). `chrome-ux-smoke` braucht Chrome oder Chromium.
- `webkit-smoke.mjs` braucht Playwright mit WebKit und ist der einzige Test mit Safari-Engine.

## Zwei Stufen, klar getrennt

- **Vollständige Exportanalyse:** kostenlos, lokal, zuverlässig für den Stand des Exports.
- **Optionale Aktualitätsprüfung (in Vorbereitung):** zusätzlicher Hinweis für einzelne Export-Treffer, soweit technisch zulässig und verlässlich.

Einen vollständig aktuellen Scan nur per Benutzername verspricht FollowClean nicht.

## Ergebnisstufen

- **Bestätigt**: negative Anbieterantwort und vollständige, autorisierte Followerliste ohne den Account.
- **Gegenseitig**: positiv bestätigte Gegenfolge.
- **Unbestätigt**: nur eine Quelle meldet „folgt nicht“.
- **Unklar**: fehlende, unvollständige oder widersprüchliche Daten.

Eine unvollständige Followerliste beweist nie einen Nicht-Rückfolger.

## Grenzen

- Der Export ist eine Momentaufnahme, kein Live-Stand.
- „Erledigt“ ist eine Markierung des Nutzers. FollowClean kann nicht sehen, ob in Instagram entfolgt wurde.
- Es werden keine Original-Profilbilder geladen, nur lokale Initialen-Avatare.
- Voraussetzungen für den Livebetrieb: `LIVE_PREREQUISITES_20261115.md`.
- Vor kommerziellem Start: `PREMIUM_RELEASE_GATES_V1_20261112.md`.
