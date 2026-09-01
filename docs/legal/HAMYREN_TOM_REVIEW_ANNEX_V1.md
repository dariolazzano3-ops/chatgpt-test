# HAMYREN Technische und organisatorische Maßnahmen — Review Annex V1

> Technischer Evidenzentwurf, keine Art.-32-Zertifizierung und keine rechtliche Freigabe. Organisatorische Verantwortlichkeiten können erst nach Festlegung des tatsächlichen Betreibers finalisiert werden.

## Technisch vorhandene bzw. verifizierte Kontrollen

- separater Customer Data Plane und privater Operator Control Plane;
- dediziertes Customer-Supabase-Projekt in dokumentierter Region `eu-central-1`;
- JWT-Identität, aktive Tenant-Mitgliedschaft und Row Level Security;
- persönliche Conversation-Owner-Isolation;
- kein Customer-Service-Role-Key im Customer Worker;
- keine authentifizierte Direkt-DELETE-Policy; serverseitiger, JWT-geschützter Hard-Delete-Pfad;
- Export, Korrektur, Consent-Historie und bestätigte Account-Löschung;
- verteilter Rate-Limit-/Abuse-Schutz und fail-closed Customer Launch Shield;
- minimierte Observability; Prompts, Nachrichten, Antworten, E-Mail, Tokens und Customer Business Content sind für technische Telemetrie gesperrt;
- Security-/Privacy- und 22-Fälle-Red-Team-Regressionen;
- Public Surface und Real-Customer-AI standardmäßig und live verifiziert OFF.

## Vor Real-Customer-Verarbeitung zu vervollständigen

- tatsächliche Governance-Rollen, Zugriffsmatrix und Joiner/Mover/Leaver-Prozess;
- Secrets-/Key-Rotation, Incident-Owner und dokumentierter Breach-Prozess;
- freigegebene Retention-, Backup-, Restore- und Löschfortpflanzungsregeln;
- Provider-DPAs, Subprocessor-Liste, Regionen/Transfers und TIA;
- AI-Provider-Training-/Retention-/Abuse-Monitoring-Einstellungen;
- DPIA-Entscheidung und ggf. abgeschlossene DPIA;
- regelmäßige Access Reviews, Vulnerability-/Patch-Prozess und Evidenzaufbewahrung;
- Business-Continuity-/Recovery-Ziele und getestete Verfahren;
- organisatorische Vertraulichkeit, Schulung/AI Literacy und dokumentierte Weisungen.

## Evidence boundary

Die technischen Aussagen sind an den jeweiligen Repository-/Live-Evidence-Stand zu binden. Konfiguration allein gilt nicht als Live-Nachweis. Der finale TOM-Anhang benötigt Datum, Version, tatsächlichen Betreiber, verantwortliche Rollen und menschliche Freigabe.
