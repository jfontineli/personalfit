-- First professional-authored workout slice. Existing identity and tenant data are preserved.
create table public.exercise_library (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  name text not null check (length(btrim(name)) between 1 and 160),
  instructions text not null default '' check (length(instructions) <= 4000),
  video_url text check (video_url is null or (length(video_url) <= 1000 and video_url ~ '^https://')),
  created_at timestamptz not null default now(),
  unique (tenant_id, id)
);
create index exercise_library_tenant_name on public.exercise_library(tenant_id, name);

create table public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  student_id uuid not null,
  title text not null check (length(btrim(title)) between 1 and 160),
  draft jsonb not null default '{"days":[]}'::jsonb
    check (jsonb_typeof(draft) = 'object' and length(draft::text) <= 50000),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, student_id),
  foreign key (tenant_id, student_id) references public.students(tenant_id, id)
);
create table public.workout_plan_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  plan_id uuid not null,
  version_number integer not null check (version_number > 0),
  snapshot jsonb not null,
  published_by uuid not null references auth.users(id),
  published_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (plan_id, version_number),
  foreign key (tenant_id, plan_id) references public.workout_plans(tenant_id, id)
);
create table public.workout_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  student_id uuid not null,
  version_id uuid not null,
  assigned_at timestamptz not null default now(),
  unique (tenant_id, student_id, version_id),
  foreign key (tenant_id, student_id) references public.students(tenant_id, id),
  foreign key (tenant_id, version_id) references public.workout_plan_versions(tenant_id, id)
);
create index workout_assignments_current on public.workout_assignments(tenant_id, student_id, assigned_at desc);
create table public.workout_sessions (
  id uuid primary key,
  tenant_id uuid not null,
  student_id uuid not null,
  version_id uuid not null,
  revision integer not null check (revision > 0),
  entries jsonb not null check (jsonb_typeof(entries) = 'array'),
  status text not null check (status in ('IN_PROGRESS', 'COMPLETED')),
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, student_id) references public.students(tenant_id, id),
  foreign key (tenant_id, version_id) references public.workout_plan_versions(tenant_id, id)
);
create index workout_sessions_student on public.workout_sessions(tenant_id, student_id, started_at desc);
create table public.workout_operation_receipts (
  operation_id uuid primary key,
  session_id uuid not null references public.workout_sessions(id),
  request_hash text not null,
  created_at timestamptz not null default now()
);

alter table public.exercise_library enable row level security;
alter table public.workout_plans enable row level security;
alter table public.workout_plan_versions enable row level security;
alter table public.workout_assignments enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.workout_operation_receipts enable row level security;
revoke all on public.exercise_library, public.workout_plans, public.workout_plan_versions,
  public.workout_assignments, public.workout_sessions, public.workout_operation_receipts from public, anon, authenticated;
grant select on public.exercise_library, public.workout_plans, public.workout_plan_versions,
  public.workout_assignments, public.workout_sessions to authenticated;
grant insert (tenant_id, name, instructions, video_url) on public.exercise_library to authenticated;
grant update (name, instructions, video_url) on public.exercise_library to authenticated;
grant insert (tenant_id, student_id, title, draft) on public.workout_plans to authenticated;
grant update (title, draft, updated_at) on public.workout_plans to authenticated;

