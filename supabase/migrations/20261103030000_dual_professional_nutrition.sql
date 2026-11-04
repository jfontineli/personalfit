-- A personal who is also a nutritionist keeps one account and one tenant membership.
-- Clinical access still requires a nutritionist record and a student assignment.
create or replace function public.nutrition_nutritionist_allowed(p_tenant uuid, p_student uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and public.tenant_access_allowed(p_tenant) and exists (
    select 1 from public.nutrition_assignments a
    join public.nutritionists n on n.tenant_id = a.tenant_id and n.user_id = a.nutritionist_user_id
    join public.tenant_memberships m on m.tenant_id = n.tenant_id and m.user_id = n.user_id
    join public.user_profiles p on p.user_id = n.user_id
    join public.students s on s.tenant_id = a.tenant_id and s.id = a.student_id
    where a.tenant_id = p_tenant and a.student_id = p_student and a.nutritionist_user_id = auth.uid()
      and a.active and n.active and m.active and m.role in ('NUTRICIONISTA','PROFISSIONAL')
      and p.active and s.status = 'ACTIVE')
$$;

create function public.nutrition_assign_self(p_student_id uuid, p_crn text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_student public.students%rowtype; v_name text;
begin
  if auth.uid() is null or length(btrim(coalesce(p_crn,''))) not between 3 and 40
    then raise exception 'invalid nutritionist details' using errcode = '22023'; end if;
  select * into v_student from public.students where id = p_student_id for update;
  if not found or v_student.status <> 'ACTIVE'
    or not public.nutrition_professional_allowed(v_student.tenant_id)
    or not exists (select 1 from auth.users where id = auth.uid() and email_confirmed_at is not null)
    then raise exception 'not authorized' using errcode = '42501'; end if;
  select display_name into v_name from public.professionals
    where tenant_id = v_student.tenant_id and user_id = auth.uid() and active;
  if v_name is null then raise exception 'not authorized' using errcode = '42501'; end if;
  if exists (select 1 from public.nutrition_assignments
      where tenant_id = v_student.tenant_id and student_id = p_student_id and active)
    then raise exception 'student already assigned' using errcode = '22023'; end if;
  insert into public.nutritionists(tenant_id,user_id,display_name,crn)
    values (v_student.tenant_id,auth.uid(),v_name,btrim(p_crn))
    on conflict (tenant_id,user_id) do update
      set display_name = excluded.display_name, crn = excluded.crn, active = true;
  insert into public.nutrition_assignments(tenant_id,student_id,nutritionist_user_id)
    values (v_student.tenant_id,p_student_id,auth.uid());
  update public.nutrition_invitations set used_at = now()
    where tenant_id = v_student.tenant_id and student_id = p_student_id and used_at is null;
  insert into public.audit_events(tenant_id,actor_user_id,action,resource_id)
    values (v_student.tenant_id,auth.uid(),'NUTRITION_SELF_ASSIGN',p_student_id);
  return v_student.tenant_id;
end $$;
revoke all on function public.nutrition_assign_self(uuid,text) from public, anon;
grant execute on function public.nutrition_assign_self(uuid,text) to authenticated;

create or replace function public.nutrition_student_status(p_student_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_tenant uuid; v_result jsonb;
begin
  select tenant_id into v_tenant from public.students where id = p_student_id;
  if v_tenant is null or not public.nutrition_professional_allowed(v_tenant)
    then raise exception 'not authorized' using errcode = '42501'; end if;
  select jsonb_build_object('name',n.display_name,'crn',n.crn,'published_at',v.published_at,
    'version',v.version,'is_self',a.nutritionist_user_id = auth.uid())
    into v_result from public.nutrition_assignments a
    join public.nutritionists n on n.tenant_id = a.tenant_id and n.user_id = a.nutritionist_user_id
    left join lateral (select version,published_at from public.nutrition_plan_versions
      where tenant_id = a.tenant_id and student_id = a.student_id order by version desc limit 1) v on true
    where a.tenant_id = v_tenant and a.student_id = p_student_id and a.active;
  return coalesce(v_result,'{}'::jsonb);
end $$;
