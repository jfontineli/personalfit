-- Sessions created by the day player keep their prescribed day and calendar week.
-- Older sessions remain readable and their pending operations continue through the original RPC.
alter table public.workout_sessions add column day_id uuid;
alter table public.workout_sessions add column week_start date;
alter table public.workout_sessions add constraint workout_session_day_week_pair
  check ((day_id is null) = (week_start is null));
create index workout_sessions_week on public.workout_sessions(tenant_id, student_id, week_start, day_id)
  where day_id is not null;

create function public.validate_workout_session_day() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_entry jsonb;
begin
  if tg_op = 'UPDATE' and old.day_id is not null
    and (new.day_id is distinct from old.day_id or new.week_start is distinct from old.week_start)
    then raise exception 'session day cannot change' using errcode = '23505'; end if;
  if new.day_id is null then return new; end if;
  if new.week_start is null or extract(isodow from new.week_start) <> 1
    or not exists (select 1 from public.workout_plan_versions v,
      jsonb_array_elements(v.snapshot->'days') day
      where v.id = new.version_id and day->>'id' = new.day_id::text)
    then raise exception 'invalid workout day or week' using errcode = '22023'; end if;
  for v_entry in select value from jsonb_array_elements(new.entries) loop
    if not exists (select 1 from public.workout_plan_versions v,
      jsonb_array_elements(v.snapshot->'days') day,
      jsonb_array_elements(day->'items') item
      where v.id = new.version_id and day->>'id' = new.day_id::text
        and item->>'id' = v_entry->>'itemId')
      then raise exception 'entry belongs to another workout day' using errcode = '22023'; end if;
  end loop;
  return new;
end $$;
create trigger validate_workout_session_day_before_write
  before insert or update of entries, day_id, week_start, version_id on public.workout_sessions
  for each row execute function public.validate_workout_session_day();

create function public.sync_workout_day_session(p_operation_id uuid, p_session_id uuid,
  p_version_id uuid, p_revision integer, p_entries jsonb, p_status text,
  p_day_id uuid, p_week_start date) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_existing public.workout_sessions%rowtype; v_applied boolean;
begin
  if p_day_id is null or p_week_start is null or extract(isodow from p_week_start) <> 1
    then raise exception 'invalid workout day or week' using errcode = '22023'; end if;
  if not exists (select 1 from public.workout_plan_versions v,
    jsonb_array_elements(v.snapshot->'days') day
    where v.id = p_version_id and day->>'id' = p_day_id::text)
    then raise exception 'invalid workout day or week' using errcode = '22023'; end if;
  if jsonb_typeof(p_entries) <> 'array' then raise exception 'invalid session' using errcode = '22023'; end if;
  if exists (select 1 from jsonb_array_elements(p_entries) entry
    where not exists (select 1 from public.workout_plan_versions v,
      jsonb_array_elements(v.snapshot->'days') day,
      jsonb_array_elements(day->'items') item
      where v.id = p_version_id and day->>'id' = p_day_id::text
        and item->>'id' = entry->>'itemId'))
    then raise exception 'entry belongs to another workout day' using errcode = '22023'; end if;
  select * into v_existing from public.workout_sessions where id = p_session_id;
  if found and (v_existing.day_id is distinct from p_day_id or v_existing.week_start is distinct from p_week_start)
    then raise exception 'session day conflict' using errcode = '23505'; end if;
  -- The original RPC checks the active student, assignment, revision and operation receipt.
  v_applied := public.sync_workout_session(p_operation_id, p_session_id, p_version_id,
    p_revision, p_entries, p_status);
  if v_applied then
    update public.workout_sessions set day_id = p_day_id, week_start = p_week_start
      where id = p_session_id and day_id is null;
  end if;
  return v_applied;
end $$;
revoke all on function public.sync_workout_day_session(uuid,uuid,uuid,integer,jsonb,text,uuid,date) from public, anon;
grant execute on function public.sync_workout_day_session(uuid,uuid,uuid,integer,jsonb,text,uuid,date) to authenticated;
