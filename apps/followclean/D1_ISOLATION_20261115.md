# FollowClean | Eigene D1-Datenbank `followclean-db` | 15.11.2026

Status: **Datenbank erstellt, Daten übernommen, Pilot-Ledger angewendet und gegen echtes D1 getestet. Binding NICHT umgestellt.** Der Worker `followclean-mvp-preview` nutzt weiterhin die alte Datenbank.

## Datenbanken

| | Alt (geteilt) | Neu (nur FollowClean) |
|---|---|---|
| Name | `chatgpt-test-db` | `followclean-db` |
| ID | `24bce336-3a04-4517-bd12-c9e713068d58` | `28194058-2779-4b6d-ab81-b38459d5f6a8` |
| Region | WEUR | WEUR (Hinweis `weur`) |
| Erstellt | 25.08.2026 | 15.11.2026, 08:33 UTC |
| Genutzt von | Worker `chatgpt-test` (Binding `DB`) und FollowClean | noch von keinem Worker |

Kostenprüfung: Laut Cloudflare-Preisseite (Stand 30.10.2026) sind im Free-Tarif 10 Datenbanken enthalten, im Paid-Tarif 100.000. Das Konto hat jetzt drei. Die neue Datenbank verursacht keine Zusatzkosten.

## Inventar der FollowClean-Objekte in der alten Datenbank
- Tabelle `fc_apify_budget_reservations_v1`, Indizes `idx_fc_apify_budget_v1_day` und `_month`, Trigger `tr_fc_apify_budget_v1_day` und `_month`. 1 Zeile.
- Tabelle `fc_apify_token_diagnostics_v1`. 1 Zeile.
- Daneben 2 Tabellen und 2 Indizes anderer Projekte. Nicht gelesen, nicht verändert.
- Abhängigkeiten im Code: Der aktuelle Worker-Quelltext referenziert keine der V1-Tabellen, nur `fc_apify_v2_runs` (lesend im Dry-Run, über `FC_APIFY_BUDGET_DB`). Die V1-Tabellen wurden von früheren Diagnose- und Einzellauf-Versionen beschrieben.

## Übernahme
- Schema der beiden V1-Tabellen, Indizes und Trigger wörtlich aus `sqlite_master` der alten Datenbank übernommen.
- Beide Zeilen identisch kopiert: Reservierung `fc-single-actor-20261113` (0,05 USD, `settled`) und Diagnose `apify-20261113-once` (HTTP 403/404).
- Abgleich alt gegen neu: je 1 Budgetzeile mit 50.000 Mikro-USD, je 1 Diagnosezeile.
- Alte Datenbank danach geprüft: weiterhin 10 Objekte, 0 Objekte mit `fc_apify_v2`. Dort wurde ausschließlich gelesen.

## Pilot-Ledger in der neuen Datenbank
`sql/fc_apify_budget_v2_pilot.sql` vollständig angewendet: Tabelle `fc_apify_v2_runs`, 1 Index, 4 Trigger, Vorbelegung des Laufs vom 13.11.

Budgetstand im Scope `pilot-ysrrioo-v1`: 1 Zeile, 0,05 USD gebunden, **0,15 USD verbleibend, 3 Läufe möglich.**

## Tests gegen echtes D1 (in eigenen Test-Scopes, Pilotbudget unberührt)

| Test | Erwartet | Ergebnis |
|---|---|---|
| 7 gleichzeitig abgeschickte Reservierungen à 0,05 USD, Scope `selftest-par-20261115` | 4 angenommen, 3 abgelehnt | 4 angenommen, 3 × `followclean_v2_total_budget_exceeded` |
| 4 gleichzeitige Reservierungen mit demselben Schlüssel, Scope `selftest-dup-20261115` | genau 1 Zeile | 1 × `changes=1`, 3 × `changes=0` |
| `DELETE` | abgelehnt | `followclean_v2_ledger_append_only` |
| reserviert direkt auf abgerechnet | abgelehnt | `followclean_v2_invalid_transition` |
| Reserve ändern | abgelehnt | `followclean_v2_immutable_field` |
| Kosten der Altzeile senken | abgelehnt | `followclean_v2_cost_regression` |
| Zeile bereits abgerechnet einfügen | abgelehnt | `followclean_v2_insert_must_be_reservation` |
| gestartet mit Run-ID und Kosten, dann fehlgeschlagen | angenommen | angenommen |
| späte Rechnung 0,06 USD auf fehlgeschlagenen Lauf | angenommen, Zustand bleibt | angenommen, `failed`, 60.000 Mikro-USD gebunden |
| fehlgeschlagenen Lauf wieder öffnen | abgelehnt | `followclean_v2_terminal_state` |
| späte Rechnung senken | abgelehnt | `followclean_v2_cost_regression` |

Einschränkung: „gleichzeitig“ heißt hier parallel abgeschickte API-Aufrufe. D1 hat sie nacheinander verarbeitet. Ein Lasttest über das Worker-Binding steht aus.

Die 5 Testzeilen bleiben dauerhaft in der neuen Datenbank, weil das Ledger kein Löschen zulässt. Sie liegen in eigenen Scopes und zählen nicht zum Pilotbudget.

## Offen: Binding-Umstellung
Der verbundene Cloudflare-Connector kann Worker nur lesen. Er kann weder Bindings anzeigen noch ändern noch Versionen hochladen.

Ablauf für eine Instanz mit Deploy-Zugang:
1. Aktuelle Bindings und aktive Versions-ID des Workers lesen und notieren (Rollback-Punkt).
2. Neue Worker-Version anlegen, in der **nur** `FC_APIFY_BUDGET_DB` auf `28194058-2779-4b6d-ab81-b38459d5f6a8` zeigt. Alle anderen Bindings und Secrets unverändert.
3. Mit 0 % Traffic über die Versions-URL prüfen:
   - `POST /api/analysis/provider/export-check/plan` (ab V18) meldet `ledger.ok=true`, `committedUsd=0.05`, `remainingUsd=0.15`, `startableRuns=3`.
   - `POST /api/analysis/start` bleibt 503.
4. Erst danach Traffic umstellen.
5. Rollback: vorherige Version auf 100 %. Die alte Datenbank ist unverändert und bleibt als Rückfallpunkt bestehen.

Hinweis zur Reihenfolge: V17 (Commit `8eda8894`) liest das Ledger nicht. Der Binding-Wechsel wird erst mit V18 sichtbar. Phase A (V17 ohne Datenbankwechsel) und Phase B (Binding) bleiben damit sauber getrennt.

## Später, nach erfolgreicher Umstellung
Die beiden `fc_apify_*`-Tabellen in `chatgpt-test-db` können entfernt werden. Das ist ein Löschvorgang in einer von einem anderen Projekt genutzten Datenbank und braucht eine eigene Freigabe.
