-- Phase 3: identity, tenant roles and basic student lifecycle.
create type public.app_role as enum ('SUPER_ADMIN', 'PROFISSIONAL', 'ALUNO');
alter table public.tenant_memberships drop constraint tenant_memberships_role_check;
update public.tenant_memberships set role = case role when 'PROFESSIONAL' then 'PROFISSIONAL' when 'STUDENT' then 'ALUNO' else role end;
alter table public.tenant_memberships add constraint membership_tenant_role check (role in ('PROFISSIONAL', 'ALUNO'));
drop policy brand_update_professional on public.tenant_brand;
create policy brand_update_professional on public.tenant_brand for update to authenticated
  using (exists (select 1 from public.tenant_memberships m where m.tenant_id = tenant_brand.tenant_id
    and m.user_id = (select auth.uid()) and m.active and m.role = 'PROFISSIONAL'))
  with check (exists (select 1 from public.tenant_memberships m where m.tenant_id = tenant_brand.tenant_id
    and m.user_id = (select auth.uid()) and m.active and m.role = 'PROFISSIONAL'));
drop policy membership_select_own on public.tenant_memberships;
create policy membership_select_own on public.tenant_memberships for select to authenticated
  using (user_id = (select auth.uid()) and active);

create table public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '' check (length(full_name) <= 160),
  email text check (email is null or length(email) <= 320),
  phone text check (phone is null or length(phone) <= 40),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'SUPER_ADMIN' check (role = 'SUPER_ADMIN'),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.professionals (
  tenant_id uuid not null,
  user_id uuid not null,
  display_name text not null check (length(trim(display_name)) between 1 and 160),
  registration text check (registration is null or length(registration) <= 100),
  specialty text check (specialty is null or length(specialty) <= 120),
  bio text check (bio is null or length(bio) <= 500),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, user_id),
  foreign key (tenant_id, user_id) references public.tenant_memberships(tenant_id, user_id)
);
create table public.students (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  user_id uuid references auth.users(id),
  full_name text not null check (length(trim(full_name)) between 1 and 160),
  email text not null check (email = btrim(email) and length(email) between 3 and 320),
  phone text check (phone is null or length(phone) <= 40),
  goal text check (goal is null or length(goal) <= 500),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE')),
  start_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, user_id),
  foreign key (tenant_id, user_id) references public.tenant_memberships(tenant_id, user_id)
);
create unique index students_email_per_tenant on public.students(tenant_id, lower(email));
create index students_tenant_status on public.students(tenant_id, status);
create table public.student_internal_notes (
  student_id uuid primary key,
  tenant_id uuid not null,
  body text not null default '' check (length(body) <= 4000),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, student_id) references public.students(tenant_id, id)
);
create table public.student_invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  student_id uuid not null,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null default (now() + interval '48 hours'),
  used_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (tenant_id, student_id) references public.students(tenant_id, id)
);
create unique index student_one_open_invitation on public.student_invitations(student_id) where used_at is null;
create table public.audit_events (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id),
  actor_user_id uuid references auth.users(id),
  action text not null,
  resource_id uuid not null,
  created_at timestamptz not null default now()
);
create index audit_tenant_created on public.audit_events(tenant_id, created_at desc);

alter table public.tenant_brand add column brand_name text;
alter table public.tenant_brand add column secondary_color text check (secondary_color ~ '^#[0-9A-Fa-f]{6}$');
alter table public.tenant_brand add column logo_url text check (logo_url is null or length(logo_url) <= 500);
alter table public.tenant_brand add column whatsapp text check (whatsapp is null or length(whatsapp) <= 40);
alter table public.tenant_brand add column instagram text check (instagram is null or length(instagram) <= 100);
update public.tenant_brand set brand_name = display_name, secondary_color = '#FFFFFF';
alter table public.tenant_brand alter column brand_name set not null;
alter table public.tenant_brand alter column secondary_color set not null;

alter table public.user_profiles enable row level security;
alter table public.platform_admins enable row level security;
alter table public.professionals enable row level security;
alter table public.students enable row level security;
alter table public.student_internal_notes enable row level security;
alter table public.student_invitations enable row level security;
alter table public.audit_events enable row level security;

revoke all on public.user_profiles, public.platform_admins, public.professionals,
  public.students, public.student_internal_notes, public.student_invitations,
  public.audit_events from anon, authenticated;
grant select on public.user_profiles, public.professionals, public.students,
  public.student_internal_notes, public.audit_events to authenticated;
