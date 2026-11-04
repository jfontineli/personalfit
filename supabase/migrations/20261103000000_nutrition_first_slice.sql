-- Nutrition is authored by an invited nutritionist assigned to one student.
alter table public.tenant_memberships drop constraint membership_tenant_role;
alter table public.tenant_memberships add constraint membership_tenant_role
  check (role in ('PROFISSIONAL', 'ALUNO', 'NUTRICIONISTA'));

create table public.nutritionists (
  tenant_id uuid not null references public.tenants(id),
  user_id uuid not null references auth.users(id),
  display_name text not null check (length(btrim(display_name)) between 1 and 160),
  crn text not null check (length(btrim(crn)) between 3 and 40),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id),
  foreign key (tenant_id, user_id) references public.tenant_memberships(tenant_id, user_id)
);
create table public.nutrition_assignments (
  tenant_id uuid not null,
  student_id uuid not null,
  nutritionist_user_id uuid not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (tenant_id, student_id, nutritionist_user_id),
  foreign key (tenant_id, student_id) references public.students(tenant_id, id),
  foreign key (tenant_id, nutritionist_user_id) references public.nutritionists(tenant_id, user_id)
);
create unique index nutrition_one_active_assignment on public.nutrition_assignments(tenant_id, student_id) where active;
create table public.nutrition_invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  student_id uuid not null,
  email text not null check (email = lower(btrim(email)) and length(email) between 3 and 320),
  display_name text not null check (length(btrim(display_name)) between 1 and 160),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null default (now() + interval '48 hours'),
  used_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (tenant_id, student_id) references public.students(tenant_id, id)
);
create unique index nutrition_one_open_invite on public.nutrition_invitations(student_id) where used_at is null;
create table public.nutrition_plans (
  tenant_id uuid not null,
  student_id uuid not null,
  nutritionist_user_id uuid not null,
  draft jsonb not null default '{"title":"","guidance":"","meals":[]}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, student_id),
  foreign key (tenant_id, student_id) references public.students(tenant_id, id),
  foreign key (tenant_id, nutritionist_user_id) references public.nutritionists(tenant_id, user_id)
);
create table public.nutrition_plan_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  student_id uuid not null,
  nutritionist_user_id uuid not null,
  version integer not null check (version > 0),
  snapshot jsonb not null,
  published_at timestamptz not null default now(),
  unique (tenant_id, student_id, version),
  foreign key (tenant_id, student_id) references public.students(tenant_id, id),
  foreign key (tenant_id, nutritionist_user_id) references public.nutritionists(tenant_id, user_id)
);
create index nutrition_versions_latest on public.nutrition_plan_versions(tenant_id, student_id, version desc);

alter table public.nutritionists enable row level security;
alter table public.nutrition_assignments enable row level security;
alter table public.nutrition_invitations enable row level security;
alter table public.nutrition_plans enable row level security;
alter table public.nutrition_plan_versions enable row level security;
revoke all on public.nutritionists, public.nutrition_assignments, public.nutrition_invitations,
  public.nutrition_plans, public.nutrition_plan_versions from public, anon, authenticated;

