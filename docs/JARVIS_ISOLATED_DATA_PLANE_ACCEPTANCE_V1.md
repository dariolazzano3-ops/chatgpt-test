# JARVIS Isolated Data Plane Acceptance V1

Status: ACCEPTED / READY_UNBOUND

The dedicated personal JARVIS persistence plane is physically separated from the business Supabase account.

Verified:
- dedicated JARVIS Supabase account and organization
- dedicated healthy JARVIS project
- `jarvis_personal_memory_v1` migration applied
- `jarvis_private_rpc_oauth_v1` migration applied
- private tables: personal memory, audit events, OAuth connections
- RLS enabled and forced on all private tables
- anon cannot execute JARVIS service RPCs
- authenticated cannot execute JARVIS service RPCs
- service_role can execute the narrow JARVIS RPC gateway
- anon cannot read private memory or OAuth tables
- authenticated cannot read OAuth vault
- HAMYREN-named objects in `jarvis_private`: 0
- initial personal memory rows: 0
- initial audit rows: 0
- initial OAuth rows: 0

Runtime status:
- data plane: `ISOLATED_SUPABASE_READY_UNBOUND`
- standalone Worker: unbound
- neutral host: required before activation
- Production: OFF
- Public: OFF
- external writes: OFF
- Calendar write: OFF
- financial actions: OFF

No shared Supabase project is an allowed fallback for JARVIS personal persistence.
