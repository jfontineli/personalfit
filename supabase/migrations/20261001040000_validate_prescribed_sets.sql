-- A session may only record the sets prescribed in its immutable version.
create function public.validate_prescribed_workout_sets() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_entry jsonb; v_max integer; v_seen jsonb := '{}'::jsonb; v_key text;
begin
  for v_entry in select value from jsonb_array_elements(new.entries) loop
    if coalesce(v_entry->>'itemId', '') !~ '^[0-9a-f-]{36}$'
      or coalesce(v_entry->>'setNumber', '') !~ '^[1-9][0-9]?$'
      then raise exception 'invalid prescribed set' using errcode = '22023'; end if;
    select (item->>'sets')::integer into v_max
      from public.workout_plan_versions v,
        jsonb_array_elements(v.snapshot->'days') day,
        jsonb_array_elements(day->'items') item
      where v.id = new.version_id and item->>'id' = v_entry->>'itemId';
    if v_max is null or (v_entry->>'setNumber')::integer > v_max
      then raise exception 'set exceeds prescription' using errcode = '22023'; end if;
    v_key := (v_entry->>'itemId') || ':' || (v_entry->>'setNumber');
    if v_seen ? v_key then raise exception 'duplicate session set' using errcode = '22023'; end if;
    v_seen := v_seen || jsonb_build_object(v_key, true);
  end loop;
  return new;
end $$;
create trigger validate_prescribed_workout_sets_before_write
  before insert or update of entries on public.workout_sessions
  for each row execute function public.validate_prescribed_workout_sets();
