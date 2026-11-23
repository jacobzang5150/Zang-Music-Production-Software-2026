-- Append-only check-off history. No retrospective timestamps are invented.
create table public.studio_completion_history (
 id bigint generated always as identity primary key,
 owner text not null,
 project_id text not null,
 client_name text not null,
 project_name text not null,
 song_id text not null,
 song_name text not null,
 stage_id text not null,
 stage_name text not null,
 checked_at timestamptz not null default statement_timestamp(),
 project_revision integer not null
);
create index studio_completion_history_owner_id on public.studio_completion_history(owner,id desc);
create index studio_completion_history_project_id on public.studio_completion_history(owner,project_id,id desc);
alter table public.studio_completion_history enable row level security;
revoke all on public.studio_completion_history from public,anon,authenticated;
grant select,insert on public.studio_completion_history to service_role;
grant usage,select on sequence public.studio_completion_history_id_seq to service_role;
create policy "Server gateway history read" on public.studio_completion_history for select to service_role using(true);
create policy "Server gateway history append" on public.studio_completion_history for insert to service_role with check(true);
create function public.studio_capture_completion_history() returns trigger
language plpgsql security invoker set search_path='' as $$
declare song jsonb; stage jsonb; previous_song jsonb; previous_data jsonb;
begin
 if tg_op='UPDATE' then previous_data:=old.data;else previous_data:='{}'::jsonb;end if;
 for song in select value from jsonb_array_elements(coalesce(new.data->'songs','[]'::jsonb)) loop
  select value into previous_song from jsonb_array_elements(coalesce(previous_data->'songs','[]'::jsonb)) where value->>'id'=song->>'id';
  for stage in select value from jsonb_array_elements(coalesce(new.data->'stages','[]'::jsonb)) loop
   if coalesce(song->'completed','[]'::jsonb) ? (stage->>'id') and not(coalesce(previous_song->'completed','[]'::jsonb) ? (stage->>'id')) then
    insert into public.studio_completion_history(owner,project_id,client_name,project_name,song_id,song_name,stage_id,stage_name,project_revision)
    values(new.owner,new.id,coalesce(new.data->>'client',''),coalesce(new.data->>'name',''),song->>'id',coalesce(song->>'name',''),stage->>'id',coalesce(stage->>'name',''),new.revision);
   end if;
  end loop;
 end loop;
 return new;
end;
$$;
revoke all on function public.studio_capture_completion_history() from public,anon,authenticated;
grant execute on function public.studio_capture_completion_history() to service_role;
create trigger studio_completion_checkoff_history after insert or update of data on public.studio_projects for each row execute function public.studio_capture_completion_history();
