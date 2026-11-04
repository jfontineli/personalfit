-- Keep meal identifiers usable by the logging RPC and make concurrent retries idempotent.
create or replace function public.nutrition_valid_draft(p_draft jsonb, p_publish boolean)
returns boolean language plpgsql immutable set search_path = '' as $$
declare v_meal jsonb; v_option jsonb; v_count integer; v_ids text[] := array[]::text[]; v_id text;
begin
  if p_draft is null or jsonb_typeof(p_draft) <> 'object'
    or pg_column_size(p_draft) > 65536 or jsonb_typeof(p_draft->'meals') <> 'array'
    or length(coalesce(p_draft->>'title','')) > 160
    or length(coalesce(p_draft->>'guidance','')) > 4000
    or (p_publish and length(btrim(coalesce(p_draft->>'title',''))) = 0)
    then return false; end if;
  v_count := jsonb_array_length(p_draft->'meals');
  if v_count > 12 or (p_publish and v_count = 0) then return false; end if;
  for v_meal in select value from jsonb_array_elements(p_draft->'meals') loop
    v_id := v_meal->>'id';
    if jsonb_typeof(v_meal) <> 'object' or v_id is null
      or v_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or v_id = any(v_ids) or length(coalesce(v_meal->>'name','')) > 100
      or (p_publish and length(btrim(coalesce(v_meal->>'name',''))) = 0)
      or length(coalesce(v_meal->>'time','')) > 20
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
  return true;
end $$;

create or replace function public.nutrition_log_meal(p_operation_id uuid,p_student_id uuid,p_version_id uuid,
  p_meal_id uuid,p_performed_on date,p_state text,p_note text default '')
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_tenant uuid; v_snapshot jsonb; v_existing public.nutrition_meal_events%rowtype; v_id uuid;
begin
  select tenant_id into v_tenant from public.students where id = p_student_id;
  if v_tenant is null or not public.nutrition_student_allowed(v_tenant,p_student_id)
    then raise exception 'not authorized' using errcode = '42501'; end if;
  if p_operation_id is null or p_version_id is null or p_meal_id is null or p_performed_on is null
    or p_state not in ('FEITA','ADAPTADA','NAO_FEITA') or p_state is null
    or length(coalesce(p_note,'')) > 500 or p_performed_on > (now() at time zone 'America/Sao_Paulo')::date
    or p_performed_on < (now() at time zone 'America/Sao_Paulo')::date - 31
    then raise exception 'invalid meal log' using errcode = '22023'; end if;
  select snapshot into v_snapshot from public.nutrition_plan_versions
    where id = p_version_id and tenant_id = v_tenant and student_id = p_student_id;
  if v_snapshot is null or not exists (select 1 from jsonb_array_elements(v_snapshot->'meals') m where m->>'id' = p_meal_id::text)
    then raise exception 'meal not prescribed' using errcode = '22023'; end if;
  insert into public.nutrition_meal_events(operation_id,tenant_id,student_id,student_user_id,version_id,meal_id,performed_on,state,note)
    values (p_operation_id,v_tenant,p_student_id,auth.uid(),p_version_id,p_meal_id,p_performed_on,p_state,coalesce(p_note,''))
    on conflict (operation_id) do nothing returning id into v_id;
  if v_id is not null then return v_id; end if;
  select * into v_existing from public.nutrition_meal_events where operation_id = p_operation_id;
  if v_existing.student_user_id = auth.uid() and v_existing.tenant_id = v_tenant
    and v_existing.student_id = p_student_id and v_existing.version_id = p_version_id
    and v_existing.meal_id = p_meal_id and v_existing.performed_on = p_performed_on
    and v_existing.state = p_state and v_existing.note = coalesce(p_note,'') then return v_existing.id; end if;
  raise exception 'operation conflict' using errcode = '23505';
end $$;
