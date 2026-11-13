# FollowClean | Aktuelle Instagram-Zahlen | V1 (13.11.2026)

## Kundenfunktion
Nach lokalem Instagram-ZIP-Import bleibt die Nicht-Rückfolger-Liste eine Momentaufnahme.
Zusätzlich zeigt FollowClean nach freiwilliger offizieller Verbindung eines Business-/Creator-Kontos:
- Aktuell abonniert (Meta Graph API: follows_count)
- Aktuelle Follower (Meta Graph API: followers_count)
- Zeitpunkt der letzten erfolgreichen Abfrage
- Nettodifferenz zur importierten ZIP nur, wenn das manuell ausgewählte Konto dem bei Meta verifizierten Profil entspricht

Client-Abfragen höchstens alle 120 Sekunden im sichtbaren Tab, serverseitiger Kurzcache mindestens 60 Sekunden. Kein automatisches Entfolgen und keine unzutreffenden Live-Angaben.

## Datenschutz & Sicherheitsmodell
- Kein Instagram-Passwort oder Access Token in HTML, Browser-JavaScript oder Git.
- Offizielles Instagram Business Login, Scope instagram_business_basic, nur mit Zustimmung des Kontoinhabers.
- Kurzes OAuth-State-Cookie mit HttpOnly/Secure/SameSite=Lax gegen CSRF.
- Token-Tausch nur serverseitig im Cloudflare Worker.
- AES-GCM-verschlüsseltes und authentifiziertes Session-Cookie, max. 30 Tage; keine neue Datenbank.
- Keine ZIP-Datei, Namenlisten, Checklisten oder Historie an Meta oder unseren Server zur Analyse.
- Der Server zeigt nur die zwei Gesamtsummen und den Zeitpunkt; Fehlerszenarien zeigen nie erfundene Zahlen.
- Gleicher Worker, keine neue VPS/SaaS-Dienstleistung. Beta bleibt kostenlos und nicht indexiert. Stripe-Sandbox und RIO bleiben unverändert.

## Vor Live-Aktivierung erforderlich
1. Eine Meta Developer App mit Instagram API with Instagram Login für Business-/Creator-Konten.
2. In der Meta-App folgende OAuth-Redirect-URI exakt registrieren:
   https://followclean-mvp-preview.gelato-donatello-dario-a5a5376c.workers.dev/api/instagram/callback
3. Drei Cloudflare Worker-Secrets für followclean-mvp-preview konfigurieren:
   FC_IG_CLIENT_ID = Instagram App ID
   FC_IG_CLIENT_SECRET = passendes Instagram App Secret
   FC_IG_SESSION_SECRET = zufälliger Geheimschlüssel mit mindestens 32 Zeichen
4. Passende App-Rollen/Tester sowie ggf. Meta App Review und Business Verification erledigen, bevor externe Nutzer zugelassen werden.

Cloudflare-Stand 13.11.2026: FC_IG_SESSION_SECRET wurde als zufälliges Worker-Secret erzeugt und ist in den Bindings geprüft. FC_IG_CLIENT_ID und FC_IG_CLIENT_SECRET fehlen noch. Daher ist die API bewusst als nicht verfügbar gekennzeichnet. Keine Verbindung oder echtes Live-Ergebnis vortäuschen.

## Build und Tests
Build: node apps/followclean/build-instagram-worker.mjs
Syntax: node --check apps/followclean/dist/worker.mjs
Synthetic smoke: node apps/followclean/tests/instagram-live-worker-smoke.mjs

Die Vorlage worker.instagram-template.mjs enthält das serverseitige OAuth-Modul. Das Build-Skript bündelt den aktuellen HTML-Code ohne neue Dependencies.

## Abnahme
- 13.11.2026: 9/9 statische Integrations- und Syntaxprüfungen bestanden. Cloudflare hat den Kandidaten-Worker hochgeladen und syntaktisch angenommen.
- Toolumgebung untersagt direkte HTTP-Anfragen an workers.dev (403); das ist KEIN nachgewiesener Worker-Fehler und KEIN HTTP-E2E-PASS.
- Synthetische Testdatei erstellt, aber in diesem Toolruntime nicht ausgeführt.
- Ohne Meta-App-Zugangsdaten kein echter OAuth-Login oder Live-Graph-API-Test.
- iPhone-Safari-Login, Rückkehr in den offenen ZIP-Tab, Token-Lebensdauer und rechtliche Ergänzungen vor Freigabe auf echten Geräten prüfen.
- Echtgeld, serverseitige Premium-Freischaltung und SEO-Indexierung bleiben deaktiviert.

Meta Felder: https://developers.facebook.com/docs/graph-api/reference/shadow-ig-user
Meta Instagram API: https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api

## Cloudflare-Auslieferung vom 13.11.2026
- Bestands-Worker: followclean-mvp-preview
- Deployment: 5163b35d-b302-4863-8cb8-e5837316e87f, 100 % für HTML+OAuth-Code angenommen.
- Anschließende sichere Session-Secret-Bindung in Version 9cad5a45-8b69-4806-bcec-d011365bc9eb, 100 % laut Cloudflare.
- Separater Kandidaten-Worker wurde nach erfolgreichem Upload-Test wieder deaktiviert und gelöscht.
- Kein Echtgeldbetrieb, keine neuen kostenpflichtigen Dienste, keine Instagram-Credentials in Git.
- Keine bestätigte HTTP-End-to-End-Antwort aus der Toolumgebung; externe OAuth-Verifizierung bleibt offen.
