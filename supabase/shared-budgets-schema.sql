-- Only the signed server gateway may access budgets and membership changes.
create table if not exists public.studio_shared_budgets (
 owner text not null,id text not null,data jsonb not null check(jsonb_typeof(data)='object'),
 revision integer not null default 1 check(revision>0),primary key(owner,id)
);
create table if not exists public.studio_budget_links (
 owner text not null,project_id text not null,budget_id text not null,
 primary key(owner,project_id),
 foreign key(owner,project_id) references public.studio_projects(owner,id) on delete cascade,
 foreign key(owner,budget_id) references public.studio_shared_budgets(owner,id) on delete cascade
);
create index if not exists studio_budget_links_budget_idx on public.studio_budget_links(owner,budget_id);
alter table public.studio_shared_budgets enable row level security;
alter table public.studio_budget_links enable row level security;
revoke all on public.studio_shared_budgets,public.studio_budget_links from public,anon,authenticated;
grant select,insert,update,delete on public.studio_shared_budgets,public.studio_budget_links to service_role;

-- One transaction resolves the budget and checks its revision AND membership.
-- Shared records outlive any one project; deleting a project only removes its link.
create or replace function public.studio_budget_operation(
 p_owner text,p_id text,p_action text,p_data jsonb default null,
 p_revision integer default null,p_key text default null,p_target text default null
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 group_id text; target_group text; current_key text; current_data jsonb; current_revision integer;
 result jsonb; members jsonb; choices jsonb;
begin
 if p_owner is null or p_id is null or p_action not in ('read','save','link','unlink') then
  return jsonb_build_object('error','Invalid budget operation','status',400);
 end if;
 perform pg_advisory_xact_lock(hashtextextended('studio-budget:'||p_owner,0));
 if not exists(select 1 from public.studio_projects where owner=p_owner and id=p_id) then
  return jsonb_build_object('error','Project not found','status',404);
 end if;
 select budget_id into group_id from public.studio_budget_links where owner=p_owner and project_id=p_id;
 if group_id is null then
  select data,revision into current_data,current_revision from public.studio_budgets where owner=p_owner and id=p_id;
  current_key:='project:'||p_id;
 else
  select data,revision into current_data,current_revision from public.studio_shared_budgets where owner=p_owner and id=group_id;
  current_key:='shared:'||group_id;
 end if;
 if p_action='read' and current_data is null then
  if p_data is null then return jsonb_build_object('error','Budget not initialized','status',404); end if;
  insert into public.studio_budgets(owner,id,data) values(p_owner,p_id,jsonb_set(p_data,'{id}',to_jsonb(p_id)));
  current_data:=p_data;current_revision:=1;
 elsif p_action<>'read' then
  if current_revision is distinct from p_revision or (p_key is distinct from current_key and (p_key is not null or group_id is not null)) then
   return jsonb_build_object('error','This budget or its project links changed. Download your changes before reloading.','status',409);
  end if;
  if p_action='save' then
   if p_data is null then return jsonb_build_object('error','Budget required','status',400);end if;
   current_revision:=current_revision+1;
   if group_id is null then
    current_data:=jsonb_set(p_data,'{id}',to_jsonb(p_id));
    update public.studio_budgets set data=current_data,revision=current_revision where owner=p_owner and id=p_id;
   else
    current_data:=jsonb_set(p_data,'{id}',to_jsonb(group_id));
    update public.studio_shared_budgets set data=current_data,revision=current_revision where owner=p_owner and id=group_id;
   end if;
  elsif p_action='link' then
   if p_target is null or p_target=p_id or not exists(select 1 from public.studio_projects where owner=p_owner and id=p_target) then
    return jsonb_build_object('error','Choose another project you own','status',400);
   end if;
   select budget_id into target_group from public.studio_budget_links where owner=p_owner and project_id=p_target;
   if target_group is null then
    -- The target's original stays untouched as a separate-budget backup.
    if not exists(select 1 from public.studio_budgets where owner=p_owner and id=p_target) then
     if p_data is null then return jsonb_build_object('error','Target budget required','status',400);end if;
     insert into public.studio_budgets(owner,id,data) values(p_owner,p_target,jsonb_set(p_data,'{id}',to_jsonb(p_target)));
    end if;
    target_group:=gen_random_uuid()::text;
    insert into public.studio_shared_budgets(owner,id,data)
    select p_owner,target_group,jsonb_set(data,'{id}',to_jsonb(target_group)) from public.studio_budgets where owner=p_owner and id=p_target;
    insert into public.studio_budget_links values(p_owner,p_target,target_group);
    update public.studio_budgets set revision=revision+1 where owner=p_owner and id=p_target;
   end if;
   insert into public.studio_budget_links values(p_owner,p_id,target_group)
   on conflict(owner,project_id) do update set budget_id=excluded.budget_id;
   update public.studio_budgets set revision=revision+1 where owner=p_owner and id=p_id;
   group_id:=target_group;current_key:='shared:'||group_id;
   select data,revision into current_data,current_revision from public.studio_shared_budgets where owner=p_owner and id=group_id;
  elsif p_action='unlink' then
   if group_id is null then return jsonb_build_object('error','This project already has a separate budget','status',400);end if;
   -- The separate original is restored. Shared expenses remain with the group.
   delete from public.studio_budget_links where owner=p_owner and project_id=p_id;
   update public.studio_budgets set revision=revision+1 where owner=p_owner and id=p_id;
   group_id:=null;current_key:='project:'||p_id;
   select data,revision into current_data,current_revision from public.studio_budgets where owner=p_owner and id=p_id;
  end if;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'client',p.data->>'client','name',p.data->>'name') order by p.data->>'client',p.data->>'name'),'[]'::jsonb)
 into members from public.studio_projects p join public.studio_budget_links l on l.owner=p.owner and l.project_id=p.id
 where l.owner=p_owner and l.budget_id=group_id;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'client',p.data->>'client','name',p.data->>'name') order by p.data->>'client',p.data->>'name'),'[]'::jsonb)
 into choices from public.studio_projects p where p.owner=p_owner and p.id<>p_id
 and not exists(select 1 from public.studio_budget_links l where l.owner=p_owner and l.project_id=p.id and l.budget_id=group_id);
 result:=jsonb_set(current_data,'{id}',to_jsonb(p_id))||jsonb_build_object('revision',current_revision,'budgetKey',current_key,'linkedProjects',members,'availableProjects',choices);
 return jsonb_build_object('budget',result,'status',200);
end;
$$;
revoke all on function public.studio_budget_operation(text,text,text,jsonb,integer,text,text) from public,anon,authenticated;
grant execute on function public.studio_budget_operation(text,text,text,jsonb,integer,text,text) to service_role;
create policy "Signed gateway only" on public.studio_shared_budgets for all to service_role using(true) with check(true);
create policy "Signed gateway only" on public.studio_budget_links for all to service_role using(true) with check(true);
