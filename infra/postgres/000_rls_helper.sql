-- Sprint 0: RLS helper. Module tables arrive with their owning sprints.
create or replace function zoqo_set_tenant(p_tenant uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('app.tenant_id', p_tenant::text, true);
end;
$$;
