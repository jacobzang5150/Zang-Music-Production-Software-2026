begin;
set local role service_role;
insert into public.studio_invoice_numbers(owner,number) values ('invoice-number-test',4112);
insert into public.studio_invoices(owner,id,data,revision)
select 'invoice-number-test','fixture-'||g,jsonb_build_object('number','0000'),1 from generate_series(1,40) g;
do $$
declare original text; replacement text;
begin
 if (select count(distinct data->>'number') from public.studio_invoices where owner='invoice-number-test')<>40 then raise exception 'Duplicate invoice number';end if;
 if exists(select 1 from public.studio_invoices where owner='invoice-number-test' and ((data->>'number') !~ '^[1-9][0-9]{3}$' or data->>'number'='4112')) then raise exception 'Invalid or reserved number';end if;
 select data->>'number' into original from public.studio_invoices where owner='invoice-number-test' and id='fixture-1';
 update public.studio_invoices set data=jsonb_set(data,'{number}','"9999"'::jsonb) where owner='invoice-number-test' and id='fixture-1';
 if (select data->>'number' from public.studio_invoices where owner='invoice-number-test' and id='fixture-1')<>original then raise exception 'Invoice number changed';end if;
 delete from public.studio_invoices where owner='invoice-number-test' and id='fixture-1';
 insert into public.studio_invoices(owner,id,data) values ('invoice-number-test','replacement',jsonb_build_object('number','0000')) returning data->>'number' into replacement;
 if replacement=original or not exists(select 1 from public.studio_invoice_numbers where owner='invoice-number-test' and number=original::integer) then raise exception 'Deleted invoice number was released';end if;
end;
$$;
insert into public.studio_invoice_numbers(owner,number) select 'invoice-number-exhaustion-test',g from generate_series(1000,9999) g;
do $$
begin
 begin
  insert into public.studio_invoices(owner,id,data) values ('invoice-number-exhaustion-test','must-fail',jsonb_build_object('number','0000'));
  raise exception 'Exhausted pool accepted invoice';
 exception when raise_exception then
  if sqlerrm<>'All 9000 invoice numbers have been used. No number was reused.' then raise;end if;
 end;
 if exists(select 1 from public.studio_invoices where owner='invoice-number-exhaustion-test') then raise exception 'Exhausted invoice persisted';end if;
end;
$$;
rollback;
