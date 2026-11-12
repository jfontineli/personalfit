-- The professional's exercise library is the live source for shared name,
-- instructions and media. Published snapshots remain immutable for audit/history.
create function public.student_exercise_content(p_student_id uuid, p_version_id uuid)
returns table(exercise_id uuid, name text, instructions text, video_url text)
language sql stable security definer set search_path = '' as $$
  select distinct e.id, e.name, e.instructions, e.video_url
  from public.students s
  join public.tenant_memberships m on m.tenant_id = s.tenant_id and m.user_id = s.user_id
  join public.user_profiles profile on profile.user_id = s.user_id
  join lateral (
    select a.version_id from public.workout_assignments a
    where a.tenant_id = s.tenant_id and a.student_id = s.id
    order by a.assigned_at desc, a.id desc limit 1
  ) assignment on true
  join public.workout_plan_versions v on v.id = assignment.version_id and v.tenant_id = s.tenant_id
  cross join lateral jsonb_array_elements(v.snapshot->'days') day
  cross join lateral jsonb_array_elements(day->'items') item
  cross join lateral (
    select (item->>'exerciseId')::uuid as id
    union
    select (alternative->>'exerciseId')::uuid as id
    from jsonb_array_elements(coalesce(item->'alternatives','[]'::jsonb)) alternative
  ) prescribed
  join public.exercise_library e on e.tenant_id = s.tenant_id and e.id = prescribed.id
  where s.id = p_student_id and v.id = p_version_id and s.user_id = (select auth.uid())
    and s.status = 'ACTIVE' and m.active and m.role = 'ALUNO' and profile.active
    and public.tenant_access_allowed(s.tenant_id);
$$;

revoke all on function public.student_exercise_content(uuid,uuid) from public, anon;
grant execute on function public.student_exercise_content(uuid,uuid) to authenticated;

-- Keep the existing delete policy and its professional/path authorization.
create or replace function public.can_delete_exercise_video(p_name text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.can_access_exercise_video(p_name, true) then return false; end if;
  return not exists (
    select 1 from public.workout_plan_versions v
    cross join lateral jsonb_array_elements(v.snapshot->'days') day
    cross join lateral jsonb_array_elements(day->'items') item
    where v.tenant_id = split_part(p_name,'/',1)::uuid
      and (item->>'videoUrl' = 'storage:' || p_name or exists (
        select 1 from jsonb_array_elements(item->'alternatives') alt
        where alt->>'videoUrl' = 'storage:' || p_name
      ))
  );
end $$;
