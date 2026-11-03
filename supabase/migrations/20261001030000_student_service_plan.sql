-- The student's agreement with the professional is separate from the tenant's SaaS plan.
-- These fields describe the service; they do not implement billing or automatic access blocking.
create table public.student_service_plans (
  tenant_id uuid not null,
  student_id uuid not null,
  name text not null check (length(btrim(name)) between 1 and 160),
  starts_on date not null default current_date,
  ends_on date check (ends_on is null or ends_on >= starts_on),
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, student_id),
  foreign key (tenant_id, student_id) references public.students(tenant_id, id)
);
alter table public.student_service_plans enable row level security;
revoke all on public.student_service_plans from public,anon,authenticated;
grant select on public.student_service_plans to authenticated;
grant insert (tenant_id,student_id,name,starts_on,ends_on,active) on public.student_service_plans to authenticated;
grant update (name,starts_on,ends_on,active,updated_at) on public.student_service_plans to authenticated;
create policy student_service_plan_read on public.student_service_plans for select to authenticated using (
  public.tenant_access_allowed(tenant_id) and (
    exists (select 1 from public.tenant_memberships m join public.user_profiles p on p.user_id = m.user_id
      where m.tenant_id = student_service_plans.tenant_id and m.user_id = (select auth.uid())
        and m.active and p.active and m.role = 'PROFISSIONAL')
    or exists (select 1 from public.students s join public.tenant_memberships m
      on m.tenant_id = s.tenant_id and m.user_id = s.user_id
      join public.user_profiles p on p.user_id = s.user_id
      where s.id = student_service_plans.student_id and s.tenant_id = student_service_plans.tenant_id
        and s.user_id = (select auth.uid()) and s.status = 'ACTIVE' and m.active and m.role = 'ALUNO' and p.active)
  )
);
create policy student_service_plan_insert on public.student_service_plans for insert to authenticated with check (
  public.tenant_access_allowed(tenant_id) and exists (
    select 1 from public.tenant_memberships m join public.user_profiles p on p.user_id = m.user_id
    where m.tenant_id = student_service_plans.tenant_id and m.user_id = (select auth.uid())
      and m.active and p.active and m.role = 'PROFISSIONAL'
  )
);
create policy student_service_plan_update on public.student_service_plans for update to authenticated
  using (public.tenant_access_allowed(tenant_id) and exists (
    select 1 from public.tenant_memberships m join public.user_profiles p on p.user_id = m.user_id
    where m.tenant_id = student_service_plans.tenant_id and m.user_id = (select auth.uid())
      and m.active and p.active and m.role = 'PROFISSIONAL'
  ))
  with check (public.tenant_access_allowed(tenant_id) and exists (
    select 1 from public.tenant_memberships m join public.user_profiles p on p.user_id = m.user_id
    where m.tenant_id = student_service_plans.tenant_id and m.user_id = (select auth.uid())
      and m.active and p.active and m.role = 'PROFISSIONAL'
  ));
create trigger audit_student_service_plan after insert or update on public.student_service_plans for each row
  execute function public.audit_tenant_change('STUDENT_SERVICE_PLAN','student_id');
