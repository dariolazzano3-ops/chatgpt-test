-- PROJECT SOURCE INTAKE V1
-- Private binary persistence only. Browser/client access remains deny-by-default
-- because storage.objects RLS is enabled and no anon/authenticated policies are added.
-- The Access-gated Operator Worker is the only supported write/read path and uses
-- the existing server-side Supabase service-role binding after project-scope checks.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'project-source-intake-private',
  'project-source-intake-private',
  false,
  20971520,
  array[
    'text/plain',
    'text/markdown',
    'text/csv',
    'application/json',
    'text/html',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif'
  ]::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  updated_at = now();

-- Intentionally no storage.objects policy for anon/authenticated roles.
-- With existing RLS enabled this leaves direct client access fail-closed.
