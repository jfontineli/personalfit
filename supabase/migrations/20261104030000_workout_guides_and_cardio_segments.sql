-- Optional professional-authored guides and structured cardio intervals in immutable workout snapshots.
create or replace function public.workout_guides_valid(p_guides jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare v_key text; v_value jsonb; v_total integer := 0; v_count integer;
begin
  if p_guides is null then return true; end if;
  if jsonb_typeof(p_guides) <> 'object' then return false; end if;
  select count(*) into v_count from jsonb_object_keys(p_guides);
  if v_count > 8 then return false; end if;
  for v_key, v_value in select key, value from jsonb_each(p_guides) loop
    if v_key not in ('COMO_USAR','EXECUCAO','HIPOPRESSIVO','ACOMPANHAMENTO','GLOSSARIO','ACESSORIOS','INDICACOES','CONTATO')
      or jsonb_typeof(v_value) <> 'string' or length(btrim(v_value #>> '{}')) > 3000 then return false; end if;
    v_total := v_total + length(v_value #>> '{}');
  end loop;
  return v_total <= 10000;
end $$;

create or replace function public.workout_cardio_steps_valid(p_steps jsonb, p_minutes integer) returns boolean
language plpgsql immutable set search_path = '' as $$
declare v_step jsonb; v_previous integer := 0; v_end integer;
begin
  if p_steps is null then return true; end if;
  if jsonb_typeof(p_steps) <> 'array' or jsonb_array_length(p_steps) not between 1 and 24
    or p_minutes not between 1 and 240 then return false; end if;
  for v_step in select value from jsonb_array_elements(p_steps) loop
    if jsonb_typeof(v_step) <> 'object' or v_step - 'startMinute' - 'endMinute' - 'inclinePercent' - 'speedKmh' <> '{}'::jsonb
      or coalesce(v_step->>'startMinute','') !~ '^(0|[1-9][0-9]{0,2})$'
      or coalesce(v_step->>'endMinute','') !~ '^([1-9]|[1-9][0-9]|1[0-9][0-9]|2[0-3][0-9]|240)$'
      or coalesce(v_step->>'inclinePercent','') !~ '^([0-9]|[12][0-9]|30)(\.[0-9])?$'
      or coalesce(v_step->>'speedKmh','') !~ '^([0-9]|[12][0-9]|30)(\.[0-9])?$'
      then return false; end if;
    v_end := (v_step->>'endMinute')::integer;
    if (v_step->>'startMinute')::integer <> v_previous or v_end <= v_previous or v_end > p_minutes
      or (v_step->>'inclinePercent')::numeric > 30 or (v_step->>'speedKmh')::numeric > 30
      then return false; end if;
    v_previous := v_end;
  end loop;
  return v_previous = p_minutes;
end $$;

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
  if not public.workout_guides_valid(v_plan.draft->'guides')
    then raise exception 'invalid workout guides' using errcode = '22023'; end if;
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
      if v_ex.muscle_group = 'CARDIO' and v_item->>'recordingStyle' is distinct from 'CARDIO'
        then raise exception 'cardio requires cardio style' using errcode = '22023'; end if;
      if v_item ? 'cardioSteps' and (v_item->>'recordingStyle' is distinct from 'CARDIO'
        or not public.workout_cardio_steps_valid(v_item->'cardioSteps',(v_item->>'cardioMinutes')::integer))
        then raise exception 'invalid cardio steps' using errcode = '22023'; end if;
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
        'cardioSteps',coalesce(v_item->'cardioSteps','[]'::jsonb),
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
      'durationWeeks',v_plan.draft->'durationWeeks','guides',coalesce(v_plan.draft->'guides','{}'::jsonb),
      'days',v_days),auth.uid()) returning id into v_id;
  insert into public.workout_assignments(tenant_id,student_id,version_id) values(v_plan.tenant_id,v_plan.student_id,v_id);
  insert into public.audit_events(tenant_id,actor_user_id,action,resource_id) values(v_plan.tenant_id,auth.uid(),'WORKOUT_PUBLISH',v_id);
  return v_id;
end $$;



