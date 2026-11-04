-- Optional reference targets are authored in the draft and frozen only when a
-- new version is published. Existing published versions remain untouched.
create function public.workout_version_reference_targets() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_draft jsonb; v_days jsonb := '[]'::jsonb; v_items jsonb;
  v_day jsonb; v_item jsonb; v_draft_day jsonb; v_draft_item jsonb;
begin
  select draft into v_draft from public.workout_plans where id = new.plan_id and tenant_id = new.tenant_id;
  for v_day in select value from jsonb_array_elements(new.snapshot->'days') loop
    select value into v_draft_day from jsonb_array_elements(v_draft->'days') where value->>'id' = v_day->>'id';
    v_items := '[]'::jsonb;
    for v_item in select value from jsonb_array_elements(v_day->'items') loop
      select value into v_draft_item from jsonb_array_elements(v_draft_day->'items') where value->>'id' = v_item->>'id';
      if v_draft_item ? 'loadHintKg' and jsonb_typeof(v_draft_item->'loadHintKg') <> 'null' then
        if jsonb_typeof(v_draft_item->'loadHintKg') <> 'number'
          or coalesce(v_draft_item->>'loadHintKg','') !~ '^[0-9]{1,4}(\.[0-9]{1,2})?$'
          or (v_draft_item->>'loadHintKg')::numeric > 9999
          then raise exception 'invalid reference load' using errcode = '22023'; end if;
        v_item := v_item || jsonb_build_object('loadHintKg',(v_draft_item->>'loadHintKg')::numeric);
      end if;
      if v_draft_item ? 'rirHint' and jsonb_typeof(v_draft_item->'rirHint') <> 'null' then
        if jsonb_typeof(v_draft_item->'rirHint') <> 'string' or length(v_draft_item->>'rirHint') > 30
          then raise exception 'invalid reference RIR' using errcode = '22023'; end if;
        v_item := v_item || jsonb_build_object('rirHint',v_draft_item->>'rirHint');
      end if;
      v_items := v_items || jsonb_build_array(v_item);
    end loop;
    v_days := v_days || jsonb_build_array(jsonb_set(v_day,'{items}',v_items));
  end loop;
  new.snapshot := jsonb_set(new.snapshot,'{days}',v_days);
  return new;
end $$;
create trigger workout_version_reference_targets_before_insert
  before insert on public.workout_plan_versions for each row
  execute function public.workout_version_reference_targets();