-- The assigned nutritionist sees only the student's identity needed to select a chart.
-- All clinical content is returned only by explicit, resource-scoped RPCs below.
create function public.nutrition_professional_allowed(p_tenant uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and public.tenant_access_allowed(p_tenant) and exists (
    select 1 from public.tenant_memberships m join public.user_profiles p on p.user_id = m.user_id
    where m.tenant_id = p_tenant and m.user_id = auth.uid() and m.active and p.active and m.role = 'PROFISSIONAL')
$$;
create function public.nutrition_nutritionist_allowed(p_tenant uuid, p_student uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and public.tenant_access_allowed(p_tenant) and exists (
    select 1 from public.nutrition_assignments a
    join public.nutritionists n on n.tenant_id = a.tenant_id and n.user_id = a.nutritionist_user_id
    join public.tenant_memberships m on m.tenant_id = n.tenant_id and m.user_id = n.user_id
    join public.user_profiles p on p.user_id = n.user_id
    join public.students s on s.tenant_id = a.tenant_id and s.id = a.student_id
    where a.tenant_id = p_tenant and a.student_id = p_student and a.nutritionist_user_id = auth.uid()
      and a.active and n.active and m.active and m.role = 'NUTRICIONISTA' and p.active and s.status = 'ACTIVE')
$$;
create function public.nutrition_student_allowed(p_tenant uuid, p_student uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and public.tenant_access_allowed(p_tenant) and exists (
    select 1 from public.students s join public.tenant_memberships m
      on m.tenant_id = s.tenant_id and m.user_id = s.user_id
    join public.user_profiles p on p.user_id = s.user_id
    where s.tenant_id = p_tenant and s.id = p_student and s.user_id = auth.uid()
      and s.status = 'ACTIVE' and m.active and m.role = 'ALUNO' and p.active)
$$;
revoke all on function public.nutrition_professional_allowed(uuid),
  public.nutrition_nutritionist_allowed(uuid,uuid), public.nutrition_student_allowed(uuid,uuid) from public, anon;
grant execute on function public.nutrition_professional_allowed(uuid),
  public.nutrition_nutritionist_allowed(uuid,uuid), public.nutrition_student_allowed(uuid,uuid) to authenticated;

create function public.create_nutrition_invite(p_student_id uuid, p_email text, p_display_name text, p_token_hash text)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare v_tenant uuid; v_expiry timestamptz; v_email text;
begin
  select tenant_id into v_tenant from public.students where id = p_student_id and status = 'ACTIVE';
  v_email := lower(btrim(p_email));
  if v_tenant is null or not public.nutrition_professional_allowed(v_tenant)
    then raise exception 'not authorized' using errcode = '42501'; end if;
  if v_email is null or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or length(v_email) > 320 or length(btrim(coalesce(p_display_name,''))) not between 1 and 160
    or p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$'
    then raise exception 'invalid invitation' using errcode = '22023'; end if;
  if exists (select 1 from public.nutrition_assignments where tenant_id = v_tenant and student_id = p_student_id and active)
    then raise exception 'student already assigned' using errcode = '22023'; end if;
  update public.nutrition_invitations set used_at = now() where student_id = p_student_id and used_at is null;
  insert into public.nutrition_invitations(tenant_id, student_id, email, display_name, token_hash, created_by)
    values (v_tenant, p_student_id, v_email, btrim(p_display_name), p_token_hash, auth.uid()) returning expires_at into v_expiry;
  insert into public.audit_events(tenant_id, actor_user_id, action, resource_id)
    values (v_tenant, auth.uid(), 'NUTRITION_INVITE', p_student_id);
  return v_expiry;
end $$;
revoke all on function public.create_nutrition_invite(uuid,text,text,text) from public, anon;
grant execute on function public.create_nutrition_invite(uuid,text,text,text) to authenticated;

create function public.claim_nutrition_invite(p_token text, p_crn text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_invite public.nutrition_invitations%rowtype; v_email text;
begin
  if auth.uid() is null or p_token is null or p_token !~ '^[0-9a-f]{64}$'
    or length(btrim(coalesce(p_crn,''))) not between 3 and 40
    then raise exception 'invalid invitation' using errcode = '22023'; end if;
  select * into v_invite from public.nutrition_invitations
    where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
      and used_at is null and expires_at > now() for update;
  if not found then raise exception 'invitation unavailable' using errcode = '22023'; end if;
  select lower(email) into v_email from auth.users where id = auth.uid() and email_confirmed_at is not null;
  if v_email is null or v_email <> v_invite.email or not public.tenant_access_allowed(v_invite.tenant_id)
    or not exists (select 1 from public.user_profiles where user_id = auth.uid() and active)
    or not exists (select 1 from public.students where id = v_invite.student_id and status = 'ACTIVE')
    then raise exception 'invitation unavailable' using errcode = '42501'; end if;
  if exists (select 1 from public.nutrition_assignments where tenant_id = v_invite.tenant_id and student_id = v_invite.student_id and active)
    then raise exception 'student already assigned' using errcode = '22023'; end if;
  if exists (select 1 from public.tenant_memberships where tenant_id = v_invite.tenant_id and user_id = auth.uid() and role <> 'NUTRICIONISTA')
    then raise exception 'account has another role in this space' using errcode = '42501'; end if;
  insert into public.tenant_memberships(tenant_id, user_id, role)
    values (v_invite.tenant_id, auth.uid(), 'NUTRICIONISTA') on conflict (tenant_id,user_id) do update set active = true;
  insert into public.nutritionists(tenant_id,user_id,display_name,crn)
    values (v_invite.tenant_id,auth.uid(),v_invite.display_name,btrim(p_crn))
    on conflict (tenant_id,user_id) do update set active = true;
  insert into public.nutrition_assignments(tenant_id,student_id,nutritionist_user_id)
    values (v_invite.tenant_id,v_invite.student_id,auth.uid());
  update public.nutrition_invitations set used_at = now() where id = v_invite.id;
  insert into public.audit_events(tenant_id, actor_user_id, action, resource_id)
    values (v_invite.tenant_id, auth.uid(), 'NUTRITION_ACTIVATE', v_invite.student_id);
  return v_invite.tenant_id;
end $$;
revoke all on function public.claim_nutrition_invite(text,text) from public, anon;
grant execute on function public.claim_nutrition_invite(text,text) to authenticated;

create function public.nutrition_student_status(p_student_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_tenant uuid; v_result jsonb;
begin
  select tenant_id into v_tenant from public.students where id = p_student_id;
  if v_tenant is null or not public.nutrition_professional_allowed(v_tenant)
    then raise exception 'not authorized' using errcode = '42501'; end if;
  select jsonb_build_object('name',n.display_name,'crn',n.crn,'published_at',v.published_at,'version',v.version)
    into v_result from public.nutrition_assignments a
    join public.nutritionists n on n.tenant_id = a.tenant_id and n.user_id = a.nutritionist_user_id
    left join lateral (select version,published_at from public.nutrition_plan_versions
      where tenant_id = a.tenant_id and student_id = a.student_id order by version desc limit 1) v on true
    where a.tenant_id = v_tenant and a.student_id = p_student_id and a.active;
  return coalesce(v_result,'{}'::jsonb);
end $$;
revoke all on function public.nutrition_student_status(uuid) from public, anon;
grant execute on function public.nutrition_student_status(uuid) to authenticated;

create function public.nutrition_my_students(p_tenant uuid)
returns table(student_id uuid, full_name text, latest_version integer)
language sql stable security definer set search_path = '' as $$
  select s.id,s.full_name,(select max(v.version) from public.nutrition_plan_versions v
    where v.tenant_id = s.tenant_id and v.student_id = s.id)
  from public.nutrition_assignments a join public.students s on s.tenant_id = a.tenant_id and s.id = a.student_id
  where a.tenant_id = p_tenant and public.nutrition_nutritionist_allowed(a.tenant_id,a.student_id)
  order by s.full_name
$$;
revoke all on function public.nutrition_my_students(uuid) from public, anon;
grant execute on function public.nutrition_my_students(uuid) to authenticated;

create function public.nutrition_get_draft(p_student_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_tenant uuid; v_draft jsonb;
begin
  select tenant_id into v_tenant from public.students where id = p_student_id;
  if v_tenant is null or not public.nutrition_nutritionist_allowed(v_tenant,p_student_id)
    then raise exception 'not authorized' using errcode = '42501'; end if;
  select draft into v_draft from public.nutrition_plans where tenant_id = v_tenant and student_id = p_student_id;
  return coalesce(v_draft,'{"title":"","guidance":"","meals":[]}'::jsonb);
end $$;
revoke all on function public.nutrition_get_draft(uuid) from public, anon;
grant execute on function public.nutrition_get_draft(uuid) to authenticated;

create function public.nutrition_valid_draft(p_draft jsonb, p_publish boolean)
returns boolean language plpgsql immutable set search_path = '' as $$
declare v_meal jsonb; v_option jsonb; v_count integer;
begin
  if p_draft is null or jsonb_typeof(p_draft) <> 'object'
    or jsonb_typeof(p_draft->'meals') <> 'array'
    or length(coalesce(p_draft->>'title','')) > 160
    or length(coalesce(p_draft->>'guidance','')) > 4000
    or (p_publish and length(btrim(coalesce(p_draft->>'title',''))) = 0)
    then return false; end if;
  v_count := jsonb_array_length(p_draft->'meals');
  if v_count > 12 or (p_publish and v_count = 0) then return false; end if;
  for v_meal in select value from jsonb_array_elements(p_draft->'meals') loop
    if jsonb_typeof(v_meal) <> 'object' or (v_meal->>'id') !~ '^[0-9a-f-]{36}$'
      or length(btrim(coalesce(v_meal->>'name',''))) not between 1 and 100
      or length(coalesce(v_meal->>'time','')) > 20
      or jsonb_typeof(v_meal->'options') <> 'array'
      or jsonb_array_length(v_meal->'options') > 8
      or (p_publish and jsonb_array_length(v_meal->'options') = 0) then return false; end if;
    for v_option in select value from jsonb_array_elements(v_meal->'options') loop
      if jsonb_typeof(v_option) <> 'object'
        or length(btrim(coalesce(v_option->>'label',''))) not between 1 and 100
        or length(btrim(coalesce(v_option->>'foods',''))) not between 1 and 2000
        or length(coalesce(v_option->>'notes','')) > 1000 then return false; end if;
    end loop;
  end loop;
  return true;
end $$;
revoke all on function public.nutrition_valid_draft(jsonb,boolean) from public, anon;
grant execute on function public.nutrition_valid_draft(jsonb,boolean) to authenticated;

create function public.nutrition_save_draft(p_student_id uuid,p_draft jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_tenant uuid;
begin
  select tenant_id into v_tenant from public.students where id = p_student_id;
  if v_tenant is null or not public.nutrition_nutritionist_allowed(v_tenant,p_student_id)
    then raise exception 'not authorized' using errcode = '42501'; end if;
  if not public.nutrition_valid_draft(p_draft,false) then raise exception 'invalid nutrition draft' using errcode = '22023'; end if;
  insert into public.nutrition_plans(tenant_id,student_id,nutritionist_user_id,draft)
    values (v_tenant,p_student_id,auth.uid(),p_draft)
    on conflict (tenant_id,student_id) do update set draft = excluded.draft,
      nutritionist_user_id = excluded.nutritionist_user_id, updated_at = now();
end $$;
revoke all on function public.nutrition_save_draft(uuid,jsonb) from public, anon;
grant execute on function public.nutrition_save_draft(uuid,jsonb) to authenticated;

create function public.nutrition_publish(p_student_id uuid)
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
    values (v_tenant,p_student_id,auth.uid(),v_next,v_draft);
  insert into public.audit_events(tenant_id,actor_user_id,action,resource_id)
    values (v_tenant,auth.uid(),'NUTRITION_PUBLISH',p_student_id);
  return v_next;
end $$;
revoke all on function public.nutrition_publish(uuid) from public, anon;
grant execute on function public.nutrition_publish(uuid) to authenticated;

create function public.nutrition_student_plan(p_student_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_tenant uuid; v_result jsonb;
begin
  select tenant_id into v_tenant from public.students where id = p_student_id;
  if v_tenant is null or not public.nutrition_student_allowed(v_tenant,p_student_id)
    then raise exception 'not authorized' using errcode = '42501'; end if;
  select jsonb_build_object('id',v.id,'version',v.version,'snapshot',v.snapshot,
    'published_at',v.published_at,'nutritionist_name',n.display_name,'crn',n.crn)
    into v_result from public.nutrition_plan_versions v
    join public.nutritionists n on n.tenant_id = v.tenant_id and n.user_id = v.nutritionist_user_id
    where v.tenant_id = v_tenant and v.student_id = p_student_id
    order by v.version desc limit 1;
  return v_result;
end $$;
revoke all on function public.nutrition_student_plan(uuid) from public, anon;
grant execute on function public.nutrition_student_plan(uuid) to authenticated;
