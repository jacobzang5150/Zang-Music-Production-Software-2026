-- Stable, owner-scoped reservations make Drive creation safe to retry across devices.
create table public.studio_drive_folders (
 owner text not null,
 id text not null check (id ~ '^[a-f0-9]{64}$'),
 data jsonb not null check (jsonb_typeof(data)='object' and data ? 'folderId'),
 revision integer not null default 1 check (revision>0),
 primary key(owner,id)
);
alter table public.studio_drive_folders enable row level security;
revoke all on public.studio_drive_folders from anon,authenticated;
grant select,insert on public.studio_drive_folders to service_role;
create policy "Server gateway only" on public.studio_drive_folders for all to service_role using(true) with check(true);
