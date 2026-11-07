-- Reservations outlive invoice rows, so a deleted invoice number is never reused.
create table if not exists public.studio_invoice_numbers (
 owner text not null,number smallint not null check(number between 1000 and 9999),
 primary key(owner,number)
);
alter table public.studio_invoice_numbers enable row level security;
revoke all on public.studio_invoice_numbers from public,anon,authenticated,service_role;
grant select,insert on public.studio_invoice_numbers to service_role;

insert into public.studio_invoice_numbers(owner,number)
select owner,(data->>'number')::smallint from public.studio_invoices
where data->>'number' ~ '^[1-9][0-9]{3}$' on conflict do nothing;
-- The supplied historical invoice already used 4112; keep it out of the pool.
insert into public.studio_invoice_numbers(owner,number)
select distinct owner,4112 from public.studio_projects on conflict do nothing;

create or replace function public.studio_assign_invoice_number()
returns trigger language plpgsql security invoker set search_path='' as $$
declare chosen integer;
begin
 if tg_op='UPDATE' then
  if new.owner is distinct from old.owner or new.id is distinct from old.id then
   raise exception 'Invoice identity cannot change';
  end if;
  if old.data->>'number' ~ '^[1-9][0-9]{3}$' then
   new.data:=jsonb_set(new.data,'{number}',to_jsonb(old.data->>'number'));
   return new;
  end if;
 end if;
 perform pg_advisory_xact_lock(hashtextextended('studio-invoice-number:'||new.owner,0));
 select candidate into chosen from generate_series(1000,9999) as candidate
 where not exists(select 1 from public.studio_invoice_numbers used where used.owner=new.owner and used.number=candidate)
 order by random() limit 1;
 if chosen is null then raise exception 'All 9000 invoice numbers have been used. No number was reused.';end if;
 insert into public.studio_invoice_numbers(owner,number) values(new.owner,chosen);
 new.data:=jsonb_set(new.data,'{number}',to_jsonb(chosen::text));
 return new;
end;
$$;
revoke all on function public.studio_assign_invoice_number() from public,anon,authenticated;
grant execute on function public.studio_assign_invoice_number() to service_role;
drop trigger if exists studio_invoice_number on public.studio_invoices;
create trigger studio_invoice_number before insert or update on public.studio_invoices
for each row execute function public.studio_assign_invoice_number();
-- Convert old JZ-prefixed invoices once; stale editors must reload their revision.
update public.studio_invoices set data=jsonb_set(data,'{number}','"0000"'::jsonb),revision=revision+1
where coalesce(data->>'number','') !~ '^[1-9][0-9]{3}$';
create unique index if not exists studio_invoices_number_unique_idx
on public.studio_invoices(owner,(data->>'number'));
