# FollowClean Smart Cleanup V4 | Release & QA

Datum: 12. November 2026. Basis: bestehendes `apps/followclean/index.html`, Branch `factory/followclean-mvp-v1-20261109`.

## Umsetzung

1. Die bereits vorhandene geführte Bereinigung wurde im bestehenden Accountlisten-Flow nach oben versetzt und als eigenständiger, mobiloptimierter Smart-Cleanup-Schritt weiterentwickelt. Kein neues Framework und keine zweite parallele Statuslogik.
2. Automatisch nächster offener Account nach „Erledigt“ oder „Behalten“; „Später ansehen“ und „Rückgängig“ im selben Assistenten. Ein geöffnetes Instagram-Profil bleibt im Assistenten sichtbar, bis die Rückkehr verarbeitet wird. `blur` allein zählt nicht als erfolgreiche Rückkehr. Abgehakte Accounts sind **kein Beweis** eines Instagram-Entfolgens.
3. Live-Fortschrittsbalken, Anzahl bearbeiteter Konten, kompakter Avatar-Fallback, gut bedienbare Touch-Aktionen und explizite Schließen-Funktion.
4. Offizieller Meta-Kontenübersicht-Link `https://accountscenter.facebook.com/` mit Kurzmerkern: **Follower & Gefolgt**, **gesamter Zeitraum**, **JSON**. Bestehende vollständige Drei-Schritte-Anleitung bleibt vorhanden.
5. Vorhandene ZIP-Analyse, kostenlose Liste, Schnellfilter, lokale Statusspeicherung, Verlaufsvergleich, private JSON-Sicherung und Stripe-Sandbox-RIO unverändert erhalten. Keine zusätzlichen Server, Tracking-SDKs oder Zahlungen.

## Verifikation vor Deployment

- Mobile Chromium, synthetische offizielle Instagram-ZIP: **30 von 31** Prüfungen bestanden; der eine zu früh ausgewertete Statuszähler wurde anschließend mit einer korrekten Wartebedingung erneut geprüft.
- Unabhängige Lifecycle-Regression mit Wartebedingung: **7/7** bestanden (Profil öffnen, nicht bei Fokusverlust abschließen, bei Pagehide/Pageshow abschließen, nächstes Profil anbieten).
- Große synthetische Liste: **10/10** bestanden, einschließlich 1.200 Accounts, maximal 48 initial gerenderte Zeilen, Touchflächen >=44px, 390px ohne horizontalen Scroll und funktionierender Guide-Navigation.
- Physisches iPhone-Safari bleibt offen; Browser-Emulation ist kein Safari-Beweis.

## Freigabegrenzen

Kein Instagram-Passwort, kein automatisches Entfolgen, keine echte Stripe-Zahlung. Kommerzielle Freigabe weiterhin gesperrt bis zur rechtlichen Prüfung.
