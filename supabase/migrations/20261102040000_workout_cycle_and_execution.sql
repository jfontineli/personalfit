-- Preserve student-specific guidance and the role of each prescribed set in the immutable snapshot.
create or replace function public.publish_workout_plan(p_plan_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_plan public.workout_plans%rowtype; v_day jsonb; v_item jsonb; v_label jsonb; v_ex public.exercise_library%rowtype;
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
    or length(coalesce(v_plan.draft->>'guidance','')) > 4000
    or length(coalesce(v_plan.draft->>'importantNote','')) > 500
    or ((v_plan.draft ? 'startsOn') <> (v_plan.draft ? 'durationWeeks'))
    or (v_plan.draft ? 'startsOn' and (coalesce(v_plan.draft->>'startsOn','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or coalesce(v_plan.draft->>'durationWeeks','') !~ '^([1-9]|[1-4][0-9]|5[0-2])$'))
    then raise exception 'invalid workout days' using errcode = '22023'; end if;
  for v_day in select value from jsonb_array_elements(v_plan.draft->'days') loop
    if coalesce(length(btrim(v_day->>'name')), 0) not between 1 and 80
      or jsonb_typeof(v_day->'items') <> 'array' or jsonb_array_length(v_day->'items') not between 1 and 30
      then raise exception 'invalid workout day' using errcode = '22023'; end if;
    v_items := '[]'::jsonb;
    for v_item in select value from jsonb_array_elements(v_day->'items') loop
      if coalesce(v_item->>'id','') !~ '^[0-9a-f-]{36}$'
        or coalesce(v_item->>'exerciseId','') !~ '^[0-9a-f-]{36}$'
        or coalesce(v_item->>'sets','') !~ '^[1-9][0-9]?$'
        or (v_item->>'sets')::integer > 12
        or coalesce(length(btrim(v_item->>'reps')), 0) not between 1 and 40
        or length(coalesce(v_item->>'notes','')) > 1000
        then raise exception 'invalid workout item' using errcode = '22023'; end if;
      v_sets := (v_item->>'sets')::integer;
      if v_item ? 'targetKind' and v_item->>'targetKind' not in ('REPS','TIME') then raise exception 'invalid target kind' using errcode = '22023'; end if;
      if v_item ? 'restSeconds' and jsonb_typeof(v_item->'restSeconds') <> 'null' then
        if coalesce(v_item->>'restSeconds','') !~ '^[0-9]{1,3}$'
          then raise exception 'invalid rest period' using errcode = '22023'; end if;
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
      v_items := v_items || jsonb_build_array(jsonb_build_object('id',v_item->>'id','exerciseId',v_ex.id,
        'name',v_ex.name,'instructions',v_ex.instructions,'videoUrl',v_ex.video_url,
        'sets',v_sets,'reps',v_item->>'reps','notes',coalesce(v_item->>'notes',''),
        'restSeconds',v_rest,'targetKind',coalesce(v_item->>'targetKind',case when (v_item->>'reps') ~* '(seg|segundo)' then 'TIME' else 'REPS' end),'setLabels',coalesce(v_item->'setLabels','[]'::jsonb)));
    end loop;
    v_days := v_days || jsonb_build_array(jsonb_build_object('id',v_day->>'id','name',v_day->>'name','items',v_items));
  end loop;
  select coalesce(max(version_number), 0) + 1 into v_number from public.workout_plan_versions where plan_id = p_plan_id;
  insert into public.workout_plan_versions(tenant_id,plan_id,version_number,snapshot,published_by)
    values(v_plan.tenant_id,p_plan_id,v_number,jsonb_build_object('title',v_plan.title,'guidance',coalesce(v_plan.draft->>'guidance',''),'importantNote',coalesce(v_plan.draft->>'importantNote',''),'startsOn',v_plan.draft->>'startsOn','durationWeeks',v_plan.draft->'durationWeeks','days',v_days),auth.uid()) returning id into v_id;
  insert into public.workout_assignments(tenant_id,student_id,version_id)
    values(v_plan.tenant_id,v_plan.student_id,v_id);
  insert into public.audit_events(tenant_id,actor_user_id,action,resource_id)
    values(v_plan.tenant_id,auth.uid(),'WORKOUT_PUBLISH',v_id);
  return v_id;
end $$;




-- A partial execution is a terminal historical outcome, never a completed day.
alter table public.workout_sessions drop constraint workout_sessions_status_check;
alter table public.workout_sessions add constraint workout_sessions_status_check check (status in ('IN_PROGRESS','COMPLETED','PARTIAL'));
create or replace function public.sync_workout_session(p_operation_id uuid, p_session_id uuid,
  p_version_id uuid, p_revision integer, p_entries jsonb, p_status text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_assignment public.workout_assignments%rowtype; v_existing public.workout_sessions%rowtype;
  v_hash text; v_receipt text; v_entry jsonb; v_valid_items jsonb;
begin
  if auth.uid() is null or p_operation_id is null or p_session_id is null or p_revision not between 1 and 100000
    or p_status not in ('IN_PROGRESS','COMPLETED','PARTIAL') or jsonb_typeof(p_entries) <> 'array'
    or jsonb_array_length(p_entries) > 200
    then raise exception 'invalid session' using errcode = '22023'; end if;
  select * into v_assignment from public.workout_assignments where version_id = p_version_id
    order by assigned_at desc limit 1;
  if not found or not public.tenant_access_allowed(v_assignment.tenant_id) or not exists (
    select 1 from public.students s join public.tenant_memberships m
      on m.tenant_id = s.tenant_id and m.user_id = s.user_id
      join public.user_profiles p on p.user_id = s.user_id
      where s.id = v_assignment.student_id and s.tenant_id = v_assignment.tenant_id
        and s.user_id = auth.uid() and s.status = 'ACTIVE' and m.active and m.role = 'ALUNO' and p.active
  ) then raise exception 'not authorized' using errcode = '42501'; end if;
  select jsonb_agg(item->>'id') into v_valid_items from public.workout_plan_versions v,
    jsonb_array_elements(v.snapshot->'days') day,
    jsonb_array_elements(day->'items') item where v.id = p_version_id;
  for v_entry in select value from jsonb_array_elements(p_entries) loop
    if jsonb_typeof(v_entry) <> 'object' or not coalesce(v_valid_items ? (v_entry->>'itemId'), false)
      or coalesce(v_entry->>'setNumber','') !~ '^[1-9][0-9]?$'
      or not ((coalesce(v_entry->>'reps','') ~ '^[1-9][0-9]{0,2}$' and not v_entry ? 'durationSeconds')
        or (coalesce(v_entry->>'durationSeconds','') ~ '^([1-9][0-9]{0,2}|[1-2][0-9]{3}|3[0-5][0-9]{2}|3600)$' and not v_entry ? 'reps'))
      or (v_entry ? 'loadKg' and coalesce(v_entry->>'loadKg','') !~ '^[0-9]{1,4}(\.[0-9]{1,2})?$')
      then raise exception 'invalid session entry' using errcode = '22023'; end if;
  end loop;
  v_hash := encode(extensions.digest(concat_ws('|',p_session_id,p_version_id,p_revision,p_entries::text,p_status),'sha256'),'hex');
  select request_hash into v_receipt from public.workout_operation_receipts where operation_id = p_operation_id;
  if found then
    if v_receipt <> v_hash then raise exception 'operation conflict' using errcode = '23505'; end if;
    return false;
  end if;
  select * into v_existing from public.workout_sessions where id = p_session_id for update;
  if found then
    if v_existing.student_id <> v_assignment.student_id or v_existing.version_id <> p_version_id
      or v_existing.status in ('COMPLETED','PARTIAL') or p_revision <= v_existing.revision
      then raise exception 'session conflict' using errcode = '23505'; end if;
    update public.workout_sessions set revision = p_revision, entries = p_entries,
      status = p_status, updated_at = now() where id = p_session_id;
  else
    if p_revision <> 1 then raise exception 'session conflict' using errcode = '23505'; end if;
    insert into public.workout_sessions(id,tenant_id,student_id,version_id,revision,entries,status)
      values(p_session_id,v_assignment.tenant_id,v_assignment.student_id,p_version_id,p_revision,p_entries,p_status);
  end if;
  insert into public.workout_operation_receipts(operation_id,session_id,request_hash)
    values(p_operation_id,p_session_id,v_hash);
  return true;
end $$;


-- Reject callers without an active student assignment before checking day IDs.
create or replace function public.sync_workout_day_session(p_operation_id uuid, p_session_id uuid,
  p_version_id uuid, p_revision integer, p_entries jsonb, p_status text,
  p_day_id uuid, p_week_start date) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_existing public.workout_sessions%rowtype; v_applied boolean;
begin
  if auth.uid() is null or not exists (
    select 1 from public.workout_assignments a
      join public.students s on s.id = a.student_id and s.tenant_id = a.tenant_id
      join public.tenant_memberships m on m.tenant_id = s.tenant_id and m.user_id = s.user_id
      join public.user_profiles p on p.user_id = s.user_id
    where a.version_id = p_version_id and s.user_id = auth.uid() and s.status = 'ACTIVE'
      and m.active and m.role = 'ALUNO' and p.active
      and public.tenant_access_allowed(a.tenant_id)
  ) then raise exception 'not authorized' using errcode = '42501'; end if;
  if p_day_id is null or p_week_start is null
    then raise exception 'invalid workout day or week' using errcode = '22023'; end if;
  if not exists (select 1 from public.workout_plan_versions v,
    jsonb_array_elements(v.snapshot->'days') day
    where v.id = p_version_id and day->>'id' = p_day_id::text)
    then raise exception 'invalid workout day or week' using errcode = '22023'; end if;
  if not exists (select 1 from public.workout_plan_versions v where v.id = p_version_id and (case when v.snapshot->>'startsOn' is not null then p_week_start >= (v.snapshot->>'startsOn')::date and p_week_start < (v.snapshot->>'startsOn')::date + 7 * (v.snapshot->>'durationWeeks')::integer and ((p_week_start - (v.snapshot->>'startsOn')::date) % 7 = 0) else extract(isodow from p_week_start) = 1 end)) then raise exception 'invalid workout cycle week' using errcode = '22023'; end if;
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
  v_applied := public.sync_workout_session(p_operation_id, p_session_id, p_version_id,
    p_revision, p_entries, p_status);
  if v_applied then
    update public.workout_sessions set day_id = p_day_id, week_start = p_week_start
      where id = p_session_id and day_id is null;
  end if;
  return v_applied;
end $$;

-- Validate the recorded unit against the immutable prescription, including legacy timed labels.
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
    if (v_timed and (not v_entry ? 'durationSeconds' or v_entry ? 'reps'))
      or (not v_timed and (not v_entry ? 'reps' or v_entry ? 'durationSeconds'))
      then raise exception 'recorded unit differs from prescription' using errcode = '22023'; end if;
    v_key := (v_entry->>'itemId') || ':' || (v_entry->>'setNumber');
    if v_seen ? v_key then raise exception 'duplicate session set' using errcode = '22023'; end if;
    v_seen := v_seen || jsonb_build_object(v_key, true);
  end loop;
  return new;
end $$;

create or replace function public.validate_workout_session_day() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_entry jsonb; v_snapshot jsonb; v_expected integer;
begin
  if tg_op = 'UPDATE' and old.day_id is not null
    and (new.day_id is distinct from old.day_id or new.week_start is distinct from old.week_start)
    then raise exception 'session day cannot change' using errcode = '23505'; end if;
  if new.day_id is null then return new; end if;
  select snapshot into v_snapshot from public.workout_plan_versions where id = new.version_id;
  if new.week_start is null or not exists (
    select 1 from jsonb_array_elements(v_snapshot->'days') day where day->>'id' = new.day_id::text)
    or not (case when v_snapshot->>'startsOn' is not null
      then new.week_start >= (v_snapshot->>'startsOn')::date
        and new.week_start < (v_snapshot->>'startsOn')::date + 7 * (v_snapshot->>'durationWeeks')::integer
        and (new.week_start - (v_snapshot->>'startsOn')::date) % 7 = 0
      else extract(isodow from new.week_start) = 1 end)
    then raise exception 'invalid workout day or week' using errcode = '22023'; end if;
  for v_entry in select value from jsonb_array_elements(new.entries) loop
    if not exists (select 1 from jsonb_array_elements(v_snapshot->'days') day,
      jsonb_array_elements(day->'items') item
      where day->>'id' = new.day_id::text and item->>'id' = v_entry->>'itemId')
      then raise exception 'entry belongs to another workout day' using errcode = '22023'; end if;
  end loop;
  if new.status = 'COMPLETED' then
    select sum((item->>'sets')::integer) into v_expected
      from jsonb_array_elements(v_snapshot->'days') day,
      jsonb_array_elements(day->'items') item where day->>'id' = new.day_id::text;
    if jsonb_array_length(new.entries) <> v_expected
      then raise exception 'incomplete workout day' using errcode = '22023'; end if;
  end if;
  return new;
end $$;

drop trigger validate_workout_session_day_before_write on public.workout_sessions;
create trigger validate_workout_session_day_before_write
  before insert or update of entries, day_id, week_start, version_id, status on public.workout_sessions
  for each row execute function public.validate_workout_session_day();
