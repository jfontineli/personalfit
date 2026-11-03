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
  if p_day_id is null or p_week_start is null or extract(isodow from p_week_start) <> 1
    then raise exception 'invalid workout day or week' using errcode = '22023'; end if;
  if not exists (select 1 from public.workout_plan_versions v,
    jsonb_array_elements(v.snapshot->'days') day
    where v.id = p_version_id and day->>'id' = p_day_id::text)
    then raise exception 'invalid workout day or week' using errcode = '22023'; end if;
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
