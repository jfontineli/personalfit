-- Preserve queued operations created by the previous client, which accepted zero repetitions.
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
      or not ((coalesce(v_entry->>'reps','') ~ '^[0-9]{1,3}$' and not v_entry ? 'durationSeconds')
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
