# Ziegenalarm Online – Testplan für echte Geräte

Ziel: Zwei echte Spieler spielen über dieselbe öffentliche Seite in einer Kuchenkrieg-Lobby.
Alle Punkte hier sind **noch nicht ausgeführt**. Bitte nach dem Deploy abarbeiten und die Spalte „Ergebnis“ ausfüllen.

**Was schon geprüft ist (Stand V7)**

| Kategorie | Status |
|---|---|
| A. Lokale Tests (Node-Server, Browser mit three.js-Attrappe) | ausgeführt, bestanden |
| B. Browser- und 3D-Tests mit echtem three.js r128 (Software-WebGL, Chromium) | ausgeführt, bestanden |
| C. Echte Cloudflare-Infrastruktur | **offen** (nur Emulation) – Abschnitt 0 unten |
| D. Echte Geräte über das Internet | **offen** – Abschnitte 1 und 2 unten |

**Vorbereitung**

- Adresse: `https://ziegenalarm-online.<name>.workers.dev` (nach dem Deploy-Knopf im README oder `npm run deploy`)
- Zweites Fenster am Rechner: `npx wrangler tail` zeigt Fehler live
- Geräte notieren (Modell, Betriebssystem, Browser):
  - Handy A:
  - Handy B:
  - Handy C / D (für 2 gegen 2):
- Mindestens ein Handy im **Mobilfunknetz**, nicht im selben WLAN (echte Internetstrecke)

## 0. Grundlage

| # | Schritt | Erwartung | Ergebnis |
|---|---|---|---|
| 0.1 | Seite auf Handy A öffnen | Menü in unter 3 s, keine Fehlermeldung | |
| 0.2 | Einzelspieler starten | 3D-Szene: Kuchen, Wiese, Ziegen mit Gesicht, Waffe, Fadenkreuz | |
| 0.3 | Handy quer drehen | Steuerung passt sich an, nichts abgeschnitten | |
| 0.4 | `/api/room/AAAAA` im Browser | `{"exists":false}` | |
| 0.5 | `/vendor/three.min.js` im Browser | Datei lädt (ca. 600 KB) | |
| 0.6 | iPhone Safari: Seite öffnen, hochkant ins Spiel | „Drehe dein Handy ins Querformat“ | |
| 0.7 | Am Rechner: `URL=https://…workers.dev npm run check:3d` | alle PASS, Bilder in tools/render-out ansehen | |

## 1. Eins gegen eins (2 Handys)

| # | Schritt | Erwartung | Ergebnis |
|---|---|---|---|
| 1.1 | A: Kuchenkrieg → Name → 1 gegen 1 → Raum erstellen | 5-stelliger Code erscheint | |
| 1.2 | A: „Kopieren“, Code per Messenger an B | Code im Messenger | |
| 1.3 | B: Seite öffnen → Kuchenkrieg → Code eingeben → Beitreten | Beide sehen beide Namen, getrennte Teams | |
| 1.4 | B: falschen Code eingeben (z. B. `ZZZZZ`) | „Diesen Raum gibt es nicht (mehr)…“ | |
| 1.5 | Beide „Bereit“ | Countdown 3 s, Start gleichzeitig | |
| 1.6 | Beide quer, Joystick links, Umsehen rechts | flüssig, kein Seitenscrollen | |
| 1.7 | Beide gleichzeitig laufen und schießen | Treffer zählen, Ziegen sterben, Münzen steigen | |
| 1.8 | Statusleiste oben | grüner Punkt, Ping in ms (WLAN < 100, Mobilfunk < 200), Gegner-Kuchenbalken bewegt sich | |
| 1.9 | Welle zu Ende | Ziegenmarkt öffnet bei beiden, Countdown läuft | |
| 1.10 | A kauft Mauer, B kauft Schrotflinte | Kauf sofort sichtbar, Münzen abgezogen | |
| 1.11 | Beide „Bereit“ im Markt | Welle 2 startet bei beiden | |
| 1.12 | B: Flugmodus 5 s an, dann aus | „Verbindung verloren…“, danach „Wieder verbunden“, Spiel läuft weiter | |
| 1.13 | B: Seite neu laden mitten im Spiel | B landet wieder im selben Spiel | |
| 1.14 | B: App wechseln 10 s, zurück | Spiel läuft weiter, Eingaben nicht hängengeblieben | |
| 1.15 | Bis ein Kuchen fällt spielen | Ergebnisbildschirm bei beiden, gleicher Sieger | |
| 1.16 | Beide „Revanche“ | Neues Spiel startet | |
| 1.17 | „Zurück zur Lobby“ | Beide in der Lobby, Bereit zurückgesetzt | |
| 1.18 | Drittes Gerät versucht beizutreten | „Dieser Raum ist voll.“ | |
| 1.19 | Beide schließen den Browser, 20 min warten, Code erneut eingeben | „Diesen Raum gibt es nicht (mehr)…“ | |

Messwerte notieren: Ping A ___ ms, Ping B ___ ms, Ruckeln ja/nein, Akku nach 15 min ___ %, Gerät warm ja/nein.

## 2. Zwei gegen zwei (4 Geräte)

| # | Schritt | Erwartung | Ergebnis |
|---|---|---|---|
| 2.1 | A: Raum 2 gegen 2 erstellen, B, C, D treten bei | 2 pro Team, Teamwechsel nur bei freiem Platz | |
| 2.2 | Alle bereit | gemeinsamer Start | |
| 2.3 | Mitspieler ansehen | Teamkollege als Figur sichtbar, bewegt sich flüssig | |
| 2.4 | Beide im Team schießen auf dieselbe Ziege | Ziege stirbt einmal, Münzen nur einmal | |
| 2.5 | Teamkasse | Kauf von A ist bei C (gleiches Team) sofort sichtbar | |
| 2.6 | C verliert Verbindung 30 s | Team spielt weiter, C kommt per Neuladen zurück | |
| 2.7 | Spielende | Ergebnis auf allen vier Geräten gleich | |

