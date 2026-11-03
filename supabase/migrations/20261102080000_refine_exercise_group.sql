-- A reverse fly is a rear-shoulder movement; keep the initial grouping editable.
update public.exercise_library
set muscle_group = 'OMBROS'
where name ~* '^crucifixo inverso'
  and muscle_group = 'PEITO';
