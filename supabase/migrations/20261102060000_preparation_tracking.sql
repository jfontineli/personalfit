-- Publish a preparation style chosen by the professional; keep old versions immutable.
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
      if v_item ? 'recordingStyle' and v_item->>'recordingStyle' not in ('SERIES','PREPARATION') then raise exception 'invalid recording style' using errcode = '22023'; end if;
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
        'restSeconds',v_rest,'recordingStyle',coalesce(v_item->>'recordingStyle',case when v_ex.name ~* '^alongamento' then 'PREPARATION' else 'SERIES' end),'targetKind',coalesce(v_item->>'targetKind',case when (v_item->>'reps') ~* '(seg|segundo)' then 'TIME' else 'REPS' end),'setLabels',coalesce(v_item->'setLabels','[]'::jsonb)));
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
    if v_item->>'recordingStyle' = 'PREPARATION' and (v_entry ? 'loadKg' or v_entry ? 'rir') then raise exception 'preparation does not record load or RIR' using errcode = '22023'; end if;
    v_key := (v_entry->>'itemId') || ':' || (v_entry->>'setNumber');
    if v_seen ? v_key then raise exception 'duplicate session set' using errcode = '22023'; end if;
    v_seen := v_seen || jsonb_build_object(v_key, true);
  end loop;
  return new;
end $$;
