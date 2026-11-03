-- A draft with a known prescription conflict cannot be published accidentally.
create function public.block_unreviewed_workout_publication() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.workout_plans p where p.id = new.plan_id
    and p.tenant_id = new.tenant_id and p.draft->>'reviewRequired' = 'true')
    then raise exception 'workout requires professional review' using errcode = '22023'; end if;
  return new;
end $$;
create trigger block_unreviewed_workout_publication_before_insert
  before insert on public.workout_plan_versions
  for each row execute function public.block_unreviewed_workout_publication();
