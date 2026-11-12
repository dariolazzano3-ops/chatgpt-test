# FollowClean Premium V2 | Best-of-Market Audit & Implementation

Datum: 12. November 2026
Geltungsbereich: `apps/followclean/index.html` auf `factory/followclean-mvp-v1-20261109`
Status: **Code implementiert und 17/17 mobile Pre-Deployment-Browserchecks bestanden.** Deployment-Nachweis separat prüfen.

## Recherche (öffentliche Herstellerangaben, nicht unabhängig vollständig getestet)

1. **WhoUnfollowed** (https://whounfollowed.co/; https://whounfollowed.co/changelog): Snapshotvergleich, Follower-Veränderungen, Triage-Status, Statusfilter mit Zahlen, Sortierung A–Z / Z–A, CSV.
2. **FollowBuddy** (https://followbuddy.com/; https://followbuddy.com/blog/how-to-find-unfollowers-safely-with-followbuddy): Ruhige Dashboard-Karten, klare Upload-Handlungsaufforderung, Follower-Ereignisse und Fortschrittsübersicht.
3. **SafeUnfollow** (https://safeunfollow.app/; https://safeunfollow.app/docs/user-guide): Lokale Datei-Verarbeitung, sinnvolle Ergebniskategorien, klare Datenschutzkommunikation und mobile Layouts.
4. **IGTracker** (https://igtracker.app/): Einfache Schrittfolge, Nutzerführung für offizielles JSON-Exportformat.

### Auswahl / Wiederverwendung

Bestehende Komponenten wiederverwenden: ZIP-Import, JSZip, Bereinigung, lokale Markierungen, CSV, Filter-Dropdown, Seitenweise Rendern, Stripe-Testcheckout. Keine Framework-Migration.

Eigenständig implementiert:
- **Schnellfilter** mit Zahlen und `aria-pressed`: Alle, Offen, Angesehen, Behalten, Erledigt.
- **Sortierung**: Offene zuerst, A–Z, Z–A; Filterung und Seitenbegrenzung von 48 Accounts bleiben erhalten.
- **Zwei-Export-Vergleich**: optional ältere offizielle Instagram-JSON-ZIP im bestehenden Ergebnisschritt importieren. Vergleich der beiden Follower- und Following-Mengen: nicht mehr vorhanden, neu hinzugekommen, nicht mehr gefolgt, neu gefolgt. Ergebnisse lokal im Browser; keine persistente Historie.
- **Privacy-first**: keine externen Avatar-Anfragen und kein weiterer Account-Upload. UI und Code bewusst unabhängig von fremden Designs.

### Wichtige Produktgrenzen

- „Folgt nicht zurück“ = aktueller Export: Gefolgt minus Follower.
- „Nicht mehr unter deinen Followern“ = älterer Export: Follower früher minus Follower jetzt. Das ist **kein zweifelsfreier Beweis eines aktiven Entfolgens**; auch Löschung, Blockierung oder Nutzernamenwechsel beeinflussen die Differenz. Exakte Uhrzeiten lassen sich nicht ableiten.
- Der Nutzer muss zwei Exporte **desselben Instagram-Kontos** in der richtigen zeitlichen Reihenfolge hochladen.
- Beide ZIPs werden nur im Browser verarbeitet und nicht automatisch dauerhaft gespeichert. Vergleich wird auf neue Analyse und Zurücksetzen hin verworfen.
- Die vollständige Beta-Liste bleibt gratis. Der Stripe-Checkout ist **Testmodus**, Gutschein `RIO` = 100 % Sandbox-Rabatt; keine echten Zahlungen.
- Impressum / Datenschutzerklärung und reale Kaufabwicklung bleiben rechtliche Launch-Gates.

### QA vor Deployment

Mit synthetischem aktuellem ZIP (Follower: bob,daria,carla; Following: bob,daria,charlie,zoe,alex) und älterem ZIP (Follower: alice,bob; Following: alice,bob,charlie) im mobilen Browser:
- 17 von 17 Browserchecks PASS
- Snapshot-Differenzen: nicht mehr follower=1; neu follower=2; nicht mehr following=1; neu following=3
- Filter-Livezahlen, Behalten-Status, Sortierung A–Z/Z–A, 320px ohne horizontalen Overflow, Stripe-Sandbox-Link und kostenlose Ergebnisliste PASS
- JavaScript-Syntax und Set-Differenz-Funktion separat bestanden.
- Kein physisches iPhone Safari in dieser Runde geprüft.

### Nächster größter Hebel

End-to-End auf physischem iPhone mit **zwei echten, zeitlich verschiedenen Instagram-Exporten** und visueller Prüfung beider Modi. Keine privaten Exportdaten in Repos, Logs, öffentliche Screenshots oder Drittanbieter schicken.

### Quellen

- https://whounfollowed.co/changelog
- https://followbuddy.com/blog/how-to-find-unfollowers-safely-with-followbuddy
- https://safeunfollow.app/docs/user-guide
- https://igtracker.app/
