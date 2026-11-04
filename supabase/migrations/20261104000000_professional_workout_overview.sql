-- Compact workout activity for the professional dashboard. The tenant is verified server-side.
create index if not exists workout_sessions_dashboard
  on public.workout_sessions(tenant_id, student_id, updated_at desc);

create function public.professional_workout_overview(p_tenant uuid)
returns table(student_id uuid, has_workout boolean, last_session_status text,
  last_session_at timestamptz, completed_7d bigint, partial_7d bigint)
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_tenant is null or not public.tenant_access_allowed(p_tenant)
    or not exists (
      select 1 from public.tenant_memberships m
      join public.user_profiles p on p.user_id = m.user_id
      where m.tenant_id = p_tenant and m.user_id = auth.uid()
        and m.active and p.active and m.role = 'PROFISSIONAL'
    ) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return query
  select s.id, exists (
      select 1 from public.workout_assignments a
      where a.tenant_id = s.tenant_id and a.student_id = s.id
    ), latest.status, latest.updated_at,
    (select count(*) from public.workout_sessions w
      where w.tenant_id = s.tenant_id and w.student_id = s.id
        and w.status = 'COMPLETED' and w.updated_at >= now() - interval '7 days'),
    (select count(*) from public.workout_sessions w
      where w.tenant_id = s.tenant_id and w.student_id = s.id
        and w.status = 'PARTIAL' and w.updated_at >= now() - interval '7 days')
  from public.students s
  left join lateral (
    select w.status, w.updated_at from public.workout_sessions w
    where w.tenant_id = s.tenant_id and w.student_id = s.id
    order by w.updated_at desc limit 1
  ) latest on true
  where s.tenant_id = p_tenant;
end $$;

revoke all on function public.professional_workout_overview(uuid) from public, anon, authenticated;
grant execute on function public.professional_workout_overview(uuid) to authenticated;
