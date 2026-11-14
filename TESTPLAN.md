# Ziegenalarm Online – Testplan für echte Geräte

Ziel: Zwei echte Spieler spielen über dieselbe öffentliche Seite in einer Kuchenkrieg-Lobby.
Alle Punkte hier sind **noch nicht ausgeführt**. Bitte nach dem Deploy abarbeiten und die Spalte „Ergebnis“ ausfüllen.

**Was schon geprüft ist (Stand V6.1)**

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

## 2b. V6.1 Kuchenkrieg-Arena, Werwölfe, Boost (2 Handys)

| # | Schritt | Erwartung | Ergebnis |
|---|---|---|---|
| 2b.1 | Start 1 gegen 1 | Beide in **einer** Arena, gegnerisches Fort mit Kuchen im Blick, Gegner als Figur | |
| 2b.2 | A und B laufen zur Mitte | Bewegungen flüssig beim jeweils anderen | |
| 2b.3 | A schießt auf B | B: Lebensanzeige oben sinkt; Treffer nur in Reichweite und nicht durch Deckungen | |
| 2b.4 | A erledigt B | B: „Erwischt!“, nach 4 s Respawn im eigenen Fort mit Schutzschimmer; A: +20 Münzen | |
| 2b.5 | A wartet am Spawn von B | B erscheint an der von A abgewandten Seite und ist 3 s geschützt | |
| 2b.6 | Welle 3: Werwolf-Knopf | Kauf 60 Münzen, Heulen, Wolf jagt Ziegen am eigenen Kuchen; beim Gegner sichtbar; 3. Kauf abgelehnt | |
| 2b.7 | Sprungknopf kurz tippen / halten | Tippen = Sprung; Halten = Schub bis ca. 5 m, Flamme, Balken lädt 6 s | |
| 2b.8 | Halten + Joystick + Feuerknopf gleichzeitig | alle drei Finger wirken (Multi-Touch) | |
| 2b.9 | Welle 4 / 5 | roter Nebel; Ziegenkönig mit Bossbalken, Warnring/-bahn vor Angriffen sichtbar | |
| 2b.10 | Spielende | gleicher Sieger auf beiden Geräten, Spalte PvP | |
| 2b.11 | Koop: Raum „Koop“ | beide im selben Team, kein Gegnerfort, Sieg bei überlebter Welle 5 | |
| 2b.12 | Matchdauer messen | Ziel 5–7 min: ___ min | |

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