create policy exercise_read on public.exercise_library for select to authenticated using (
  public.tenant_access_allowed(tenant_id) and exists (
    select 1 from public.tenant_memberships m join public.user_profiles p on p.user_id = m.user_id
    where m.tenant_id = exercise_library.tenant_id and m.user_id = (select auth.uid())
      and m.active and p.active and m.role = 'PROFISSIONAL'
  )
);
create policy exercise_write on public.exercise_library for insert to authenticated with check (
  public.tenant_access_allowed(tenant_id) and exists (
    select 1 from public.tenant_memberships m join public.user_profiles p on p.user_id = m.user_id
    where m.tenant_id = exercise_library.tenant_id and m.user_id = (select auth.uid())
      and m.active and p.active and m.role = 'PROFISSIONAL'
  )
);
create policy exercise_edit on public.exercise_library for update to authenticated
  using (public.tenant_access_allowed(tenant_id) and exists (
    select 1 from public.tenant_memberships m join public.user_profiles p on p.user_id = m.user_id
    where m.tenant_id = exercise_library.tenant_id and m.user_id = (select auth.uid())
      and m.active and p.active and m.role = 'PROFISSIONAL'
  ))
  with check (public.tenant_access_allowed(tenant_id) and exists (
    select 1 from public.tenant_memberships m join public.user_profiles p on p.user_id = m.user_id
    where m.tenant_id = exercise_library.tenant_id and m.user_id = (select auth.uid())
      and m.active and p.active and m.role = 'PROFISSIONAL'
  ));
create policy plan_professional on public.workout_plans for all to authenticated
  using (public.tenant_access_allowed(tenant_id) and exists (
    select 1 from public.tenant_memberships m join public.user_profiles p on p.user_id = m.user_id
    where m.tenant_id = workout_plans.tenant_id and m.user_id = (select auth.uid())
      and m.active and p.active and m.role = 'PROFISSIONAL'
  ))
  with check (public.tenant_access_allowed(tenant_id) and exists (
    select 1 from public.tenant_memberships m join public.user_profiles p on p.user_id = m.user_id
    where m.tenant_id = workout_plans.tenant_id and m.user_id = (select auth.uid())
      and m.active and p.active and m.role = 'PROFISSIONAL'
  ));
create policy version_read on public.workout_plan_versions for select to authenticated using (
  public.tenant_access_allowed(tenant_id) and (
    exists (select 1 from public.tenant_memberships m join public.user_profiles p on p.user_id = m.user_id
      where m.tenant_id = workout_plan_versions.tenant_id and m.user_id = (select auth.uid())
        and m.active and p.active and m.role = 'PROFISSIONAL')
    or exists (select 1 from public.workout_assignments a join public.students s
      on s.tenant_id = a.tenant_id and s.id = a.student_id
      join public.tenant_memberships m on m.tenant_id = s.tenant_id and m.user_id = s.user_id
      join public.user_profiles p on p.user_id = s.user_id
      where a.version_id = workout_plan_versions.id and s.user_id = (select auth.uid())
        and s.status = 'ACTIVE' and m.active and m.role = 'ALUNO' and p.active)
  )
);
create policy assignment_read on public.workout_assignments for select to authenticated using (
  public.tenant_access_allowed(tenant_id) and (
    exists (select 1 from public.tenant_memberships m join public.user_profiles p on p.user_id = m.user_id
      where m.tenant_id = workout_assignments.tenant_id and m.user_id = (select auth.uid())
        and m.active and p.active and m.role = 'PROFISSIONAL')
    or exists (select 1 from public.students s join public.tenant_memberships m
      on m.tenant_id = s.tenant_id and m.user_id = s.user_id
      join public.user_profiles p on p.user_id = s.user_id
      where s.id = workout_assignments.student_id and s.tenant_id = workout_assignments.tenant_id
        and s.user_id = (select auth.uid()) and s.status = 'ACTIVE' and m.active and m.role = 'ALUNO' and p.active)
  )
);
create policy session_read on public.workout_sessions for select to authenticated using (
  public.tenant_access_allowed(tenant_id) and (
    exists (select 1 from public.tenant_memberships m join public.user_profiles p on p.user_id = m.user_id
      where m.tenant_id = workout_sessions.tenant_id and m.user_id = (select auth.uid())
        and m.active and p.active and m.role = 'PROFISSIONAL')
    or exists (select 1 from public.students s join public.tenant_memberships m
      on m.tenant_id = s.tenant_id and m.user_id = s.user_id
      join public.user_profiles p on p.user_id = s.user_id
      where s.id = workout_sessions.student_id and s.tenant_id = workout_sessions.tenant_id
        and s.user_id = (select auth.uid()) and s.status = 'ACTIVE' and m.active and m.role = 'ALUNO' and p.active)
  )
);

