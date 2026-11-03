-- Minimal platform plan and access management. Existing spaces keep access.
create table public.tenant_plans (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  plan_type text not null default 'AVALIACAO'
    check (plan_type in ('AVALIACAO', 'MENSAL', 'ANUAL')),
  active boolean not null default true,
  expires_on date,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
alter table public.tenant_plans enable row level security;
revoke all on public.tenant_plans from public, anon, authenticated;
insert into public.tenant_plans(tenant_id) select id from public.tenants;

create function public.create_tenant_plan() returns trigger language plpgsql
  security definer set search_path = '' as $$
begin
  insert into public.tenant_plans(tenant_id, expires_on)
    values (new.id, (now() at time zone 'America/Sao_Paulo')::date + 30);
  return new;
end $$;
revoke all on function public.create_tenant_plan() from public, anon, authenticated;
create trigger tenant_default_plan after insert on public.tenants
  for each row execute function public.create_tenant_plan();

create function public.tenant_access_allowed(p_tenant_id uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tenant_plans p
    where p.tenant_id = p_tenant_id and p.active
      and (p.expires_on is null or p.expires_on >= (now() at time zone 'America/Sao_Paulo')::date)
  )
$$;
revoke all on function public.tenant_access_allowed(uuid) from public, anon;
grant execute on function public.tenant_access_allowed(uuid) to authenticated;

-- Restrictive policies add the plan gate to every tenant-scoped client table.
create policy tenant_plan_gate on public.tenants as restrictive for all to authenticated
  using (public.tenant_access_allowed(id))
  with check (public.tenant_access_allowed(id));
create policy brand_plan_gate on public.tenant_brand as restrictive for all to authenticated
  using (public.tenant_access_allowed(tenant_id))
  with check (public.tenant_access_allowed(tenant_id));
create policy membership_plan_gate on public.tenant_memberships as restrictive for all to authenticated
  using (public.tenant_access_allowed(tenant_id))
  with check (public.tenant_access_allowed(tenant_id));
create policy receipt_plan_gate on public.technical_operation_receipts as restrictive for all to authenticated
  using (public.tenant_access_allowed(tenant_id))
  with check (public.tenant_access_allowed(tenant_id));
create policy professional_plan_gate on public.professionals as restrictive for all to authenticated
  using (public.tenant_access_allowed(tenant_id))
  with check (public.tenant_access_allowed(tenant_id));
create policy student_plan_gate on public.students as restrictive for all to authenticated
  using (public.tenant_access_allowed(tenant_id))
  with check (public.tenant_access_allowed(tenant_id));
create policy notes_plan_gate on public.student_internal_notes as restrictive for all to authenticated
  using (public.tenant_access_allowed(tenant_id))
  with check (public.tenant_access_allowed(tenant_id));
create policy audit_plan_gate on public.audit_events as restrictive for all to authenticated
  using (public.tenant_access_allowed(tenant_id))
  with check (public.tenant_access_allowed(tenant_id));

create function public.list_platform_spaces()
returns table (
  tenant_id uuid, tenant_name text, professional_name text, professional_email text,
  onboarding_status text, plan_type text, plan_active boolean, expires_on date
) language sql stable security definer set search_path = '' as $$
  select t.id, t.name,
    coalesce(i.display_name, p.display_name, 'Não informado'),
    coalesce(i.email, u.email, ''),
    case when p.user_id is not null then 'ATIVADO'
         when i.id is not null then 'CONVITE_PENDENTE' else 'SEM_CONVITE' end,
    plan.plan_type, plan.active, plan.expires_on
  from public.tenants t
  join public.tenant_plans plan on plan.tenant_id = t.id
  left join lateral (
    select pi.id, pi.display_name, pi.email from public.professional_invitations pi
    where pi.tenant_id = t.id order by pi.created_at desc limit 1
  ) i on true
  left join lateral (
    select pr.user_id, pr.display_name from public.professionals pr
    where pr.tenant_id = t.id order by pr.created_at limit 1
  ) p on true
  left join auth.users u on u.id = p.user_id
  where exists (
    select 1 from public.platform_admins a
    join public.user_profiles profile on profile.user_id = a.user_id
    where a.user_id = auth.uid() and a.active and profile.active
  )
  order by t.created_at desc, t.id
$$;
revoke all on function public.list_platform_spaces() from public, anon;
grant execute on function public.list_platform_spaces() to authenticated;

create function public.set_platform_space_plan(
  p_tenant_id uuid, p_plan_type text, p_expires_on date, p_active boolean
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.platform_admins a
    join public.user_profiles profile on profile.user_id = a.user_id
    where a.user_id = auth.uid() and a.active and profile.active
  ) then raise exception 'not authorized' using errcode = '42501'; end if;
  if p_plan_type not in ('AVALIACAO', 'MENSAL', 'ANUAL')
    or p_plan_type is null or p_active is null
  then raise exception 'invalid plan' using errcode = '22023'; end if;
  update public.tenant_plans set plan_type = p_plan_type,
    expires_on = p_expires_on, active = p_active,
    updated_at = now(), updated_by = auth.uid()
    where tenant_id = p_tenant_id;
  if not found then raise exception 'space not found' using errcode = '22023'; end if;
  insert into public.audit_events(tenant_id, actor_user_id, action, resource_id)
    values (p_tenant_id, auth.uid(), 'SPACE_PLAN_UPDATE', p_tenant_id);
end $$;
revoke all on function public.set_platform_space_plan(uuid,text,date,boolean) from public, anon;
grant execute on function public.set_platform_space_plan(uuid,text,date,boolean) to authenticated;

-- SECURITY DEFINER invitation RPCs need the same access gate as direct RLS queries.
create or replace function public.create_student_invite(p_student_id uuid, p_token_hash text)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare v_tenant uuid; v_expiry timestamptz;
begin
  if auth.uid() is null or p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid invitation' using errcode = '22023'; end if;
  select tenant_id into v_tenant from public.students where id = p_student_id and user_id is null and status = 'ACTIVE';
  if v_tenant is null or not public.tenant_access_allowed(v_tenant)
    or not exists (select 1 from public.tenant_memberships where tenant_id = v_tenant
      and user_id = auth.uid() and active and role = 'PROFISSIONAL')
  then raise exception 'not authorized' using errcode = '42501'; end if;
  update public.student_invitations set used_at = now() where student_id = p_student_id and used_at is null;
  insert into public.student_invitations(tenant_id, student_id, token_hash, created_by)
    values (v_tenant, p_student_id, p_token_hash, auth.uid()) returning expires_at into v_expiry;
  return v_expiry;
end $$;

create or replace function public.claim_student_invite(p_token text)
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
  if not public.tenant_access_allowed(v_invite.tenant_id)
    or v_email is null or v_email <> lower(v_student.email) or v_student.user_id is not null
    or v_student.status <> 'ACTIVE' then raise exception 'invitation unavailable' using errcode = '42501'; end if;
  insert into public.tenant_memberships(tenant_id, user_id, role)
    values (v_invite.tenant_id, auth.uid(), 'ALUNO');
  update public.students set user_id = auth.uid(), updated_at = now() where id = v_student.id;
  update public.student_invitations set used_at = now() where id = v_invite.id;
  return v_student.id;
end $$;

create or replace function public.claim_professional_invite(p_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_invite public.professional_invitations%rowtype; v_email text;
begin
  if auth.uid() is null or p_token is null or p_token !~ '^[0-9a-f]{64}$'
    then raise exception 'invalid invitation' using errcode = '22023'; end if;
  select * into v_invite from public.professional_invitations
    where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
      and used_at is null and expires_at > now() for update;
  if not found then raise exception 'invitation unavailable' using errcode = '22023'; end if;
  select lower(email) into v_email from auth.users
    where id = auth.uid() and email_confirmed_at is not null;
  if not public.tenant_access_allowed(v_invite.tenant_id)
    or v_email is null or v_email <> v_invite.email
    or not exists (select 1 from public.user_profiles where user_id = auth.uid() and active)
    or exists (select 1 from public.tenant_memberships where tenant_id = v_invite.tenant_id and user_id = auth.uid())
  then raise exception 'invitation unavailable' using errcode = '42501'; end if;
  insert into public.tenant_memberships(tenant_id, user_id, role)
    values (v_invite.tenant_id, auth.uid(), 'PROFISSIONAL');
  insert into public.professionals(tenant_id, user_id, display_name)
    values (v_invite.tenant_id, auth.uid(), v_invite.display_name);
  update public.professional_invitations set used_at = now() where id = v_invite.id;
  insert into public.audit_events(tenant_id, actor_user_id, action, resource_id)
    values (v_invite.tenant_id, auth.uid(), 'PROFESSIONAL_ACTIVATE', auth.uid());
  return v_invite.tenant_id;
end $$;
