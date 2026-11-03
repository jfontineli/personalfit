-- Private, online-only instructional videos uploaded by the professional.
alter table public.exercise_library drop constraint exercise_library_video_url_check;
alter table public.exercise_library add constraint exercise_library_video_url_check check (
  video_url is null or (length(video_url) <= 1000 and (
    video_url ~ '^https://' or video_url ~ '^storage:[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}[.]mp4$'
  ))
);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('exercise-videos','exercise-videos',false,26214400,array['video/mp4'])
on conflict (id) do nothing;

create function public.can_access_exercise_video(p_name text, p_write boolean default false)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_tenant uuid; v_exercise uuid;
begin
  if p_name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.]mp4$'
    or auth.uid() is null then return false; end if;
  v_tenant := split_part(p_name,'/',1)::uuid;
  v_exercise := split_part(p_name,'/',2)::uuid;
  if not public.tenant_access_allowed(v_tenant) then return false; end if;
  if exists (select 1 from public.exercise_library e where e.id = v_exercise and e.tenant_id = v_tenant)
    and exists (select 1 from public.tenant_memberships m join public.user_profiles profile on profile.user_id = m.user_id
      join public.professionals p on p.tenant_id = m.tenant_id and p.user_id = m.user_id
      where m.tenant_id = v_tenant and m.user_id = auth.uid() and m.active and m.role = 'PROFISSIONAL'
        and profile.active and p.active) then return true; end if;
  if p_write then return false; end if;
  return exists (
    select 1 from public.workout_assignments a
    join public.students s on s.tenant_id = a.tenant_id and s.id = a.student_id
    join public.tenant_memberships m on m.tenant_id = s.tenant_id and m.user_id = s.user_id
    join public.user_profiles profile on profile.user_id = s.user_id
    join public.workout_plan_versions v on v.id = a.version_id and v.tenant_id = a.tenant_id
    cross join lateral jsonb_array_elements(v.snapshot->'days') day
    cross join lateral jsonb_array_elements(day->'items') item
    where a.tenant_id = v_tenant and s.user_id = auth.uid() and s.status = 'ACTIVE'
      and m.active and m.role = 'ALUNO' and profile.active
      and item->>'videoUrl' = 'storage:' || p_name
  );
end $$;
revoke all on function public.can_access_exercise_video(text,boolean) from public,anon;
grant execute on function public.can_access_exercise_video(text,boolean) to authenticated;

create policy exercise_video_read on storage.objects for select to authenticated
  using (bucket_id = 'exercise-videos' and public.can_access_exercise_video(name,false));
create policy exercise_video_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'exercise-videos' and public.can_access_exercise_video(name,true));
create policy exercise_video_delete on storage.objects for delete to authenticated
  using (bucket_id = 'exercise-videos' and public.can_access_exercise_video(name,true));
