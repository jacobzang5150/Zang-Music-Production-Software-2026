-- Project records are accessed only through the signed, server-to-server Edge Function.
create table public.studio_projects (
  owner text not null,
  id text not null,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  revision integer not null default 1 check (revision > 0),
  primary key (owner, id)
);
alter table public.studio_projects enable row level security;
revoke all on table public.studio_projects from anon, authenticated;
grant select, insert, update, delete on public.studio_projects to service_role;
create policy "Server gateway only" on public.studio_projects for all to service_role using (true) with check (true);
