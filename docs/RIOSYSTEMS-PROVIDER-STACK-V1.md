# RIOSYSTEMS Provider Stack v1

Status: Provider selection complete for the current Web, Automation, AI and Business Factories.

## Final v1 stack

| Factory | RIOSYSTEMS control | Primary provider path | Specialist / fallback |
| --- | --- | --- | --- |
| Web | Native Web Factory + GitHub source of truth | Native web builder → Cloudflare Workers | Lovable for visual acceleration, Framer for platform-led visual sites, Webflow for client-editable CMS missions |
| Automation | Native Automation Factory | Make | Activepieces as strategic second motor and future self-host path, client-owned n8n for complex technical workflows, Cloudflare Workers for micro flows |
| AI | Native AI policy/router | OpenAI API | Cloudflare Workers AI Free for staging/economy; OpenAI model ladder Luna → Terra → Sol |
| Business | Native Business Factory | Supabase Free + PostHog Free | Standalone CRM SaaS not required for v1 |

## Architectural meaning

Provider choice is explicit and source-controlled. LEAN requests a capability, the responsible Factory owns policy and contracts, and the Factory routes to a provider path. Provider products are execution tools, not the architecture itself.

The default Web path keeps code in GitHub rather than making a SaaS visual builder the permanent source of truth. Automation intent remains in RIOSYSTEMS even when Make executes the workflow. Activepieces remains available when open-source control or self-hosting becomes more important, while n8n is reserved for technical specialist work. AI model selection is budget/quality routed. Business data remains on portable Postgres, while analytics stays a separate evidence layer.

## Activation is intentionally separate

Selection complete does not mean external execution is authorized. Runtime provider connections, credentials and real staging actions are activated behind existing RIOSYSTEMS gates.

The next activation boundary is the first real staging run. It may require one or more of the following depending on the mission: Cloudflare staging deployment, Make account/API connection and cost gate, OpenAI API credential and mission budget, Supabase schema/data write, or PostHog event ingestion. Activepieces and n8n are not required for the first default path.

All such external writes and paid actions remain explicitly approval-gated. Custom domains and production deployment remain separate approvals. Automatic paid overflow remains disabled.

## Current core completion boundary

The four Factories required for the current company-building v1 core now have provider selections. The existing App Factory remains planned and intentionally outside this v1 completion boundary. It should receive its own provider-selection block when app-building becomes a required RIOSYSTEMS capability.

## Source of truth

The machine-readable contract is `src/provider-stack-v1.js`. Individual decision records remain in their respective Factory provider decision documents.
