-- The library uses column-level write grants. RLS still limits writes to the professional's tenant.
grant insert (muscle_group), update (muscle_group) on public.exercise_library to authenticated;
