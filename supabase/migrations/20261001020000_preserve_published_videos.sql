-- Published versions may still refer to an older instructional video.
create function public.can_delete_exercise_video(p_name text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.can_access_exercise_video(p_name,true) then return false; end if;
  return not exists (
    select 1 from public.workout_plan_versions v
    cross join lateral jsonb_array_elements(v.snapshot->'days') day
    cross join lateral jsonb_array_elements(day->'items') item
    where v.tenant_id = split_part(p_name,'/',1)::uuid
      and item->>'videoUrl' = 'storage:' || p_name
  );
end
$$;
revoke all on function public.can_delete_exercise_video(text) from public,anon;
grant execute on function public.can_delete_exercise_video(text) to authenticated;
drop policy exercise_video_delete on storage.objects;
create policy exercise_video_delete on storage.objects for delete to authenticated
  using (bucket_id = 'exercise-videos' and public.can_delete_exercise_video(name));
