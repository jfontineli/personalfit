-- Accept one-tap completion for published legacy stretches with no prescribed load.
-- Their immutable snapshots remain unchanged; old measured entries remain valid.
create or replace function public.sync_workout_day_session_v2(p_operation_id uuid, p_session_id uuid,
  p_version_id uuid, p_revision integer, p_entries jsonb, p_status text,
  p_day_id uuid, p_week_start date, p_client_started_at timestamptz,
  p_client_finished_at timestamptz, p_elapsed_seconds integer, p_exercise_swaps jsonb) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_assignment public.workout_assignments%rowtype; v_version public.workout_plan_versions%rowtype;
  v_existing public.workout_sessions%rowtype; v_hash text; v_receipt text; v_entry jsonb;
  v_item jsonb; v_key text; v_value jsonb; v_swap_count integer;
begin
  if auth.uid() is null or p_operation_id is null or p_session_id is null or p_revision not between 1 and 100000
    or p_status not in ('IN_PROGRESS','PAUSED','COMPLETED','PARTIAL') or jsonb_typeof(p_entries) <> 'array'
    or jsonb_array_length(p_entries) > 200 or p_day_id is null or p_week_start is null
    or p_client_started_at is null or p_elapsed_seconds not between 0 and 172800
    or jsonb_typeof(p_exercise_swaps) <> 'object'
    or (p_status in ('COMPLETED','PARTIAL') and (p_client_finished_at is null or p_client_finished_at < p_client_started_at))
    or (p_status in ('IN_PROGRESS','PAUSED') and p_client_finished_at is not null)
    then raise exception 'invalid session' using errcode = '22023'; end if;
  select count(*) into v_swap_count from jsonb_object_keys(p_exercise_swaps);
  if v_swap_count > 30 then raise exception 'invalid exercise swaps' using errcode = '22023'; end if;
  select * into v_assignment from public.workout_assignments where version_id = p_version_id order by assigned_at desc limit 1;
  if not found or not public.tenant_access_allowed(v_assignment.tenant_id) or not exists (
    select 1 from public.students s join public.tenant_memberships m on m.tenant_id = s.tenant_id and m.user_id = s.user_id
      join public.user_profiles p on p.user_id = s.user_id
    where s.id = v_assignment.student_id and s.tenant_id = v_assignment.tenant_id and s.user_id = auth.uid()
      and s.status = 'ACTIVE' and m.active and m.role = 'ALUNO' and p.active
  ) then raise exception 'not authorized' using errcode = '42501'; end if;
  select * into v_version from public.workout_plan_versions where id = p_version_id;
  if not exists (select 1 from jsonb_array_elements(v_version.snapshot->'days') day where day->>'id' = p_day_id::text)
    or not (case when v_version.snapshot->>'startsOn' is not null
      then p_week_start >= (v_version.snapshot->>'startsOn')::date
        and p_week_start < (v_version.snapshot->>'startsOn')::date + 7 * (v_version.snapshot->>'durationWeeks')::integer
        and ((p_week_start - (v_version.snapshot->>'startsOn')::date) % 7 = 0)
      else extract(isodow from p_week_start) = 1 end)
    then raise exception 'invalid workout cycle week' using errcode = '22023'; end if;
  for v_key, v_value in select key, value from jsonb_each(p_exercise_swaps) loop
    select item into v_item from jsonb_array_elements(v_version.snapshot->'days') day,
      jsonb_array_elements(day->'items') item where day->>'id' = p_day_id::text and item->>'id' = v_key;
    if v_item is null or jsonb_typeof(v_value) <> 'string' or not exists (
      select 1 from jsonb_array_elements(coalesce(v_item->'alternatives','[]'::jsonb)) alt
      where alt->>'exerciseId' = v_value #>> '{}')
      then raise exception 'unapproved exercise swap' using errcode = '22023'; end if;
  end loop;
  for v_entry in select value from jsonb_array_elements(p_entries) loop
    select item into v_item from jsonb_array_elements(v_version.snapshot->'days') day,
      jsonb_array_elements(day->'items') item where day->>'id' = p_day_id::text and item->>'id' = v_entry->>'itemId';
    if jsonb_typeof(v_entry) <> 'object' or coalesce(v_entry->>'setNumber','') !~ '^[1-9][0-9]?$'
      or v_item is null
      or not (
        ((v_item->>'recordingStyle' = 'PREPARATION' or (not v_item ? 'recordingStyle' and v_item->>'name' ~* '^alongamento' and coalesce(v_item->>'loadHintKg','') = '')) and v_entry - 'itemId' - 'setNumber' = '{"completed":true}'::jsonb)
        or (not v_entry ? 'completed' and
          ((coalesce(v_entry->>'reps','') ~ '^[1-9][0-9]{0,2}$' and not v_entry ? 'durationSeconds')
          or (coalesce(v_entry->>'durationSeconds','') ~ '^[1-9][0-9]{0,4}$' and (v_entry->>'durationSeconds')::integer <=
            case when v_item->>'recordingStyle' = 'CARDIO' then 14400 else 3600 end and not v_entry ? 'reps')))
      )
      or (v_entry ? 'loadKg' and coalesce(v_entry->>'loadKg','') !~ '^[0-9]{1,4}(\.[0-9]{1,2})?$')
      then raise exception 'invalid session entry' using errcode = '22023'; end if;
  end loop;
  v_hash := encode(extensions.digest(concat_ws('|',p_session_id,p_version_id,p_revision,p_entries::text,p_status,
    p_day_id,p_week_start,p_client_started_at,p_client_finished_at,p_elapsed_seconds,p_exercise_swaps::text),'sha256'),'hex');
  select request_hash into v_receipt from public.workout_operation_receipts where operation_id = p_operation_id;
  if found then
    if v_receipt <> v_hash then raise exception 'operation conflict' using errcode = '23505'; end if;
    return false;
  end if;
  select * into v_existing from public.workout_sessions where id = p_session_id for update;
  if found then
    if v_existing.student_id <> v_assignment.student_id or v_existing.version_id <> p_version_id
      or v_existing.day_id is distinct from p_day_id or v_existing.week_start is distinct from p_week_start
      or v_existing.status in ('COMPLETED','PARTIAL') or p_revision <= v_existing.revision
      or (v_existing.client_started_at is not null and v_existing.client_started_at <> p_client_started_at)
      or p_elapsed_seconds < v_existing.elapsed_seconds
      then raise exception 'session conflict' using errcode = '23505'; end if;
    for v_entry in select value from jsonb_array_elements(v_existing.entries) loop
      if v_existing.exercise_swaps->(v_entry->>'itemId') is distinct from p_exercise_swaps->(v_entry->>'itemId')
        then raise exception 'recorded exercise cannot change' using errcode = '23505'; end if;
    end loop;
    update public.workout_sessions set revision = p_revision, entries = p_entries, status = p_status,
      client_started_at = p_client_started_at, client_finished_at = p_client_finished_at,
      elapsed_seconds = p_elapsed_seconds, exercise_swaps = p_exercise_swaps, updated_at = now() where id = p_session_id;
  else
    if p_revision <> 1 then raise exception 'session conflict' using errcode = '23505'; end if;
    insert into public.workout_sessions(id,tenant_id,student_id,version_id,day_id,week_start,revision,entries,status,
      client_started_at,client_finished_at,elapsed_seconds,exercise_swaps)
      values(p_session_id,v_assignment.tenant_id,v_assignment.student_id,p_version_id,p_day_id,p_week_start,p_revision,p_entries,p_status,
        p_client_started_at,p_client_finished_at,p_elapsed_seconds,p_exercise_swaps);
  end if;
  insert into public.workout_operation_receipts(operation_id,session_id,request_hash) values(p_operation_id,p_session_id,v_hash);
  return true;
end $$;

create or replace function public.validate_prescribed_workout_sets() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_entry jsonb; v_item jsonb; v_seen jsonb := '{}'::jsonb; v_key text; v_timed boolean;
begin
  for v_entry in select value from jsonb_array_elements(new.entries) loop
    if coalesce(v_entry->>'itemId', '') !~ '^[0-9a-f-]{36}$'
      or coalesce(v_entry->>'setNumber', '') !~ '^[1-9][0-9]?$'
      then raise exception 'invalid prescribed set' using errcode = '22023'; end if;
    if v_entry ? 'rir' and coalesce(v_entry->>'rir','') !~ '^(10|[0-9])$'
      then raise exception 'invalid RIR' using errcode = '22023'; end if;
    select item into v_item from public.workout_plan_versions v,
      jsonb_array_elements(v.snapshot->'days') day,
      jsonb_array_elements(day->'items') item
      where v.id = new.version_id and item->>'id' = v_entry->>'itemId';
    if v_item is null or (v_entry->>'setNumber')::integer > (v_item->>'sets')::integer
      then raise exception 'set exceeds prescription' using errcode = '22023'; end if;
    v_timed := case when v_item->>'targetKind' = 'TIME' then true
      when v_item->>'targetKind' = 'REPS' then false
      else (coalesce(v_item->>'reps','') || ' ' || coalesce(v_item->'setLabels'->((v_entry->>'setNumber')::integer - 1) #>> '{}','')) ~* '(seg|segundo)' end;
    if v_entry ? 'completed' then
      if not (v_item->>'recordingStyle' = 'PREPARATION' or (not v_item ? 'recordingStyle' and v_item->>'name' ~* '^alongamento' and coalesce(v_item->>'loadHintKg','') = '')) or v_entry - 'itemId' - 'setNumber' <> '{"completed":true}'::jsonb
        then raise exception 'invalid preparation completion' using errcode = '22023'; end if;
    elsif (v_timed and (not v_entry ? 'durationSeconds' or v_entry ? 'reps'))
      or (not v_timed and (not v_entry ? 'reps' or v_entry ? 'durationSeconds'))
      then raise exception 'recorded unit differs from prescription' using errcode = '22023'; end if;
    if v_item->>'recordingStyle' in ('PREPARATION','CARDIO') and (v_entry ? 'loadKg' or v_entry ? 'rir') then raise exception 'activity does not record load or RIR' using errcode = '22023'; end if;
    if v_item->>'recordingStyle' = 'CARDIO' and (v_entry ? 'reps' or coalesce(v_entry->>'durationSeconds','') !~ '^[1-9][0-9]{0,4}$'
      or (v_entry->>'durationSeconds')::integer > 14400) then raise exception 'invalid cardio duration' using errcode = '22023'; end if;
    v_key := (v_entry->>'itemId') || ':' || (v_entry->>'setNumber');
    if v_seen ? v_key then raise exception 'duplicate session set' using errcode = '22023'; end if;
    v_seen := v_seen || jsonb_build_object(v_key, true);
  end loop;
  return new;
end $$;


