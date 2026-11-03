begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into auth.users(instance_id,id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select '00000000-0000-0000-0000-000000000000', x.id, 'authenticated','authenticated',x.email,now(),'{}','{}',now(),now()
from (values
  ('11111111-1111-4111-8111-111111111101'::uuid,'coach-a@workout.invalid'),
  ('11111111-1111-4111-8111-111111111102'::uuid,'student-a1@workout.invalid'),
  ('11111111-1111-4111-8111-111111111103'::uuid,'student-a2@workout.invalid'),
  ('22222222-2222-4222-8222-222222222201'::uuid,'coach-b@workout.invalid'),
  ('22222222-2222-4222-8222-222222222202'::uuid,'student-b@workout.invalid')
) x(id,email);
insert into public.tenants(id,name) values
  ('11111111-0000-4000-8000-000000000001','Workout A'),
  ('22222222-0000-4000-8000-000000000002','Workout B');
insert into public.tenant_memberships(tenant_id,user_id,role) values
  ('11111111-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111101','PROFISSIONAL'),
  ('11111111-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111102','ALUNO'),
  ('11111111-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111103','ALUNO'),
  ('22222222-0000-4000-8000-000000000002','22222222-2222-4222-8222-222222222201','PROFISSIONAL'),
  ('22222222-0000-4000-8000-000000000002','22222222-2222-4222-8222-222222222202','ALUNO');
insert into public.professionals(tenant_id,user_id,display_name) values
  ('11111111-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111101','Coach A'),
  ('22222222-0000-4000-8000-000000000002','22222222-2222-4222-8222-222222222201','Coach B');
insert into public.students(id,tenant_id,user_id,full_name,email) values
  ('11111111-aaaa-4aaa-8aaa-aaaaaaaaaaa1','11111111-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111102','Student A1','student-a1@workout.invalid'),
  ('11111111-aaaa-4aaa-8aaa-aaaaaaaaaaa2','11111111-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111103','Student A2','student-a2@workout.invalid'),
  ('22222222-bbbb-4bbb-8bbb-bbbbbbbbbbb1','22222222-0000-4000-8000-000000000002','22222222-2222-4222-8222-222222222202','Student B','student-b@workout.invalid');
insert into public.exercise_library(id,tenant_id,name,instructions) values
  ('11111111-eeee-4eee-8eee-eeeeeeeeeee1','11111111-0000-4000-8000-000000000001','Exercise A','Original instruction'),
  ('22222222-eeee-4eee-8eee-eeeeeeeeeee2','22222222-0000-4000-8000-000000000002','Exercise B','Private B');
insert into public.workout_plans(id,tenant_id,student_id,title,draft) values
  ('11111111-aaaa-4aaa-8aaa-aaaaaaaaaa11','11111111-0000-4000-8000-000000000001','11111111-aaaa-4aaa-8aaa-aaaaaaaaaaa1','Plan A1',
   '{"guidance":"Keep breathing","days":[{"id":"11111111-dddd-4ddd-8ddd-ddddddddddd1","name":"Day A","items":[{"id":"11111111-1111-4111-8111-111111111199","exerciseId":"11111111-eeee-4eee-8eee-eeeeeeeeeee1","sets":2,"reps":"8-12","notes":"Student-specific instruction","restSeconds":90,"setLabels":["Adjustment · 6 reps","Work · 8-12 reps"]}]}]}'::jsonb);

select is((select count(*) from pg_class where oid in (
  'public.exercise_library'::regclass,'public.workout_plans'::regclass,'public.workout_plan_versions'::regclass,
  'public.workout_assignments'::regclass,'public.workout_sessions'::regclass,'public.workout_operation_receipts'::regclass)
  and relrowsecurity),6::bigint,'all workout tables have RLS');
set local role anon;
select throws_ok($$select count(*) from public.workout_plans$$,'42501',null,'anon cannot read plans');
select throws_ok($$select public.publish_workout_plan('11111111-aaaa-4aaa-8aaa-aaaaaaaaaa11')$$,'42501',null,'anon cannot publish');
select throws_ok($$select public.sync_workout_session('11111111-ffff-4fff-8fff-fffffffffff1','11111111-cccc-4ccc-8ccc-ccccccccccc1',null,1,'[]','IN_PROGRESS')$$,'42501',null,'anon cannot sync');
select throws_ok($$select public.sync_workout_day_session('11111111-ffff-4fff-8fff-ffffffffffa9','11111111-cccc-4ccc-8ccc-cccccccccca9',null,1,'[]','IN_PROGRESS',
  '11111111-dddd-4ddd-8ddd-ddddddddddd1','2026-11-02')$$,'42501',null,'anon cannot inspect workout day');
select throws_ok($$select * from public.student_exercise_videos('11111111-aaaa-4aaa-8aaa-aaaaaaaaaaa1','11111111-aaaa-4aaa-8aaa-aaaaaaaaaa11')$$,
  '42501',null,'anon cannot request current exercise media');

set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111101',true);
select is((select count(*) from public.exercise_library),1::bigint,'coach A sees only A library');
select results_eq($$update public.exercise_library set muscle_group='PEITO' where id='11111111-eeee-4eee-8eee-eeeeeeeeeee1' returning muscle_group$$,
  $$values ('PEITO'::text)$$,'coach A can classify own exercise');
select results_eq($$update public.exercise_library set muscle_group='COSTAS' where id='22222222-eeee-4eee-8eee-eeeeeeeeeee2' returning muscle_group$$,
  $$select 'COSTAS'::text where false$$,'coach A cannot classify B exercise');
select is((select count(*) from public.workout_plans),1::bigint,'coach A sees A plans');
select throws_ok($$insert into public.student_service_plans(tenant_id,student_id,name) values
  ('22222222-0000-4000-8000-000000000002','22222222-bbbb-4bbb-8bbb-bbbbbbbbbbb1','Intrusion')$$,'42501',null,'coach A cannot set B student agreement');
insert into public.student_service_plans(tenant_id,student_id,name) values
  ('11111111-0000-4000-8000-000000000001','11111111-aaaa-4aaa-8aaa-aaaaaaaaaaa1','Training service');
select is((select count(*) from public.student_service_plans),1::bigint,'coach A sets A1 service agreement');
select results_eq($$update public.exercise_library set name='Intrusion' where id='22222222-eeee-4eee-8eee-eeeeeeeeeee2' returning 1$$,$$select 1 where false$$,'coach A cannot alter B exercise');
select throws_ok($$insert into public.exercise_library(tenant_id,name) values ('22222222-0000-4000-8000-000000000002','Intrusion')$$,'42501',null,'tenant id B cannot grant write');
update public.workout_plans set draft=jsonb_set(draft,'{reviewRequired}','true'::jsonb) where id='11111111-aaaa-4aaa-8aaa-aaaaaaaaaa11';
select throws_ok($$select public.publish_workout_plan('11111111-aaaa-4aaa-8aaa-aaaaaaaaaa11')$$,
  '22023',null,'unreviewed draft cannot be published');
update public.workout_plans set draft=draft - 'reviewRequired' where id='11111111-aaaa-4aaa-8aaa-aaaaaaaaaa11';
update public.workout_plans set draft=jsonb_set(draft,'{days}',(draft->'days') ||
  '[{"id":"11111111-dddd-4ddd-8ddd-ddddddddddd2","name":"Day B","items":[{"id":"11111111-1111-4111-8111-111111111198","exerciseId":"11111111-eeee-4eee-8eee-eeeeeeeeeee1","sets":1,"reps":"8"}]}]'::jsonb)
  where id='11111111-aaaa-4aaa-8aaa-aaaaaaaaaa11';
select is(public.publish_workout_plan('11111111-aaaa-4aaa-8aaa-aaaaaaaaaa11') is not null,true,'coach A publishes A1 plan');
select is((select count(*) from public.workout_assignments where student_id='11111111-aaaa-4aaa-8aaa-aaaaaaaaaaa1'),1::bigint,'publication assigns A1');
select is((select snapshot->>'guidance' from public.workout_plan_versions where plan_id='11111111-aaaa-4aaa-8aaa-aaaaaaaaaa11'),
  'Keep breathing','student guidance is published');
select is((select snapshot #>> '{days,0,items,0,notes}' from public.workout_plan_versions where plan_id='11111111-aaaa-4aaa-8aaa-aaaaaaaaaa11'),
  'Student-specific instruction','student-specific note stays in version');
select is((select snapshot #>> '{days,0,items,0,setLabels,1}' from public.workout_plan_versions where plan_id='11111111-aaaa-4aaa-8aaa-aaaaaaaaaa11'),
  'Work · 8-12 reps','set role stays in version');
select throws_ok($$select public.publish_workout_plan('22222222-aaaa-4aaa-8aaa-aaaaaaaaaa11')$$,'42501',null,'coach A cannot publish B plan');

reset role;
update public.exercise_library set instructions='New instruction' where id='11111111-eeee-4eee-8eee-eeeeeeeeeee1';
select is((select snapshot #>> '{days,0,items,0,instructions}' from public.workout_plan_versions where plan_id='11111111-aaaa-4aaa-8aaa-aaaaaaaaaa11'),
  'Original instruction','published instruction stays immutable after library edit');
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111102',true);
select is((select count(*) from public.exercise_library),0::bigint,'student cannot browse library');
select is((select count(*) from public.workout_plans),0::bigint,'student cannot read draft');
select is((select count(*) from public.workout_plan_versions),1::bigint,'A1 reads assigned version');
select is((select count(*) from public.workout_assignments),1::bigint,'A1 sees only own assignment');
select is((select name from public.student_service_plans),'Training service','A1 sees own service agreement');
select throws_ok($$select public.sync_workout_session('11111111-ffff-4fff-8fff-fffffffffff7','11111111-cccc-4ccc-8ccc-ccccccccccc7',
  (select version_id from public.workout_assignments),1,
  '[{"itemId":"11111111-1111-4111-8111-111111111199","setNumber":1,"reps":10,"loadKg":20,"rir":11}]'::jsonb,'IN_PROGRESS')$$,
  '22023',null,'RIR above 10 is refused');
select throws_ok($$select public.sync_workout_session('11111111-ffff-4fff-8fff-fffffffffff8','11111111-cccc-4ccc-8ccc-ccccccccccc8',
  (select version_id from public.workout_assignments),1,
  '[{"itemId":"11111111-1111-4111-8111-111111111199","setNumber":3,"reps":10,"loadKg":20}]'::jsonb,'IN_PROGRESS')$$,
  '22023',null,'A1 cannot record a set beyond prescription');
select throws_ok($$select public.sync_workout_session('11111111-ffff-4fff-8fff-fffffffffff9','11111111-cccc-4ccc-8ccc-ccccccccccc9',
  (select version_id from public.workout_assignments),1,
  '[{"itemId":"11111111-1111-4111-8111-111111111199","setNumber":1,"reps":10,"loadKg":20},{"itemId":"11111111-1111-4111-8111-111111111199","setNumber":1,"reps":10,"loadKg":20}]'::jsonb,'IN_PROGRESS')$$,
  '22023',null,'A1 cannot duplicate a prescribed set');
select is(public.sync_workout_session('11111111-ffff-4fff-8fff-fffffffffff1','11111111-cccc-4ccc-8ccc-ccccccccccc1',
  (select version_id from public.workout_assignments),1,
  '[{"itemId":"11111111-1111-4111-8111-111111111199","setNumber":1,"reps":10,"loadKg":20}]'::jsonb,'IN_PROGRESS'),true,'A1 syncs first entry');
select is(public.sync_workout_session('11111111-ffff-4fff-8fff-fffffffffff1','11111111-cccc-4ccc-8ccc-ccccccccccc1',
  (select version_id from public.workout_assignments),1,
  '[{"itemId":"11111111-1111-4111-8111-111111111199","setNumber":1,"reps":10,"loadKg":20}]'::jsonb,'IN_PROGRESS'),false,'same operation does not duplicate');
select is((select count(*) from public.workout_sessions),1::bigint,'one session after retry');
select throws_ok($$select public.sync_workout_day_session('11111111-ffff-4fff-8fff-ffffffffffa0','11111111-cccc-4ccc-8ccc-cccccccccca0',
  (select version_id from public.workout_assignments),1,'[]'::jsonb,'IN_PROGRESS',
  '11111111-dddd-4ddd-8ddd-ddddddddddd1','2026-11-03')$$,'22023',null,'week must start on Monday');
select throws_ok($$select public.sync_workout_day_session('11111111-ffff-4fff-8fff-ffffffffffa1','11111111-cccc-4ccc-8ccc-cccccccccca1',
  (select version_id from public.workout_assignments),1,
  '[{"itemId":"11111111-1111-4111-8111-111111111198","setNumber":1,"reps":8,"loadKg":10}]'::jsonb,
  'IN_PROGRESS','11111111-dddd-4ddd-8ddd-ddddddddddd1','2026-11-02')$$,'22023',null,'day A rejects day B entry');
select is(public.sync_workout_day_session('11111111-ffff-4fff-8fff-ffffffffffa2','11111111-cccc-4ccc-8ccc-cccccccccca2',
  (select version_id from public.workout_assignments),1,
  '[{"itemId":"11111111-1111-4111-8111-111111111199","setNumber":1,"reps":8,"loadKg":10}]'::jsonb,
  'IN_PROGRESS','11111111-dddd-4ddd-8ddd-ddddddddddd1','2026-11-02'),true,'A1 records assigned day and week');
select is(public.sync_workout_day_session('11111111-ffff-4fff-8fff-ffffffffffa2','11111111-cccc-4ccc-8ccc-cccccccccca2',
  (select version_id from public.workout_assignments),1,
  '[{"itemId":"11111111-1111-4111-8111-111111111199","setNumber":1,"reps":8,"loadKg":10}]'::jsonb,
  'IN_PROGRESS','11111111-dddd-4ddd-8ddd-ddddddddddd1','2026-11-02'),false,'day operation retry is idempotent');
select is((select week_start from public.workout_sessions where id='11111111-cccc-4ccc-8ccc-cccccccccca2'),
  '2026-11-02'::date,'session keeps calendar week');
select throws_ok($$select public.sync_workout_day_session('11111111-ffff-4fff-8fff-ffffffffffa3','11111111-cccc-4ccc-8ccc-cccccccccca2',
  (select version_id from public.workout_assignments),2,'[]'::jsonb,'IN_PROGRESS',
  '11111111-dddd-4ddd-8ddd-ddddddddddd2','2026-11-02')$$,'23505',null,'session cannot move to another day');
select throws_ok($$select public.sync_workout_session('11111111-ffff-4fff-8fff-ffffffffffa4','11111111-cccc-4ccc-8ccc-cccccccccca2',
  (select version_id from public.workout_assignments),2,
  '[{"itemId":"11111111-1111-4111-8111-111111111198","setNumber":1,"reps":8,"loadKg":10}]'::jsonb,
  'IN_PROGRESS')$$,'22023',null,'legacy RPC cannot add another day to a day session');
select throws_ok($$select public.sync_workout_session('11111111-ffff-4fff-8fff-fffffffffff1','11111111-cccc-4ccc-8ccc-ccccccccccc1',
  (select version_id from public.workout_assignments),1,'[]'::jsonb,'IN_PROGRESS')$$,'23505',null,'same operation with changed payload conflicts');

select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111103',true);
select is((select count(*) from public.workout_plan_versions),0::bigint,'A2 cannot read A1 version');
select throws_ok($$select public.sync_workout_day_session('11111111-ffff-4fff-8fff-ffffffffffa5','11111111-cccc-4ccc-8ccc-cccccccccca5',
  (select id from public.workout_plan_versions limit 1),1,'[]'::jsonb,'IN_PROGRESS',
  '11111111-dddd-4ddd-8ddd-ddddddddddd1','2026-11-02')$$,'42501',null,'A2 cannot inspect A1 day');
select is((select count(*) from public.student_service_plans),0::bigint,'A2 cannot read A1 service agreement');
select is((select count(*) from public.workout_sessions),0::bigint,'A2 cannot read A1 session');
select throws_ok($$select public.sync_workout_session('11111111-ffff-4fff-8fff-fffffffffff2','11111111-cccc-4ccc-8ccc-ccccccccccc2',
  (select id from public.workout_plan_versions limit 1),1,'[]'::jsonb,'IN_PROGRESS')$$,'42501',null,'A2 cannot write A1 version');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222201',true);
select is((select count(*) from public.workout_plan_versions),0::bigint,'coach B cannot read A1 version');
select is((select count(*) from public.student_service_plans),0::bigint,'coach B cannot read A service agreement');
select is((select count(*) from public.workout_sessions),0::bigint,'coach B cannot read A1 session');

reset role;
update public.exercise_library set video_url = 'storage:11111111-0000-4000-8000-000000000001/11111111-eeee-4eee-8eee-eeeeeeeeeee1/11111111-eeee-4eee-8eee-eeeeeeeeeee9.mp4'
  where id = '11111111-eeee-4eee-8eee-eeeeeeeeeee1';
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111101',true);
select is(public.can_delete_exercise_video('11111111-0000-4000-8000-000000000001/11111111-eeee-4eee-8eee-eeeeeeeeeee1/11111111-eeee-4eee-8eee-eeeeeeeeeee9.mp4'),true,'coach can remove unpublished video');
select is(public.publish_workout_plan('11111111-aaaa-4aaa-8aaa-aaaaaaaaaa11') is not null,true,'coach publishes a new version');
select is(public.can_delete_exercise_video('11111111-0000-4000-8000-000000000001/11111111-eeee-4eee-8eee-eeeeeeeeeee1/11111111-eeee-4eee-8eee-eeeeeeeeeee9.mp4'),false,'published video cannot be deleted');
select is(public.can_access_exercise_video('11111111-0000-4000-8000-000000000001/11111111-eeee-4eee-8eee-eeeeeeeeeee1/11111111-eeee-4eee-8eee-eeeeeeeeeee9.mp4',true),true,'coach can upload own video');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111102',true);
select is(public.can_access_exercise_video('11111111-0000-4000-8000-000000000001/11111111-eeee-4eee-8eee-eeeeeeeeeee1/11111111-eeee-4eee-8eee-eeeeeeeeeee9.mp4',false),true,'assigned A1 can read video');
select is(public.can_access_exercise_video('11111111-0000-4000-8000-000000000001/11111111-eeee-4eee-8eee-eeeeeeeeeee1/11111111-eeee-4eee-8eee-eeeeeeeeeee9.mp4',true),false,'student cannot upload video');
select is(public.sync_workout_session('11111111-ffff-4fff-8fff-fffffffffff4','11111111-cccc-4ccc-8ccc-ccccccccccc1',
  (select id from public.workout_plan_versions where version_number = 1),2,
  '[{"itemId":"11111111-1111-4111-8111-111111111199","setNumber":1,"reps":10,"loadKg":20}]'::jsonb,'COMPLETED'),true,
  'old session keeps original version after new publication');
select is((select version_number from public.workout_sessions s join public.workout_plan_versions v on v.id = s.version_id
  where s.id='11111111-cccc-4ccc-8ccc-ccccccccccc1'),1,'completed session references old version');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111101',true);
update public.exercise_library set video_url = 'storage:11111111-0000-4000-8000-000000000001/11111111-eeee-4eee-8eee-eeeeeeeeeee1/11111111-eeee-4eee-8eee-eeeeeeeeeeea.mp4'
  where id = '11111111-eeee-4eee-8eee-eeeeeeeeeee1';
select is((select snapshot #>> '{days,0,items,0,videoUrl}' from public.workout_plan_versions where version_number=2),
  'storage:11111111-0000-4000-8000-000000000001/11111111-eeee-4eee-8eee-eeeeeeeeeee1/11111111-eeee-4eee-8eee-eeeeeeeeeee9.mp4',
  'video change does not rewrite published snapshot');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111102',true);
select is((select video_url from public.student_exercise_videos('11111111-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  (select version_id from public.workout_assignments order by assigned_at desc limit 1)) limit 1),
  'storage:11111111-0000-4000-8000-000000000001/11111111-eeee-4eee-8eee-eeeeeeeeeee1/11111111-eeee-4eee-8eee-eeeeeeeeeeea.mp4',
  'A1 sees current video without republishing');
select is(public.can_access_exercise_video('11111111-0000-4000-8000-000000000001/11111111-eeee-4eee-8eee-eeeeeeeeeee1/11111111-eeee-4eee-8eee-eeeeeeeeeeea.mp4',false),true,
  'A1 can read current private video without republishing');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111103',true);
select is(public.can_access_exercise_video('11111111-0000-4000-8000-000000000001/11111111-eeee-4eee-8eee-eeeeeeeeeee1/11111111-eeee-4eee-8eee-eeeeeeeeeee9.mp4',false),false,'A2 cannot read A1 video');
select is((select count(*) from public.student_exercise_videos('11111111-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  (select version_id from public.workout_assignments where student_id='11111111-aaaa-4aaa-8aaa-aaaaaaaaaaa1' limit 1))),0::bigint,
  'A2 cannot resolve A1 current media');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222201',true);
select is(public.can_access_exercise_video('11111111-0000-4000-8000-000000000001/11111111-eeee-4eee-8eee-eeeeeeeeeee1/11111111-eeee-4eee-8eee-eeeeeeeeeee9.mp4',false),false,'coach B cannot read A video');
select is((select count(*) from public.student_exercise_videos('11111111-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  (select version_id from public.workout_assignments where student_id='11111111-aaaa-4aaa-8aaa-aaaaaaaaaaa1' limit 1))),0::bigint,
  'B cannot resolve A current media');

select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111101',true);
update public.workout_plans set draft = jsonb_set(jsonb_set(jsonb_set(jsonb_set(draft,
  '{startsOn}','"2026-11-03"'::jsonb),'{durationWeeks}','8'::jsonb),
  '{importantNote}','"Read your coach guidance"'::jsonb),'{days,0,items,0,targetKind}','"TIME"'::jsonb)
  where id='11111111-aaaa-4aaa-8aaa-aaaaaaaaaa11';
select is(public.publish_workout_plan('11111111-aaaa-4aaa-8aaa-aaaaaaaaaa11') is not null,true,'coach publishes a cycle with timed sets');
select is((select snapshot->>'startsOn' from public.workout_plan_versions where version_number=3),'2026-11-03','cycle start is preserved in immutable version');
select is((select snapshot->>'importantNote' from public.workout_plan_versions where version_number=3),'Read your coach guidance','essential guidance is preserved');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111102',true);
select throws_ok($$select public.sync_workout_day_session('11111111-ffff-4fff-8fff-ffffffffffb1','11111111-cccc-4ccc-8ccc-ccccccccccb1',
  (select id from public.workout_plan_versions where version_number=3),1,'[]'::jsonb,'IN_PROGRESS',
  '11111111-dddd-4ddd-8ddd-ddddddddddd1','2026-11-02')$$,'22023',null,'cycle rejects a date before its start');
select throws_ok($$select public.sync_workout_day_session('11111111-ffff-4fff-8fff-ffffffffffb2','11111111-cccc-4ccc-8ccc-ccccccccccb2',
  (select id from public.workout_plan_versions where version_number=3),1,
  '[{"itemId":"11111111-1111-4111-8111-111111111199","setNumber":1,"reps":20}]'::jsonb,'PARTIAL',
  '11111111-dddd-4ddd-8ddd-ddddddddddd1','2026-11-03')$$,'22023',null,'timed prescription rejects repetition entry');
select throws_ok($$select public.sync_workout_day_session('11111111-ffff-4fff-8fff-ffffffffffb3','11111111-cccc-4ccc-8ccc-ccccccccccb3',
  (select id from public.workout_plan_versions where version_number=3),1,
  '[{"itemId":"11111111-1111-4111-8111-111111111199","setNumber":1,"durationSeconds":20}]'::jsonb,'COMPLETED',
  '11111111-dddd-4ddd-8ddd-ddddddddddd1','2026-11-03')$$,'22023',null,'incomplete day cannot be marked complete');
select is(public.sync_workout_day_session('11111111-ffff-4fff-8fff-ffffffffffb4','11111111-cccc-4ccc-8ccc-ccccccccccb4',
  (select id from public.workout_plan_versions where version_number=3),1,
  '[{"itemId":"11111111-1111-4111-8111-111111111199","setNumber":1,"durationSeconds":20}]'::jsonb,'PARTIAL',
  '11111111-dddd-4ddd-8ddd-ddddddddddd1','2026-11-03'),true,'partial day accepts timed set without load');
select is((select status from public.workout_sessions where id='11111111-cccc-4ccc-8ccc-ccccccccccb4'),'PARTIAL','partial result is retained');
select throws_ok($$select public.sync_workout_day_session('11111111-ffff-4fff-8fff-ffffffffffb5','11111111-cccc-4ccc-8ccc-ccccccccccb4',
  (select id from public.workout_plan_versions where version_number=3),2,'[]'::jsonb,'PARTIAL',
  '11111111-dddd-4ddd-8ddd-ddddddddddd1','2026-11-03')$$,'23505',null,'partial session is terminal');
select is(public.sync_workout_session('11111111-ffff-4fff-8fff-ffffffffffb6','11111111-cccc-4ccc-8ccc-ccccccccccb6',
  (select id from public.workout_plan_versions where version_number=1),1,
  '[{"itemId":"11111111-1111-4111-8111-111111111199","setNumber":1,"reps":0,"loadKg":0}]'::jsonb,'IN_PROGRESS'),true,
  'queued legacy zero-repetition entry remains syncable');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111101',true);
update public.workout_plans set draft=jsonb_set(draft,'{days,0,items,0,recordingStyle}','"PREPARATION"'::jsonb)
  where id='11111111-aaaa-4aaa-8aaa-aaaaaaaaaa11';
select is(public.publish_workout_plan('11111111-aaaa-4aaa-8aaa-aaaaaaaaaa11') is not null,true,'coach publishes preparation style');
select is((select snapshot#>>'{days,0,items,0,recordingStyle}' from public.workout_plan_versions where version_number=4),
  'PREPARATION','published version preserves preparation style');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111102',true);
select throws_ok($$select public.sync_workout_day_session('11111111-ffff-4fff-8fff-ffffffffffb7','11111111-cccc-4ccc-8ccc-ccccccccccb7',
  (select id from public.workout_plan_versions where version_number=4),1,
  '[{"itemId":"11111111-1111-4111-8111-111111111199","setNumber":1,"durationSeconds":20,"loadKg":0}]'::jsonb,'PARTIAL',
  '11111111-dddd-4ddd-8ddd-ddddddddddd1','2026-11-03')$$,'22023',null,'preparation refuses load even when zero');
select throws_ok($$select public.sync_workout_day_session('11111111-ffff-4fff-8fff-ffffffffffb8','11111111-cccc-4ccc-8ccc-ccccccccccb8',
  (select id from public.workout_plan_versions where version_number=4),1,
  '[{"itemId":"11111111-1111-4111-8111-111111111199","setNumber":1,"durationSeconds":20,"rir":2}]'::jsonb,'PARTIAL',
  '11111111-dddd-4ddd-8ddd-ddddddddddd1','2026-11-03')$$,'22023',null,'preparation refuses RIR');
select is(public.sync_workout_day_session('11111111-ffff-4fff-8fff-ffffffffffb9','11111111-cccc-4ccc-8ccc-ccccccccccb9',
  (select id from public.workout_plan_versions where version_number=4),1,
  '[{"itemId":"11111111-1111-4111-8111-111111111199","setNumber":1,"durationSeconds":20}]'::jsonb,'PARTIAL',
  '11111111-dddd-4ddd-8ddd-ddddddddddd1','2026-11-03'),true,'preparation records only its prescribed time');

reset role;
update public.students set status='INACTIVE' where id='11111111-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111102',true);
select is((select count(*) from public.workout_plan_versions),0::bigint,'inactive A1 loses version access');
select is((select count(*) from public.student_exercise_videos('11111111-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  (select id from public.workout_plan_versions where version_number=4))),0::bigint,
  'inactive A1 cannot resolve current media');
select throws_ok($$select public.sync_workout_session('11111111-ffff-4fff-8fff-fffffffffff3','11111111-cccc-4ccc-8ccc-ccccccccccc1',
  (select id from public.workout_plan_versions limit 1),2,'[]'::jsonb,'COMPLETED')$$,'42501',null,'inactive A1 cannot sync');

select * from finish();
rollback;
