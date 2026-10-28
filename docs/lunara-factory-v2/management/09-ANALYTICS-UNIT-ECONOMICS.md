# Track 09 | Analytik, Kosten, Deckungsbeitrag & Conversion
**Mission:** Wissen, ob Lunara tatsächlich profitabel Kunden gewinnt, nicht bloß hübsche Klickzahlen produzieren.

## MVP-Messplan (privacy-first)
- Funnel: `landing_view` → `builder_start` → `builder_step_complete` → `checkout_start` → `paid_verified` → `qa_pass` → `pdf_stored` → `delivery_confirmed`.
- Track nur Eventnamen, anonyme erlaubte Sitzungs-/Bestellreferenzen und Geräteklasse; **keine Kinder-Namen, E-Mail-Adressen, Geschichtentexte, Kuscheltiere oder Traumwelten** an Marketinganalytics.
- Vorhandenes PostHog/Cloudflare nutzen, erst Datenschutz- und Consent-Design festlegen. Keine ungenehmigten Marketingpixel.

## Kosten- und Conversion-Modell
- Nettoerlös je Order abzüglich MwSt.-/Steuerannahmen (rechtlich klären), Stripe-Gebühren, KI-Kosten aller Stufen inklusive QA-Reparatur, Rendering, Mail, Support, Rückerstattungen, Akquisekosten = echter Deckungsbeitrag.
- KPIs: Landing→Builder, Builder→Checkout, Checkout→Paid, Paid→Delivered, Fehlerquote, Retries, Kosten pro fertiger Geschichte, Supportfälle, Bruttomarge, CAC und zurückgewonnene Kunden.
- 12,90 EUR ist bisher Testpreis; kein ungeprüftes Versprechen „hohe Marge“.
- Fixkosten-Monitoring für bestehende Cloudflare/Supabase/Make/PostHog/OpenAI-Umgebung übernehmen, nicht doppelt anlegen.

## Aufgaben
- [ ] Eventvertrag und zulässige Datentypen mit 10 festlegen.
- [ ] Server-seitige Zahlungen und Lieferstatus als einzig verlässliche Conversion-Quelle.
- [ ] Kosten pro synthetischer Geschichte der Original-Factory einschließlich QA2 erfassen.
- [ ] Ein einfaches Dashboard + Wochenreport, das blockierte Bestellungen sichtbar macht.
- [ ] Erst nach echten Pilotergebnissen Preise, Kanäle und Werbung anhand von Unit Economics entscheiden.

**Definition of Done:** Aus einem vollständigen Test-/Pilotenauftrag sind Funnelstatus, Gesamtkosten und Fehlerursachen messbar, ohne sensitive Inhalte zu verraten.
**Abhängigkeiten:** 04, 06, 07, 08, 10.
**Status:** NOT-STARTED als vereinheitlichter Messvertrag.