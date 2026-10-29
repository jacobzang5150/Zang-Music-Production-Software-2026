create table public.studio_drive_auth (
 owner text not null,
 id text not null check(id='connection'),
 data jsonb not null check(jsonb_typeof(data)='object' and data ? 'sealed'),
 revision integer not null default 1 check(revision>0),
 primary key(owner,id)
);
alter table public.studio_drive_auth enable row level security;
revoke all on public.studio_drive_auth from anon,authenticated;
grant select,insert,update,delete on public.studio_drive_auth to service_role;
create policy "Server gateway only" on public.studio_drive_auth for all to service_role using(true) with check(true);
