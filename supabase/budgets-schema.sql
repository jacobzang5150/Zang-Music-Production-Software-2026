create table if not exists public.studio_budgets (
 owner text not null,id text not null,data jsonb not null check(jsonb_typeof(data)='object'),
 revision integer not null default 1 check(revision>0), primary key(owner,id),
 foreign key(owner,id) references public.studio_projects(owner,id) on delete cascade
);
alter table public.studio_budgets enable row level security;
revoke all on public.studio_budgets from public,anon,authenticated;
grant select,insert,update,delete on public.studio_budgets to service_role;
