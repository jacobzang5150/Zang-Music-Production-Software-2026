create table public.studio_clients (
  owner text not null,
  id text not null,
  data jsonb not null check (jsonb_typeof(data)='object' and data ? 'name' and jsonb_typeof(data->'name')='string' and length(btrim(data->>'name')) between 1 and 120),
  revision integer not null default 1 check (revision>0),
  name_key text generated always as (lower(btrim(data->>'name'))) stored,
  primary key(owner,id),
  unique(owner,name_key)
);
alter table public.studio_clients enable row level security;
revoke all on public.studio_clients from anon,authenticated;
grant select,insert on public.studio_clients to service_role;
create policy "Server gateway only" on public.studio_clients for all to service_role using(true) with check(true);