grant select on public.platform_admins to authenticated;
grant insert (user_id, full_name, email, phone) on public.user_profiles to authenticated;
grant update (full_name, phone) on public.user_profiles to authenticated;
grant insert (tenant_id, full_name, email, phone, goal, start_date) on public.students to authenticated;
grant update (full_name, email, phone, goal, status, start_date) on public.students to authenticated;
grant insert (student_id, tenant_id, body) on public.student_internal_notes to authenticated;
grant update (body) on public.student_internal_notes to authenticated;
revoke update on public.tenant_brand from authenticated;
grant update (brand_name, display_name, accent_color, secondary_color, logo_url, whatsapp, instagram) on public.tenant_brand to authenticated;

create policy profile_self_select on public.user_profiles for select to authenticated
  using (user_id = (select auth.uid()));
create policy platform_admin_self_select on public.platform_admins for select to authenticated
  using (user_id = (select auth.uid()) and active);
create policy profile_self_insert on public.user_profiles for insert to authenticated
  with check (user_id = (select auth.uid()) and email is not distinct from (select auth.jwt()->>'email'));
create policy profile_self_update on public.user_profiles for update to authenticated
  using (user_id = (select auth.uid()) and active)
  with check (user_id = (select auth.uid()) and active);
create policy professional_self_select on public.professionals for select to authenticated
  using (user_id = (select auth.uid()) and active and exists (
    select 1 from public.tenant_memberships m where m.tenant_id = professionals.tenant_id
    and m.user_id = (select auth.uid()) and m.active and m.role = 'PROFISSIONAL'));
create policy student_select on public.students for select to authenticated using (
  exists (select 1 from public.tenant_memberships m where m.tenant_id = students.tenant_id
    and m.user_id = (select auth.uid()) and m.active and (
      m.role = 'PROFISSIONAL' or (m.role = 'ALUNO' and students.user_id = (select auth.uid()) and students.status = 'ACTIVE')))
);
create policy student_insert_professional on public.students for insert to authenticated with check (
  user_id is null and exists (select 1 from public.tenant_memberships m where m.tenant_id = students.tenant_id
    and m.user_id = (select auth.uid()) and m.active and m.role = 'PROFISSIONAL')
);
create policy student_update_professional on public.students for update to authenticated
  using (exists (select 1 from public.tenant_memberships m where m.tenant_id = students.tenant_id
    and m.user_id = (select auth.uid()) and m.active and m.role = 'PROFISSIONAL'))
  with check (exists (select 1 from public.tenant_memberships m where m.tenant_id = students.tenant_id
    and m.user_id = (select auth.uid()) and m.active and m.role = 'PROFISSIONAL'));
create policy notes_professional_select on public.student_internal_notes for select to authenticated using (
  exists (select 1 from public.tenant_memberships m where m.tenant_id = student_internal_notes.tenant_id
    and m.user_id = (select auth.uid()) and m.active and m.role = 'PROFISSIONAL')
);
create policy notes_professional_insert on public.student_internal_notes for insert to authenticated with check (
  exists (select 1 from public.tenant_memberships m where m.tenant_id = student_internal_notes.tenant_id
    and m.user_id = (select auth.uid()) and m.active and m.role = 'PROFISSIONAL')
);
create policy notes_professional_update on public.student_internal_notes for update to authenticated
  using (exists (select 1 from public.tenant_memberships m where m.tenant_id = student_internal_notes.tenant_id
    and m.user_id = (select auth.uid()) and m.active and m.role = 'PROFISSIONAL'))
  with check (exists (select 1 from public.tenant_memberships m where m.tenant_id = student_internal_notes.tenant_id
    and m.user_id = (select auth.uid()) and m.active and m.role = 'PROFISSIONAL'));
create policy audit_professional_select on public.audit_events for select to authenticated using (
  exists (select 1 from public.tenant_memberships m where m.tenant_id = audit_events.tenant_id
    and m.user_id = (select auth.uid()) and m.active and m.role = 'PROFISSIONAL')
);

create function public.create_auth_profile() returns trigger language plpgsql security definer
  set search_path = '' as $$
begin
  insert into public.user_profiles(user_id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email);
  return new;
end $$;
revoke all on function public.create_auth_profile() from public, anon, authenticated;
create trigger auth_user_profile after insert on auth.users for each row
  execute function public.create_auth_profile();
insert into public.user_profiles(user_id, email)
  select id, email from auth.users on conflict (user_id) do nothing;

create function public.deactivate_profile_memberships() returns trigger language plpgsql security definer
  set search_path = '' as $$
begin
  if old.active and not new.active then
    update public.tenant_memberships set active = false where user_id = new.user_id;
    update public.platform_admins set active = false where user_id = new.user_id;
  end if;
  return new;
end $$;
revoke all on function public.deactivate_profile_memberships() from public, anon, authenticated;
create trigger profile_deactivation after update of active on public.user_profiles for each row
  execute function public.deactivate_profile_memberships();

