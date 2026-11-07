-- Snapshots survive budget imports and project deletion. One invoice per budget.
create table if not exists public.studio_invoices (
 owner text not null,id text not null,data jsonb not null check(jsonb_typeof(data)='object'),
 revision integer not null default 1 check(revision>0),primary key(owner,id)
);
alter table public.studio_invoices enable row level security;
revoke all on public.studio_invoices from public,anon,authenticated;
grant select,insert,update,delete on public.studio_invoices to service_role;
