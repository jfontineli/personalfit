-- Preserve the imported source in the private draft. Published snapshots and
-- student RPC responses contain only notes explicitly selected for the student.
create or replace function public.nutrition_valid_draft(p_draft jsonb, p_publish boolean)
returns boolean language plpgsql immutable set search_path = '' as $$
declare v_meal jsonb; v_option jsonb; v_note jsonb; v_count integer;
  v_ids text[] := array[]::text[]; v_note_ids text[] := array[]::text[]; v_id text;
begin
  if p_draft is null or jsonb_typeof(p_draft) <> 'object'
    or pg_column_size(p_draft) > 65536 or jsonb_typeof(p_draft->'meals') <> 'array'
    or length(coalesce(p_draft->>'title','')) > 160
    or length(coalesce(p_draft->>'guidance','')) > 4000
    or (p_publish and length(btrim(coalesce(p_draft->>'title',''))) = 0)
    or (p_publish and p_draft #>> '{sourceImport,reviewRequired}' = 'true')
    then return false; end if;
  v_count := jsonb_array_length(p_draft->'meals');
  if v_count > 12 or (p_publish and v_count = 0) then return false; end if;
  for v_meal in select value from jsonb_array_elements(p_draft->'meals') loop
    v_id := v_meal->>'id';
    if jsonb_typeof(v_meal) <> 'object' or v_id is null or v_id !~ '^[0-9a-f-]{36}$'
      or v_id = any(v_ids) or length(coalesce(v_meal->>'name','')) > 100
      or (p_publish and length(btrim(coalesce(v_meal->>'name',''))) = 0)
      or length(coalesce(v_meal->>'time','')) > 20
      or (v_meal ? 'cycle' and v_meal->>'cycle' is not null and v_meal->>'cycle' not in ('ALTO','BAIXO'))
      or jsonb_typeof(v_meal->'options') <> 'array'
      or jsonb_array_length(v_meal->'options') > 8
      or (p_publish and jsonb_array_length(v_meal->'options') = 0) then return false; end if;
    v_ids := array_append(v_ids,v_id);
    for v_option in select value from jsonb_array_elements(v_meal->'options') loop
      if jsonb_typeof(v_option) <> 'object'
        or length(coalesce(v_option->>'label','')) > 100
        or length(coalesce(v_option->>'foods','')) > 2000
        or length(coalesce(v_option->>'notes','')) > 1000
        or (p_publish and (length(btrim(coalesce(v_option->>'label',''))) = 0
          or length(btrim(coalesce(v_option->>'foods',''))) = 0)) then return false; end if;
    end loop;
  end loop;
  if p_draft ? 'individualNotes' then
    if jsonb_typeof(p_draft->'individualNotes') <> 'array'
      or jsonb_array_length(p_draft->'individualNotes') > 80 then return false; end if;
    for v_note in select value from jsonb_array_elements(p_draft->'individualNotes') loop
      v_id := v_note->>'id';
      if jsonb_typeof(v_note) <> 'object' or v_id is null or v_id !~ '^[a-zA-Z0-9_-]{1,64}$'
        or v_id = any(v_note_ids)
        or coalesce(v_note->>'section','') not in ('info','meta','regra','supl','dica','cardio','observacoes','outro')
        or length(coalesce(v_note->>'item','')) > 160
        or length(coalesce(v_note->>'quantity','')) > 200
        or length(coalesce(v_note->>'note','')) > 2000
        or jsonb_typeof(v_note->'showToStudent') <> 'boolean'
        or (p_publish and v_note->>'showToStudent' = 'true' and length(btrim(coalesce(v_note->>'item',''))) = 0)
        then return false; end if;
      v_note_ids := array_append(v_note_ids,v_id);
    end loop;
  end if;
  return true;
end $$;

create function public.nutrition_public_snapshot(p_snapshot jsonb)
returns jsonb language sql immutable set search_path = '' as $$
  select (p_snapshot - 'sourceImport' - 'individualNotes') || jsonb_build_object(
    'individualNotes', coalesce((
      select jsonb_agg(n.note order by n.ordinality)
      from jsonb_array_elements(case when jsonb_typeof(p_snapshot->'individualNotes') = 'array'
        then p_snapshot->'individualNotes' else '[]'::jsonb end) with ordinality as n(note, ordinality)
      where n.note->>'showToStudent' = 'true'
    ), '[]'::jsonb)
  );
$$;
revoke all on function public.nutrition_public_snapshot(jsonb) from public, anon, authenticated;

create or replace function public.nutrition_publish(p_student_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_tenant uuid; v_draft jsonb; v_next integer;
begin
  select tenant_id into v_tenant from public.students where id = p_student_id;
  if v_tenant is null or not public.nutrition_nutritionist_allowed(v_tenant,p_student_id)
    then raise exception 'not authorized' using errcode = '42501'; end if;
  select draft into v_draft from public.nutrition_plans where tenant_id = v_tenant and student_id = p_student_id for update;
  if not found or not public.nutrition_valid_draft(v_draft,true)
    then raise exception 'complete meals before publishing' using errcode = '22023'; end if;
  select coalesce(max(version),0)+1 into v_next from public.nutrition_plan_versions
    where tenant_id = v_tenant and student_id = p_student_id;
  insert into public.nutrition_plan_versions(tenant_id,student_id,nutritionist_user_id,version,snapshot)
    values (v_tenant,p_student_id,auth.uid(),v_next,public.nutrition_public_snapshot(v_draft));
  insert into public.audit_events(tenant_id,actor_user_id,action,resource_id)
    values (v_tenant,auth.uid(),'NUTRITION_PUBLISH',p_student_id);
  return v_next;
end $$;

create or replace function public.nutrition_student_plan(p_student_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_tenant uuid; v_result jsonb;
begin
  select tenant_id into v_tenant from public.students where id = p_student_id;
  if v_tenant is null or not public.nutrition_student_allowed(v_tenant,p_student_id)
    then raise exception 'not authorized' using errcode = '42501'; end if;
  select jsonb_build_object('id',v.id,'version',v.version,
    'snapshot',public.nutrition_public_snapshot(v.snapshot),
    'published_at',v.published_at,'nutritionist_name',n.display_name,'crn',n.crn)
    into v_result from public.nutrition_plan_versions v
    join public.nutritionists n on n.tenant_id = v.tenant_id and n.user_id = v.nutritionist_user_id
    where v.tenant_id = v_tenant and v.student_id = p_student_id
    order by v.version desc limit 1;
  return v_result;
end $$;