create function public.student_membership_status() returns trigger language plpgsql security definer
  set search_path = '' as $$
begin
  if new.user_id is not null and new.status is distinct from old.status then
    update public.tenant_memberships set active = (new.status = 'ACTIVE')
      where tenant_id = new.tenant_id and user_id = new.user_id and role = 'ALUNO';
  end if;
  return new;
end $$;
revoke all on function public.student_membership_status() from public, anon, authenticated;
create trigger student_status_membership after update of status on public.students for each row
  execute function public.student_membership_status();

create function public.professional_membership_status() returns trigger language plpgsql security definer
  set search_path = '' as $$
begin
  if new.active is distinct from old.active then
    update public.tenant_memberships set active = new.active
      where tenant_id = new.tenant_id and user_id = new.user_id and role = 'PROFISSIONAL';
  end if;
  return new;
end $$;
revoke all on function public.professional_membership_status() from public, anon, authenticated;
create trigger professional_status_membership after update of active on public.professionals for each row
  execute function public.professional_membership_status();

create function public.audit_tenant_change() returns trigger language plpgsql security definer
  set search_path = '' as $$
declare v_action text;
begin
  v_action := tg_argv[0] || '_' || tg_op;
  if tg_table_name = 'students' and tg_op = 'UPDATE' then
    if old.status is distinct from new.status then
      v_action := case new.status when 'INACTIVE' then 'STUDENT_INACTIVATE' else 'STUDENT_REACTIVATE' end;
    end if;
  end if;
  insert into public.audit_events(tenant_id, actor_user_id, action, resource_id)
  values (new.tenant_id, auth.uid(), v_action, (to_jsonb(new)->>tg_argv[1])::uuid);
  return new;
end $$;
revoke all on function public.audit_tenant_change() from public, anon, authenticated;
create trigger audit_student after insert or update on public.students for each row
  execute function public.audit_tenant_change('STUDENT', 'id');
create trigger audit_student_notes after insert or update on public.student_internal_notes for each row
  execute function public.audit_tenant_change('STUDENT_NOTES', 'student_id');
create trigger audit_brand after update on public.tenant_brand for each row
  execute function public.audit_tenant_change('BRAND', 'tenant_id');
create trigger audit_membership after insert or update on public.tenant_memberships for each row
  execute function public.audit_tenant_change('MEMBERSHIP', 'user_id');

create function public.create_student_invite(p_student_id uuid, p_token_hash text)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare v_tenant uuid; v_expiry timestamptz;
begin
  if auth.uid() is null or p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid invitation' using errcode = '22023'; end if;
  select tenant_id into v_tenant from public.students where id = p_student_id and user_id is null and status = 'ACTIVE';
  if v_tenant is null or not exists (select 1 from public.tenant_memberships where tenant_id = v_tenant
    and user_id = auth.uid() and active and role = 'PROFISSIONAL') then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  update public.student_invitations set used_at = now() where student_id = p_student_id and used_at is null;
  insert into public.student_invitations(tenant_id, student_id, token_hash, created_by)
    values (v_tenant, p_student_id, p_token_hash, auth.uid()) returning expires_at into v_expiry;
  return v_expiry;
end $$;
revoke all on function public.create_student_invite(uuid, text) from public, anon;
grant execute on function public.create_student_invite(uuid, text) to authenticated;

create function public.claim_student_invite(p_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_invite public.student_invitations%rowtype; v_student public.students%rowtype; v_email text;
begin
  if auth.uid() is null or p_token !~ '^[0-9a-f]{64}$' then raise exception 'invalid invitation' using errcode = '22023'; end if;
  select * into v_invite from public.student_invitations
    where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') and used_at is null
      and expires_at > now() for update;
  if not found then raise exception 'invitation unavailable' using errcode = '22023'; end if;
  select * into v_student from public.students where id = v_invite.student_id for update;
  select lower(email) into v_email from auth.users where id = auth.uid() and email_confirmed_at is not null;
  if v_email is null or v_email <> lower(v_student.email) or v_student.user_id is not null
    or v_student.status <> 'ACTIVE' then raise exception 'invitation unavailable' using errcode = '42501'; end if;
  insert into public.tenant_memberships(tenant_id, user_id, role)
    values (v_invite.tenant_id, auth.uid(), 'ALUNO');
  update public.students set user_id = auth.uid(), updated_at = now() where id = v_student.id;
  update public.student_invitations set used_at = now() where id = v_invite.id;
  return v_student.id;
end $$;
revoke all on function public.claim_student_invite(text) from public, anon;
grant execute on function public.claim_student_invite(text) to authenticated;

-- Supabase installs pgcrypto in extensions in local and hosted projects.
create extension if not exists pgcrypto with schema extensions;
