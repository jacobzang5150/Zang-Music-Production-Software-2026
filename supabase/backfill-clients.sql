-- One-time, repeat-safe import of existing project and lead names into saved clients.
with source as (
  select owner,btrim(data->>'client') as name,0 as preference from public.studio_projects
  union all
  select owner,btrim(data->>'name') as name,1 as preference from public.studio_leads
), names as (
  select distinct on (owner,lower(name)) owner,name from source
  where name is not null and length(name) between 1 and 120
  order by owner,lower(name),preference,name
), records as (
  select owner,name,gen_random_uuid()::text as id from names
)
insert into public.studio_clients(owner,id,data,revision)
select owner,id,jsonb_build_object('id',id,'name',name),1 from records
on conflict(owner,name_key) do nothing;

update public.studio_projects p
set data=p.data||jsonb_build_object('clientId',c.id),revision=p.revision+1
from public.studio_clients c
where p.owner=c.owner and lower(btrim(p.data->>'client'))=c.name_key
  and (p.data->>'clientId') is distinct from c.id;
