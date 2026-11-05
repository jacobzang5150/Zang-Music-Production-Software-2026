-- Run with execute_sql against the configured database; all fixtures roll back.
begin;
do $$
declare
 owner_id text:='budget-sharing-test-'||gen_random_uuid()::text;
 a jsonb; b jsonb; c jsonb; linked jsonb; saved jsonb; restored jsonb; other jsonb;
 seed jsonb:='{"id":"a","sheets":[{"name":"Budget","testValue":10}]}';
begin
 insert into public.studio_projects(owner,id,data) values
 (owner_id,'a','{"id":"a","client":"Test Artist","name":"A"}'),
 (owner_id,'b','{"id":"b","client":"Test Artist","name":"B"}'),
 (owner_id,'c','{"id":"c","client":"Test Artist","name":"C"}');
 a:=public.studio_budget_operation(owner_id,'a','read',seed)->'budget';
 b:=public.studio_budget_operation(owner_id,'b','read',jsonb_set(seed,'{sheets,0,testValue}','20'))->'budget';
 c:=public.studio_budget_operation(owner_id,'c','read',seed)->'budget';
 linked:=public.studio_budget_operation(owner_id,'a','link',null,(a->>'revision')::int,a->>'budgetKey','b')->'budget';
 assert linked#>>'{sheets,0,testValue}'='20','link chooses target budget';
 assert jsonb_array_length(linked->'linkedProjects')=2,'two members visible';
 assert (select data#>>'{sheets,0,testValue}' from public.studio_budgets where owner=owner_id and id='a')='10','original retained';
 saved:=public.studio_budget_operation(owner_id,'a','save',jsonb_set(seed,'{sheets,0,testValue}','50'),(linked->>'revision')::int,linked->>'budgetKey')->'budget';
 b:=public.studio_budget_operation(owner_id,'b','read')->'budget';
 assert b#>>'{sheets,0,testValue}'='50','edits shared in both directions';
 assert b->>'budgetKey'=saved->>'budgetKey','same stable budget identity';
 assert (public.studio_budget_operation(owner_id,'a','save',seed,(linked->>'revision')::int,linked->>'budgetKey')->>'status')::int=409,'stale revision rejected';
 assert (public.studio_budget_operation(owner_id,'a','save',seed,(saved->>'revision')::int,'project:a')->>'status')::int=409,'stale link identity rejected';
 assert (public.studio_budget_operation('another-owner','a','read',seed)->>'status')::int=404,'cross-owner read rejected';
 assert (public.studio_budget_operation(owner_id,'a','link',null,(saved->>'revision')::int,saved->>'budgetKey','not-owned')->>'status')::int=400,'cross-owner target rejected';
 other:=public.studio_budget_operation(owner_id,'c','link',null,(c->>'revision')::int,c->>'budgetKey','a')->'budget';
 assert jsonb_array_length(other->'linkedProjects')=3,'join existing group without chains';
 restored:=public.studio_budget_operation(owner_id,'a','unlink',null,(saved->>'revision')::int,saved->>'budgetKey')->'budget';
 assert restored#>>'{sheets,0,testValue}'='10','unlink restores original separate budget';
 assert (public.studio_budget_operation(owner_id,'a','save',seed,(a->>'revision')::int,a->>'budgetKey')->>'status')::int=409,'pre-link separate editor cannot overwrite restored budget';
 other:=public.studio_budget_operation(owner_id,'c','read')->'budget';
 assert other#>>'{sheets,0,testValue}'='50','unlink preserves shared expenses for remaining projects';
 assert jsonb_array_length(other->'linkedProjects')=2,'unlink removes only the selected project';
 assert not has_function_privilege('anon','public.studio_budget_operation(text,text,text,jsonb,integer,text,text)','execute'),'anon cannot call budget RPC';
 assert not has_table_privilege('authenticated','public.studio_budget_links','select'),'client cannot bypass signed owner gateway';
end;
$$;
rollback;
