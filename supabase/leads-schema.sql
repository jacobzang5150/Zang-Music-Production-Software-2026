create table public.studio_leads (
  owner text not null,
  id text not null,
  data jsonb not null check (jsonb_typeof(data) = 'object' and jsonb_typeof(data->'name') = 'string' and length(trim(data->>'name')) between 1 and 120),
  revision integer not null default 1 check (revision > 0),
  primary key (owner, id)
);
alter table public.studio_leads enable row level security;
revoke all on table public.studio_leads from anon, authenticated;
grant select, insert, update, delete on public.studio_leads to service_role;
create policy "Server gateway only" on public.studio_leads for all to service_role using (true) with check (true);