## 2b. V7 Käsekuchen-Raub (2 Handys, echtes Cloudflare-Staging)

| # | Schritt | Erwartung | Ergebnis |
|---|---|---|---|
| 2b.1 | A erstellt Kuchenkrieg 1v1, B tritt bei | A = Verteidiger, B = Schaf (sonst „Team wechseln“) | |
| 2b.2 | Start | A in der Festung (Ego-Sicht, Waffe), B als Schaf in der Herde (Sicht von hinten) | |
| 2b.3 | B steht still zwischen den Schafen, A schaut aus 25 m | A kann B nicht erkennen | |
| 2b.4 | A geht auf 10 m heran | kleiner schwarzer Schwanz bei genau einem Schaf, kein Name, kein Leuchten | |
| 2b.5 | A zielt 1 s auf ein Herdenschaf | Schaf senkt den Kopf, scharrt, rammt A | |
| 2b.6 | A steht neben Schafen, zielt woanders hin | kein Angriff | |
| 2b.7 | B springt über eine Holzmauer; Sprung-Taste an Stahlmauer halten | Sprung klappt; Klettern langsam | |
| 2b.8 | A erschießt B in Welle 1 | B: „Keine Leben mehr“, wartet; Omi schimpft (Sprechblase, Untertitel, Stimme) | |
| 2b.9 | Welle 2 | B zurück mit 2 Leben | |
| 2b.10 | B kauft Schild, aktiviert ihn, schnappt den Kuchen (Knopf halten) | Schild verschwindet sofort; Kuchen sichtbar auf dem Schaf; A bekommt Alarm | |
| 2b.11 | A erschießt den Träger | Kuchen fällt ins Gras; A berührt ihn → zurück auf dem Tisch | |
| 2b.12 | B bringt den Kuchen zur Omi | B gewinnt sofort, Omi jubelt | |
| 2b.13 | Revanche, Festung ausbauen (Stein, Stahl, Tor, Turm, Geschütz, Falle, Werwolf) | alles sichtbar bei A und B, wirkt | |
| 2b.14 | Welle 8 | 100 Ziegen von allen Seiten; Bildrate auf beiden Handys: ___ / ___ fps | |
| 2b.15 | Einstellungen: Omi-Stimme aus | nur noch Sprechblase/Untertitel | |
| 2b.16 | 2 gegen 2 | 2 Verteidiger, 2 Schafe; Schafe sehen ihren Mitspieler mit Namen | |
| 2b.17 | Kein Anvisieren: Einzelspieler, Kuchenkrieg, GOAT ROYALE | kein Visier-Knopf, rechte Maustaste zoomt nicht | |
| 2b.18 | Matchdauer messen | ___ min | |

## 2d. V7.1 Solo gegen KI (1 Gerät, echtes Cloudflare-Staging)

| # | Schritt | Erwartung | ✓ |
|---|---|---|---|
| 2d.1 | Kuchenkrieg → Alleine spielen → Als Verteidiger, Mittel → Solo starten | Spiel startet in wenigen Sekunden, kein Code | |
| 2d.2 | 2 Minuten spielen | KI-Schaf grast in der Herde, nähert sich, klettert über Mauern; kein Teleportieren, kein Zittern | |
| 2d.3 | KI-Schaf stiehlt (abwarten oder Lücke lassen) | Kuchen sichtbar auf dem Rücken, Omi kommentiert | |
| 2d.4 | KI-Schaf erschießen | Omi kommentiert, KI kommt mit weniger Leben zurück | |
| 2d.5 | Ergebnis → Revanche (sofort) | neue Runde ab Welle 1 | |
| 2d.6 | Neu starten … → Als Schaf, Schwer | KI-Wächter mit Name „KI · Wächter (Schwer)“ sichtbar, schießt Ziegen, baut | |
| 2d.7 | Als Schaf hinter einer hohen Mauer verstecken | KI-Wächter schießt nicht durch die Mauer, findet dich nicht ohne Sicht | |
| 2d.8 | Kuchen stehlen und zur Omi bringen (Leicht) | machbar; auf Schwer deutlich schwerer | |
| 2d.9 | Mit Freunden spielen → Raum → „+ KI“ → Bereit | Match mit KI-Mitspieler | |
| 2d.10 | Gefühlte Schwierigkeit Leicht / Mittel / Schwer notieren | ___ / ___ / ___ | |

## 2c. iPhone Home-Bildschirm (PWA)

| # | Schritt | Erwartung | Ergebnis |
|---|---|---|---|
| 2c.1 | Safari öffnen | Hinweis „Teilen → Zum Home-Bildschirm“ im Menü; × schließt ihn dauerhaft | |
| 2c.2 | Teilen → Zum Home-Bildschirm | Icon (Kuchen mit Hörnern), Name „Ziegenalarm“ | |
| 2c.3 | Vom Home-Bildschirm starten | ohne Safari-Leiste, Querformat, nichts unter Notch/Home-Balken verdeckt, kein Hinweis | |
| 2c.4 | Neue Version deployen, App neu öffnen | neue Version sofort da (kein Service Worker) | |

## 3. Wenn etwas schiefgeht

- Fehlertext und Uhrzeit notieren, Bildschirmfoto machen.
- Ausgabe von `npx wrangler tail` sichern.
- Raumcode notieren. `https://…/api/room/CODE` zeigt Zustand und Spielerzahl.
