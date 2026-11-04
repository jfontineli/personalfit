-- Diets may contain explicitly chosen high/low days. An imported clinical source
-- remains private until its assigned nutritionist marks the transcription reviewed.
create or replace function public.nutrition_valid_draft(p_draft jsonb, p_publish boolean)
returns boolean language plpgsql immutable set search_path = '' as $$
declare v_meal jsonb; v_option jsonb; v_count integer; v_ids text[] := array[]::text[]; v_id text;
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
  return true;
end $$;
