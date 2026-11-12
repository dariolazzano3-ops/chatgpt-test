# FollowClean | Premium Checkout & Legal Release Gates

Stand: 12.11.2026. **Entwurf, nicht kaufbar, keine juristische Freigabe.**

## Status

- Aktive Beta: kostenlos, vollständige Liste verfügbar, keine Passwörter, lokaler Instagram-ZIP-Vergleich, noindex.
- Premium-Preis in UI-Vorschau: **1,00 EUR einmalig, kein Abo**, ausdrücklich noch kein Angebot zum Kauf.
- Bezahl- und Freischaltungscode: **NICHT AKTIV**. Die Vorschau ist ein browserlokales, nicht transaktionales Accordion.
- Verfügbarer verbundener Stripe-Kontext: YSRIO Sandbox, livemode=false. **Noch kein FollowClean-Stripe-Produkt/Preis/Checkout erstellt.** Erst Steuerbehandlung und Verkäuferdetails klären; keine Wiederverwendung eines fremden Projektprodukts.

## Reuse-first Implementierung, nach expliziter späterer Zahlungsfreigabe

1. Merchant/Steuern festlegen: Verantwortlicher, Adresse, Kontakt, einschlägige steuerliche Registrierung/Steuerbehandlung, Brutto/Netto-Frage; Stripe Tax bei Bedarf korrekt konfigurieren.
2. Für **FollowClean** nur im Stripe-Testmodus ein eigenes digitales Einmalkaufprodukt mit eindeutigen Metadaten und Price 100 EUR-Cent anlegen. Keine echte Checkout-URL oder Test-Bezahlschranke automatisch in die öffentliche Beta einbauen.
3. Gehostetes Stripe Checkout über einen **serverseitigen** Cloudflare-Worker-Endpunkt. Stripe Secret Key ausschließlich als Worker-Secret, nie im HTML, Browser-JS oder Git. Produkt-ID, Preis und Währung serverseitig festlegen. Nicht auf vom Client übermittelte Preisinformation vertrauen. Keine privaten ZIP-Daten, Instagram-Nutzerlisten oder Followernamen an Stripe senden.
4. Bezahlstatus nur serverseitig nach überprüftem Stripe-Webhooksignatur-Header und bestätigtem Checkout-/Paymentstatus auswerten, mit Idempotenz für wiederholte Events; Rücksprung zu einer success-URL ist **kein Zahlungsbeweis**.
5. Für zukünftige Freischaltung eine kurzlebige und manipulationssichere Berechtigungs-/Beleglösung gestalten. Kein `localStorage.premium=true` als Zahlungsbeweis. Rechte nur an verifizierte, serverseitig verbuchte Zahlung binden. Ein datensparsamer Kaufnachweis muss ohne Upload des Instagram-Exports auskommen.
6. Erst nach juristischer Freigabe: klare Bestellübersicht, vollständige Preis- und Steuerangaben, eindeutig zahlungspflichtiger Abschluss, geprüfte Verbraucherinformationen, Widerrufsbehandlung bei digitalen Inhalten und E-Mail-/Belegablauf.
7. Getrennte Test- und Livekonfiguration; Live bleibt standardmäßig **OFF**, Aktivierung erfordert eigenständige ausdrückliche Nutzerfreigabe. Kein Live-Stripe-Link und keine echten Charges ohne diese Freigabe.

## Launch-Gates (offen)

- [ ] Betreiberidentität und Rechtsform, ladungsfähige Adresse, E-Mail, ggf. Register/USt-/Aufsichtsdaten bestätigt, Impressum nach § 5 DDG vollständig.
- [ ] Vollständige DSGVO-Datenschutzhinweise (Art. 13), Cloudflare-Hosting/technische Logs/Drittstaatentransfer und Speicherfristen verifiziert.
- [ ] Steuerbehandlung einschließlich Umsatzsteuer, 1,00-EUR-Brutto/Netto-Definition und Zahlungsanbieter-/Rechnungspflichten geklärt.
- [ ] Widerrufs-/Verbraucherinformationen für digitale Leistung und Vertragstexte rechtlich geprüft, Checkout-Button gemäß § 312j BGB.
- [ ] Sandbox-Produkt und Price separat für FollowClean erstellt, danach nur erlaubte Sandbox-Checkout-Tests mit synthetischen Accounts.
- [ ] Webhook-Signatur, Idempotenz, Entitlement, Rücksprung, manipulierte Requests und Fehlerszenarien unabhängig getestet.
- [ ] iPhone-Safari-Kauf- und Rückkehrablauf geprüft, vollständige visuelle und Barrierefreiheitsabnahme.
- [ ] Echte Zahlungen gesondert schriftlich freigegeben; kontrollierter Launch mit Rollback.
- [ ] Kein unzutreffender Link zur früheren EU-ODR-Plattform (am 20.07.2025 eingestellt); etwaige andere Streitbeilegungspflichten prüfen.

## Belegbare Quellen

- DDG § 5: https://www.gesetze-im-internet.de/ddg/__5.html
- DSGVO Art. 13: https://eur-lex.europa.eu/eli/reg/2016/679/
- BGB § 312j: https://www.gesetze-im-internet.de/bgb/__312j.html
- BGB § 356: https://www.gesetze-im-internet.de/bgb/__356.html
- Stripe Checkout: https://docs.stripe.com/payments/accept-a-payment?payment-ui=checkout&ui=stripe-hosted
- ODR-Schließung: https://consumer-redress.ec.europa.eu/site-relocation_en

**Nicht als Rechtsberatung oder Produktionsfreigabe verstehen.**
