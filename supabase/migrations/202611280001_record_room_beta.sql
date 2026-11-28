-- The original host's text owners are never mapped by email.
create table public.rr_invites (slot smallint primary key check (slot between 1 and 9), email text unique not null check (email=lower(trim(email)) and length(email)>2));
alter table public.rr_invites enable row level security;
revoke all on public.rr_invites from public,anon,authenticated;
create function public.rr_invited() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u join public.rr_invites i on i.email=lower(u.email) where u.id=(select auth.uid()) and u.email_confirmed_at is not null)
$$;
revoke all on function public.rr_invited() from public,anon;
grant execute on function public.rr_invited() to authenticated;
create table public.rr_profiles(owner uuid primary key references auth.users(id) on delete cascade, settings jsonb not null check(jsonb_typeof(settings)='object'));
create table public.rr_templates(owner uuid references auth.users(id) on delete cascade,name text check(length(name) between 1 and 80),model jsonb not null check(jsonb_typeof(model)='object'),primary key(owner,name));
alter table public.rr_profiles enable row level security;
alter table public.rr_templates enable row level security;
revoke all on public.rr_profiles,public.rr_templates from public,anon,authenticated;
grant select,insert,update,delete on public.rr_profiles,public.rr_templates to authenticated;
create policy private_profile on public.rr_profiles for all to authenticated using(owner=(select auth.uid()) and (select public.rr_invited())) with check(owner=(select auth.uid()) and (select public.rr_invited()));
create policy private_template on public.rr_templates for all to authenticated using(owner=(select auth.uid()) and (select public.rr_invited())) with check(owner=(select auth.uid()) and (select public.rr_invited()));
create function public.rr_delete_self() returns void language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid(); tenant text := 'beta:'||uid::text;
begin
 if uid is null or not public.rr_invited() then raise exception 'Not authorized'; end if;
 delete from public.studio_budget_links where owner=tenant;
 delete from public.studio_invoices where owner=tenant;
 delete from public.studio_invoice_numbers where owner=tenant;
 delete from public.studio_shared_budgets where owner=tenant;
 delete from public.studio_budgets where owner=tenant;
 delete from public.studio_completion_history where owner=tenant;
 delete from public.studio_drive_auth where owner=tenant;
 delete from public.studio_drive_folders where owner=tenant;
 delete from public.studio_projects where owner=tenant;
 delete from public.studio_clients where owner=tenant;
 delete from public.studio_leads where owner=tenant;
 delete from auth.users where id=uid;
end $$;
revoke all on function public.rr_delete_self() from public,anon;
grant execute on function public.rr_delete_self() to authenticated;
