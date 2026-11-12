# FollowClean | Premium Checkout & Legal Release Gates

Stand: 12.11.2026. **Stripe-Sandbox-Testkauf aktiv, keine echten Verkäufe oder juristische Freigabe.**

## Status

- Aktive Beta: kostenlos, vollständige Liste verfügbar, keine Passwörter, lokaler Instagram-ZIP-Vergleich, noindex.
- Stripe-Testpreis: **1,00 EUR einmalig, kein Abo**, nur im Sandbox-Modus. Offizielle vollständige Beta bleibt kostenlos.
- **Testkauf aktiv:** Ein eigener Stripe Payment Link ist auf der FollowClean-Website verlinkt; Checkout läuft bei Stripe. Keine Bezahl-Schranke, keine Echtgeldzahlung, kein serverseitiges bezahltes Entitlement.
- Stripe Kontext: YSRIO Sandbox, **livemode=false**. Eigenes FollowClean-Produkt `prod_VcGrnW8xhNyi3N`, Price `price_1Ub2JVB93JLuapUuxSQWn02D` (100 EUR-Cent inkl. Preissteuerdefinition, automatic_tax derzeit AUS und nicht für echten Steuerbetrieb freigegeben), Coupon `FC_RIO_100_TEST_V1` (100 %, nur FollowClean-Produkt), Promo-Code `RIO` / `promo_1Ub2JfB93JLuapUuAQu69Z7q`. Payment Link `plink_1Ub2JrB93JLuapUuL2lhsegH` mit `allow_promotion_codes=true`: https://buy.stripe.com/test_28E3cu73K8VO9SIdGD8EM00 . Keine Änderungen am Lunara-Testprodukt.

## Reuse-first Implementierung, nach expliziter späterer Zahlungsfreigabe

1. Merchant/Steuern festlegen: Verantwortlicher, Adresse, Kontakt, einschlägige steuerliche Registrierung/Steuerbehandlung, Brutto/Netto-Frage; Stripe Tax bei Bedarf korrekt konfigurieren.
2. **Erledigt, Sandbox:** Eigenes FollowClean-Testprodukt/Price 100 EUR-Cent sowie Promo-Code RIO mit 100 % Rabatt und hosted Stripe-Test-Payment-Link sind angelegt und in die kostenlose Beta eingebaut. Mit RIO kann Stripe eine kostenlose Checkout-Session ohne Karteneingabe abschließen. Ohne RIO erlaubt Stripe die Testkarte `4242 4242 4242 4242`; kein echtes Geld fließt.
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
- [x] Sandbox-Produkt, 100-Cent-Price, test-only Payment Link und 100-%-Promo-Code RIO ausschließlich für FollowClean erstellt; UI verlinkt. **Noch offen:** eine tatsächlich abgeschlossene Testbestellung im Stripe-Konto nachweisen (Checkout-Unterzeichnung im Stripe-UI durch Tester).
- [ ] **Spätere Echtgeld-Freischaltung:** Webhook-Signatur, Idempotenz, Entitlement und Fehlerszenarien geprüft. Sandbox-Payment-Link speichert Stripe Checkout Sessions bei Abschluss; **kein eigener Webhook/Bestell-Datenbankeintrag** oder automatischer Premium-Zugang in FollowClean.
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