-- Resolve all exercise fields at publication so future library edits cannot rewrite history.
create function public.publish_workout_plan(p_plan_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_plan public.workout_plans%rowtype; v_day jsonb; v_item jsonb; v_ex public.exercise_library%rowtype;
  v_days jsonb := '[]'::jsonb; v_items jsonb; v_number integer; v_id uuid;
begin
  select * into v_plan from public.workout_plans where id = p_plan_id for update;
  if not found or not public.tenant_access_allowed(v_plan.tenant_id) or not exists (
    select 1 from public.tenant_memberships m join public.user_profiles p on p.user_id = m.user_id
    where m.tenant_id = v_plan.tenant_id and m.user_id = auth.uid() and m.active and p.active and m.role = 'PROFISSIONAL'
  ) then raise exception 'not authorized' using errcode = '42501'; end if;
  if not exists (select 1 from public.students where id = v_plan.student_id and tenant_id = v_plan.tenant_id and status = 'ACTIVE')
    then raise exception 'student inactive' using errcode = '22023'; end if;
  if jsonb_typeof(v_plan.draft->'days') <> 'array' or jsonb_array_length(v_plan.draft->'days') not between 1 and 7
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
        then raise exception 'invalid workout item' using errcode = '22023'; end if;
      select * into v_ex from public.exercise_library where id = (v_item->>'exerciseId')::uuid and tenant_id = v_plan.tenant_id;
      if not found then raise exception 'exercise unavailable' using errcode = '22023'; end if;
      v_items := v_items || jsonb_build_array(jsonb_build_object('id',v_item->>'id','exerciseId',v_ex.id,
        'name',v_ex.name,'instructions',v_ex.instructions,'videoUrl',v_ex.video_url,
        'sets',(v_item->>'sets')::integer,'reps',v_item->>'reps'));
    end loop;
    v_days := v_days || jsonb_build_array(jsonb_build_object('id',v_day->>'id','name',v_day->>'name','items',v_items));
  end loop;
  select coalesce(max(version_number), 0) + 1 into v_number from public.workout_plan_versions where plan_id = p_plan_id;
  insert into public.workout_plan_versions(tenant_id,plan_id,version_number,snapshot,published_by)
    values(v_plan.tenant_id,p_plan_id,v_number,jsonb_build_object('title',v_plan.title,'days',v_days),auth.uid()) returning id into v_id;
  insert into public.workout_assignments(tenant_id,student_id,version_id)
    values(v_plan.tenant_id,v_plan.student_id,v_id);
  insert into public.audit_events(tenant_id,actor_user_id,action,resource_id)
    values(v_plan.tenant_id,auth.uid(),'WORKOUT_PUBLISH',v_id);
  return v_id;
end $$;
revoke all on function public.publish_workout_plan(uuid) from public, anon;
grant execute on function public.publish_workout_plan(uuid) to authenticated;

create function public.sync_workout_session(p_operation_id uuid, p_session_id uuid,
  p_version_id uuid, p_revision integer, p_entries jsonb, p_status text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_assignment public.workout_assignments%rowtype; v_existing public.workout_sessions%rowtype;
  v_hash text; v_receipt text; v_entry jsonb; v_valid_items jsonb;
begin
  if auth.uid() is null or p_operation_id is null or p_session_id is null or p_revision not between 1 and 100000
    or p_status not in ('IN_PROGRESS','COMPLETED') or jsonb_typeof(p_entries) <> 'array'
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
      or coalesce(v_entry->>'reps','') !~ '^[0-9]{1,3}$'
      or coalesce(v_entry->>'loadKg','') !~ '^[0-9]{1,4}(\.[0-9]{1,2})?$'
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
      or v_existing.status = 'COMPLETED' or p_revision <= v_existing.revision
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
revoke all on function public.sync_workout_session(uuid,uuid,uuid,integer,jsonb,text) from public, anon;
grant execute on function public.sync_workout_session(uuid,uuid,uuid,integer,jsonb,text) to authenticated;
