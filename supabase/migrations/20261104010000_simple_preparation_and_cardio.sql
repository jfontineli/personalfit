-- One-tap preparation and prescribed cardio. Published versions remain immutable.
alter table public.exercise_library drop constraint exercise_library_muscle_group_check;
alter table public.exercise_library add constraint exercise_library_muscle_group_check
  check (muscle_group in ('MOBILIDADE','PEITO','COSTAS','OMBROS','BRACOS','PERNAS','POSTERIOR_GLUTEOS','PANTURRILHAS','CORE','CARDIO','OUTROS'));

create or replace function public.publish_workout_plan(p_plan_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_plan public.workout_plans%rowtype; v_day jsonb; v_item jsonb; v_label jsonb; v_ex public.exercise_library%rowtype;
  v_alt_id jsonb; v_alt public.exercise_library%rowtype; v_alternatives jsonb;
  v_days jsonb := '[]'::jsonb; v_items jsonb; v_number integer; v_id uuid; v_sets integer; v_rest integer;
begin
  select * into v_plan from public.workout_plans where id = p_plan_id for update;
  if not found or not public.tenant_access_allowed(v_plan.tenant_id) or not exists (
    select 1 from public.tenant_memberships m join public.user_profiles p on p.user_id = m.user_id
    where m.tenant_id = v_plan.tenant_id and m.user_id = auth.uid() and m.active and p.active and m.role = 'PROFISSIONAL'
  ) then raise exception 'not authorized' using errcode = '42501'; end if;
  if not exists (select 1 from public.students where id = v_plan.student_id and tenant_id = v_plan.tenant_id and status = 'ACTIVE')
    then raise exception 'student inactive' using errcode = '22023'; end if;
  if jsonb_typeof(v_plan.draft->'days') <> 'array' or jsonb_array_length(v_plan.draft->'days') not between 1 and 7
    or length(coalesce(v_plan.draft->>'guidance','')) > 4000 or length(coalesce(v_plan.draft->>'importantNote','')) > 500
    or ((v_plan.draft ? 'startsOn') <> (v_plan.draft ? 'durationWeeks'))
    or (v_plan.draft ? 'startsOn' and (coalesce(v_plan.draft->>'startsOn','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or coalesce(v_plan.draft->>'durationWeeks','') !~ '^([1-9]|[1-4][0-9]|5[0-2])$'))
    then raise exception 'invalid workout days' using errcode = '22023'; end if;
  for v_day in select value from jsonb_array_elements(v_plan.draft->'days') loop
    if coalesce(length(btrim(v_day->>'name')), 0) not between 1 and 80
      or jsonb_typeof(v_day->'items') <> 'array' or jsonb_array_length(v_day->'items') not between 1 and 30
      then raise exception 'invalid workout day' using errcode = '22023'; end if;
    v_items := '[]'::jsonb;
    for v_item in select value from jsonb_array_elements(v_day->'items') loop
      if coalesce(v_item->>'id','') !~ '^[0-9a-f-]{36}$' or coalesce(v_item->>'exerciseId','') !~ '^[0-9a-f-]{36}$'
        or coalesce(v_item->>'sets','') !~ '^[1-9][0-9]?$' or (v_item->>'sets')::integer > 12
        or coalesce(length(btrim(v_item->>'reps')), 0) not between 1 and 40 or length(coalesce(v_item->>'notes','')) > 1000
        then raise exception 'invalid workout item' using errcode = '22023'; end if;
      v_sets := (v_item->>'sets')::integer;
      if v_item ? 'targetKind' and v_item->>'targetKind' not in ('REPS','TIME') then raise exception 'invalid target kind' using errcode = '22023'; end if;
      if v_item ? 'recordingStyle' and v_item->>'recordingStyle' not in ('SERIES','PREPARATION','CARDIO') then raise exception 'invalid recording style' using errcode = '22023'; end if;
      if v_item ? 'restSeconds' and jsonb_typeof(v_item->'restSeconds') <> 'null' then
        if coalesce(v_item->>'restSeconds','') !~ '^[0-9]{1,3}$' then raise exception 'invalid rest period' using errcode = '22023'; end if;
        v_rest := (v_item->>'restSeconds')::integer;
        if v_rest > 600 then raise exception 'invalid rest period' using errcode = '22023'; end if;
      else v_rest := null; end if;
      if v_item ? 'setLabels' and jsonb_typeof(v_item->'setLabels') <> 'null' then
        if jsonb_typeof(v_item->'setLabels') <> 'array' or jsonb_array_length(v_item->'setLabels') <> v_sets
          then raise exception 'invalid set labels' using errcode = '22023'; end if;
        for v_label in select value from jsonb_array_elements(v_item->'setLabels') loop
          if jsonb_typeof(v_label) <> 'string' or length(btrim(v_label #>> '{}')) not between 1 and 80
            then raise exception 'invalid set label' using errcode = '22023'; end if;
        end loop;
      end if;
      select * into v_ex from public.exercise_library where id = (v_item->>'exerciseId')::uuid and tenant_id = v_plan.tenant_id;
      if not found then raise exception 'exercise unavailable' using errcode = '22023'; end if;
      if v_item->>'recordingStyle' = 'CARDIO' and (v_ex.muscle_group <> 'CARDIO' or v_sets <> 1
        or v_item->>'targetKind' <> 'TIME' or coalesce(v_item->>'cardioMinutes','') !~ '^([1-9]|[1-9][0-9]|1[0-9][0-9]|2[0-3][0-9]|240)$')
        then raise exception 'invalid cardio prescription' using errcode = '22023'; end if;
      v_alternatives := '[]'::jsonb;
      if v_item ? 'alternativeExerciseIds' then
        if jsonb_typeof(v_item->'alternativeExerciseIds') <> 'array' or jsonb_array_length(v_item->'alternativeExerciseIds') > 5
          then raise exception 'invalid alternatives' using errcode = '22023'; end if;
        for v_alt_id in select value from jsonb_array_elements(v_item->'alternativeExerciseIds') loop
          if jsonb_typeof(v_alt_id) <> 'string' or (v_alt_id #>> '{}') !~ '^[0-9a-f-]{36}$'
            or (v_alt_id #>> '{}') = v_ex.id::text
            or v_alternatives @> jsonb_build_array(jsonb_build_object('exerciseId',v_alt_id #>> '{}'))
            then raise exception 'invalid alternatives' using errcode = '22023'; end if;
          select * into v_alt from public.exercise_library where id = (v_alt_id #>> '{}')::uuid and tenant_id = v_plan.tenant_id;
          if not found then raise exception 'alternative unavailable' using errcode = '22023'; end if;
          v_alternatives := v_alternatives || jsonb_build_array(jsonb_build_object('exerciseId',v_alt.id,
            'name',v_alt.name,'instructions',v_alt.instructions,'videoUrl',v_alt.video_url));
        end loop;
      end if;
      v_items := v_items || jsonb_build_array(jsonb_build_object('id',v_item->>'id','exerciseId',v_ex.id,
        'name',v_ex.name,'instructions',v_ex.instructions,'videoUrl',v_ex.video_url,'alternatives',v_alternatives,
        'sets',v_sets,'reps',v_item->>'reps','notes',coalesce(v_item->>'notes',''),'cardioMinutes',v_item->'cardioMinutes',
        'restSeconds',v_rest,'recordingStyle',coalesce(v_item->>'recordingStyle',case when v_ex.name ~* '^alongamento' then 'PREPARATION' else 'SERIES' end),
        'targetKind',coalesce(v_item->>'targetKind',case when (v_item->>'reps') ~* '(seg|segundo)' then 'TIME' else 'REPS' end),
        'setLabels',coalesce(v_item->'setLabels','[]'::jsonb)));
    end loop;
    v_days := v_days || jsonb_build_array(jsonb_build_object('id',v_day->>'id','name',v_day->>'name','items',v_items));
  end loop;
  select coalesce(max(version_number), 0) + 1 into v_number from public.workout_plan_versions where plan_id = p_plan_id;
  insert into public.workout_plan_versions(tenant_id,plan_id,version_number,snapshot,published_by)
    values(v_plan.tenant_id,p_plan_id,v_number,jsonb_build_object('title',v_plan.title,'guidance',coalesce(v_plan.draft->>'guidance',''),
      'importantNote',coalesce(v_plan.draft->>'importantNote',''),'startsOn',v_plan.draft->>'startsOn',
      'durationWeeks',v_plan.draft->'durationWeeks','days',v_days),auth.uid()) returning id into v_id;
  insert into public.workout_assignments(tenant_id,student_id,version_id) values(v_plan.tenant_id,v_plan.student_id,v_id);
  insert into public.audit_events(tenant_id,actor_user_id,action,resource_id) values(v_plan.tenant_id,auth.uid(),'WORKOUT_PUBLISH',v_id);
  return v_id;
end $$;


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
        (v_item->>'recordingStyle' = 'PREPARATION' and v_entry - 'itemId' - 'setNumber' = '{"completed":true}'::jsonb)
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
      if v_item->>'recordingStyle' is distinct from 'PREPARATION' or v_entry - 'itemId' - 'setNumber' <> '{"completed":true}'::jsonb
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

