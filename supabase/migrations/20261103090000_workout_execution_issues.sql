-- An equipment obstacle belongs to one execution; the prescription stays immutable.
alter table public.workout_sessions add column exercise_issues jsonb not null default '{}'::jsonb
  check (jsonb_typeof(exercise_issues) = 'object');

create function public.sync_workout_day_session_v3(p_operation_id uuid, p_session_id uuid,
  p_version_id uuid, p_revision integer, p_entries jsonb, p_status text,
  p_day_id uuid, p_week_start date, p_client_started_at timestamptz,
  p_client_finished_at timestamptz, p_elapsed_seconds integer,
  p_exercise_swaps jsonb, p_exercise_issues jsonb) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_applied boolean; v_version public.workout_plan_versions%rowtype;
  v_key text; v_value jsonb; v_previous jsonb; v_entry jsonb;
begin
  if jsonb_typeof(p_exercise_issues) <> 'object' or
    (select count(*) from jsonb_object_keys(p_exercise_issues)) > 30 then
    raise exception 'invalid exercise issues' using errcode = '22023';
  end if;
  v_applied := public.sync_workout_day_session_v2(p_operation_id,p_session_id,p_version_id,
    p_revision,p_entries,p_status,p_day_id,p_week_start,p_client_started_at,
    p_client_finished_at,p_elapsed_seconds,p_exercise_swaps);
  select * into v_version from public.workout_plan_versions where id = p_version_id;
  for v_key, v_value in select key, value from jsonb_each(p_exercise_issues) loop
    if jsonb_typeof(v_value) <> 'string' or v_value #>> '{}' <> 'APARELHO_INDISPONIVEL'
      or not exists (select 1 from jsonb_array_elements(v_version.snapshot->'days') day,
        jsonb_array_elements(day->'items') item
        where day->>'id' = p_day_id::text and item->>'id' = v_key)
      or p_exercise_swaps ? v_key
      then raise exception 'invalid exercise issue' using errcode = '22023'; end if;
  end loop;
  if not v_applied then
    select exercise_issues into v_previous from public.workout_sessions where id = p_session_id;
    if v_previous is distinct from p_exercise_issues then
      raise exception 'operation conflict' using errcode = '23505'; end if;
    return false;
  end if;
  select exercise_issues into v_previous from public.workout_sessions where id = p_session_id for update;
  for v_entry in select value from jsonb_array_elements(p_entries) loop
    if v_previous->(v_entry->>'itemId') is distinct from p_exercise_issues->(v_entry->>'itemId') then
      raise exception 'recorded exercise issue cannot change' using errcode = '23505'; end if;
  end loop;
  update public.workout_sessions set exercise_issues = p_exercise_issues where id = p_session_id;
  return true;
end $$;
revoke all on function public.sync_workout_day_session_v3(uuid,uuid,uuid,integer,jsonb,text,uuid,date,timestamptz,timestamptz,integer,jsonb,jsonb) from public, anon;
grant execute on function public.sync_workout_day_session_v3(uuid,uuid,uuid,integer,jsonb,text,uuid,date,timestamptz,timestamptz,integer,jsonb,jsonb) to authenticated;
