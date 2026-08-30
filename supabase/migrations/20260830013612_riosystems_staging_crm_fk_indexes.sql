create index if not exists leads_project_contact_idx
  on public.leads(project_id, contact_id)
  where contact_id is not null;

create index if not exists provider_execution_refs_project_lead_idx
  on public.provider_execution_refs(project_id, lead_id)
  where lead_id is not null;
