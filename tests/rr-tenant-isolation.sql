-- Run in a transaction as database administrator. Fixture accounts never persist.
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('fdd2e30c-f1fb-41ba-85f1-7a1491e20101','rr-fixture-a@example.invalid',now()),
 ('fdd2e30c-f1fb-41ba-85f1-7a1491e20102','rr-fixture-b@example.invalid',now());
insert into public.rr_invites values(8,'rr-fixture-a@example.invalid'),(9,'rr-fixture-b@example.invalid');
set local role authenticated;
select set_config('request.jwt.claim.sub','fdd2e30c-f1fb-41ba-85f1-7a1491e20101',true);
insert into public.rr_profiles values(auth.uid(),'{"first":"A"}');
insert into public.rr_templates values(auth.uid(),'Same name','{"studio":"A"}');
select set_config('request.jwt.claim.sub','fdd2e30c-f1fb-41ba-85f1-7a1491e20102',true);
do $$ begin
 if exists(select from public.rr_profiles) or exists(select from public.rr_templates) then raise exception 'Cross-tenant read'; end if;
 update public.rr_templates set model='{}' where name='Same name'; if found then raise exception 'Cross-tenant update'; end if;
 delete from public.rr_profiles; if found then raise exception 'Cross-tenant delete'; end if;
 begin insert into public.rr_templates values('fdd2e30c-f1fb-41ba-85f1-7a1491e20101','Forgery','{}'); raise exception 'Forged owner allowed'; exception when insufficient_privilege then null; end;
 if exists(select from pg_class c where c.relnamespace='public'::regnamespace and c.relname like 'studio_%' and c.relkind='r' and (not c.relrowsecurity or has_table_privilege('authenticated',c.oid,'select,insert,update,delete') or has_table_privilege('anon',c.oid,'select,insert,update,delete'))) then raise exception 'Direct access to legacy studio data'; end if;
end $$;
insert into public.rr_templates values(auth.uid(),'Same name','{"studio":"B"}');
select public.rr_delete_self();
reset role;
do $$ begin
 if exists(select from auth.users where id='fdd2e30c-f1fb-41ba-85f1-7a1491e20102') or exists(select from public.rr_templates where model->>'studio'='B') then raise exception 'Deletion incomplete'; end if;
 if not exists(select from public.rr_templates where owner='fdd2e30c-f1fb-41ba-85f1-7a1491e20101') then raise exception 'Other workspace deleted'; end if;
end $$;
rollback;
