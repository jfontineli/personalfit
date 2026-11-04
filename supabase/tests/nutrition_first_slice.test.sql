begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(29);

insert into auth.users(instance_id,id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select '00000000-0000-0000-0000-000000000000', x.id,'authenticated','authenticated',x.email,now(),'{}','{}',now(),now()
from (values
  ('33333333-3333-4333-8333-333333333301'::uuid,'coach@nutrition.invalid'),
  ('33333333-3333-4333-8333-333333333302'::uuid,'dietitian@nutrition.invalid'),
  ('33333333-3333-4333-8333-333333333303'::uuid,'student1@nutrition.invalid'),
  ('33333333-3333-4333-8333-333333333304'::uuid,'student2@nutrition.invalid'),
  ('44444444-4444-4444-8444-444444444401'::uuid,'studentb@nutrition.invalid')
) x(id,email);
insert into public.tenants(id,name) values
  ('33333333-0000-4000-8000-000000000001','Nutrition A'),
  ('44444444-0000-4000-8000-000000000002','Nutrition B');
insert into public.tenant_memberships(tenant_id,user_id,role) values
  ('33333333-0000-4000-8000-000000000001','33333333-3333-4333-8333-333333333301','PROFISSIONAL'),
  ('33333333-0000-4000-8000-000000000001','33333333-3333-4333-8333-333333333302','NUTRICIONISTA'),
  ('33333333-0000-4000-8000-000000000001','33333333-3333-4333-8333-333333333303','ALUNO'),
  ('33333333-0000-4000-8000-000000000001','33333333-3333-4333-8333-333333333304','ALUNO'),
  ('44444444-0000-4000-8000-000000000002','44444444-4444-4444-8444-444444444401','ALUNO');
insert into public.nutritionists(tenant_id,user_id,display_name,crn) values
  ('33333333-0000-4000-8000-000000000001','33333333-3333-4333-8333-333333333302','Dietitian A','CRN 00000');
insert into public.students(id,tenant_id,user_id,full_name,email) values
  ('33333333-aaaa-4aaa-8aaa-aaaaaaaaaaa1','33333333-0000-4000-8000-000000000001','33333333-3333-4333-8333-333333333303','Student A1','student1@nutrition.invalid'),
  ('33333333-aaaa-4aaa-8aaa-aaaaaaaaaaa2','33333333-0000-4000-8000-000000000001','33333333-3333-4333-8333-333333333304','Student A2','student2@nutrition.invalid'),
  ('44444444-bbbb-4bbb-8bbb-bbbbbbbbbbb1','44444444-0000-4000-8000-000000000002','44444444-4444-4444-8444-444444444401','Student B','studentb@nutrition.invalid');
insert into public.nutrition_assignments(tenant_id,student_id,nutritionist_user_id) values
  ('33333333-0000-4000-8000-000000000001','33333333-aaaa-4aaa-8aaa-aaaaaaaaaaa1','33333333-3333-4333-8333-333333333302');

select is((select count(*) from pg_class where oid in ('public.nutritionists'::regclass,'public.nutrition_assignments'::regclass,
  'public.nutrition_invitations'::regclass,'public.nutrition_plans'::regclass,'public.nutrition_plan_versions'::regclass)
  and relrowsecurity),5::bigint,'all nutrition tables use RLS');
set local role anon;
select throws_ok($$select * from public.nutrition_plans$$,'42501',null,'anon cannot read drafts');
select throws_ok($$select public.nutrition_student_plan('33333333-aaaa-4aaa-8aaa-aaaaaaaaaaa1')$$,'42501',null,'anon cannot fetch a plan');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333301',true);
select is((public.nutrition_student_status('33333333-aaaa-4aaa-8aaa-aaaaaaaaaaa1')->>'name'),'Dietitian A','coach sees assignment status');
select is(public.create_nutrition_invite('33333333-aaaa-4aaa-8aaa-aaaaaaaaaaa2','dietitian@nutrition.invalid','Dietitian A',
  encode(extensions.digest(repeat('a',64),'sha256'),'hex')) is not null,true,'coach invites dietitian for A2');
select throws_ok($$select public.nutrition_get_draft('33333333-aaaa-4aaa-8aaa-aaaaaaaaaaa1')$$,'42501',null,'coach cannot read clinical draft');
select throws_ok($$select public.nutrition_student_status('44444444-bbbb-4bbb-8bbb-bbbbbbbbbbb1')$$,'42501',null,'coach cannot see B status');
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333302',true);
select is((select count(*) from public.nutrition_my_students('33333333-0000-4000-8000-000000000001')),1::bigint,'dietitian sees assigned student only');
select is((select count(*) from public.nutrition_my_students('44444444-0000-4000-8000-000000000002')),0::bigint,'dietitian sees no B student');
select throws_ok($$select public.nutrition_get_draft('33333333-aaaa-4aaa-8aaa-aaaaaaaaaaa2')$$,'42501',null,'dietitian cannot read unassigned A2');
select throws_ok($$select public.nutrition_save_draft('44444444-bbbb-4bbb-8bbb-bbbbbbbbbbb1','{}'::jsonb)$$,'42501',null,'dietitian cannot write B');
select throws_ok($$select public.nutrition_save_draft('33333333-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  '{"title":"Teste","guidance":"","meals":[{"id":"not-a-uuid","name":"Refeição","time":"","options":[]}]}'::jsonb)$$,
  '22023',null,'draft rejects unusable meal identifier');
select public.nutrition_save_draft('33333333-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  '{"title":"Plano inicial","guidance":"Orientação individual","meals":[{"id":"33333333-dddd-4ddd-8ddd-ddddddddddd1","name":"Café da manhã","time":"07:00","options":[{"label":"Principal","foods":"Alimento e quantidade","notes":""}]}]}'::jsonb);
select is((public.nutrition_get_draft('33333333-aaaa-4aaa-8aaa-aaaaaaaaaaa1')->>'title'),'Plano inicial','dietitian can save assigned draft');
select is(public.nutrition_publish('33333333-aaaa-4aaa-8aaa-aaaaaaaaaaa1'),1,'dietitian publishes version one');
select throws_ok($$update public.nutrition_plan_versions set snapshot='{}'::jsonb$$,'42501',null,'client cannot mutate published version');
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333303',true);
select is((public.nutrition_student_plan('33333333-aaaa-4aaa-8aaa-aaaaaaaaaaa1')->>'version'),'1','A1 sees own published plan');
select is(public.nutrition_log_meal('33333333-eeee-4eee-8eee-eeeeeeeeeee1','33333333-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  (public.nutrition_student_plan('33333333-aaaa-4aaa-8aaa-aaaaaaaaaaa1')->>'id')::uuid,
  '33333333-dddd-4ddd-8ddd-ddddddddddd1',(now() at time zone 'America/Sao_Paulo')::date,'FEITA','') is not null,true,
  'student logs own prescribed meal');
select is((select count(*) from public.nutrition_meal_day('33333333-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  (public.nutrition_student_plan('33333333-aaaa-4aaa-8aaa-aaaaaaaaaaa1')->>'id')::uuid,
  (now() at time zone 'America/Sao_Paulo')::date)),1::bigint,'student sees one confirmed meal');
select is(public.nutrition_log_meal('33333333-eeee-4eee-8eee-eeeeeeeeeee1','33333333-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  (public.nutrition_student_plan('33333333-aaaa-4aaa-8aaa-aaaaaaaaaaa1')->>'id')::uuid,
  '33333333-dddd-4ddd-8ddd-ddddddddddd1',(now() at time zone 'America/Sao_Paulo')::date,'FEITA','') is not null,true,
  'same operation is idempotent');
select throws_ok($$select public.nutrition_log_meal('33333333-eeee-4eee-8eee-eeeeeeeeeee1','33333333-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  (public.nutrition_student_plan('33333333-aaaa-4aaa-8aaa-aaaaaaaaaaa1')->>'id')::uuid,
  '33333333-dddd-4ddd-8ddd-ddddddddddd1',(now() at time zone 'America/Sao_Paulo')::date,'NAO_FEITA','')$$,
  '23505',null,'same operation cannot change its effect');
select throws_ok($$select public.nutrition_log_meal('33333333-eeee-4eee-8eee-eeeeeeeeeee2','33333333-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  (public.nutrition_student_plan('33333333-aaaa-4aaa-8aaa-aaaaaaaaaaa1')->>'id')::uuid,
  '33333333-dddd-4ddd-8ddd-ddddddddddd1',(now() at time zone 'America/Sao_Paulo')::date,'FEITA','')$$,
  '42501',null,'A1 cannot log A2 meal');
select throws_ok($$select public.nutrition_log_meal('33333333-eeee-4eee-8eee-eeeeeeeeeee3','33333333-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  (public.nutrition_student_plan('33333333-aaaa-4aaa-8aaa-aaaaaaaaaaa1')->>'id')::uuid,
  '33333333-dddd-4ddd-8ddd-ddddddddddd2',(now() at time zone 'America/Sao_Paulo')::date,'FEITA','')$$,
  '22023',null,'student cannot log unprescribed meal');
select throws_ok($$select count(*) from public.nutrition_meal_events$$,'42501',null,'direct event table is not readable to client');
select throws_ok($$select public.nutrition_student_plan('33333333-aaaa-4aaa-8aaa-aaaaaaaaaaa2')$$,'42501',null,'A1 cannot see A2 plan');
select throws_ok($$select public.nutrition_get_draft('33333333-aaaa-4aaa-8aaa-aaaaaaaaaaa1')$$,'42501',null,'student cannot read draft');
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333304',true);
select is(public.nutrition_student_plan('33333333-aaaa-4aaa-8aaa-aaaaaaaaaaa2') is null,true,'A2 sees no plan for self');
select throws_ok($$select public.claim_nutrition_invite(repeat('a',64),'CRN 00000')$$,'42501',null,'wrong account cannot claim dietitian invite');
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333302',true);
select is(public.claim_nutrition_invite(repeat('a',64),'CRN 00000'),
  '33333333-0000-4000-8000-000000000001'::uuid,'invited dietitian claims second student');
reset role;
update public.students set status='INACTIVE' where id='33333333-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
set local role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333303',true);
select throws_ok($$select public.nutrition_student_plan('33333333-aaaa-4aaa-8aaa-aaaaaaaaaaa1')$$,'42501',null,'inactive student cannot access plan');
select * from finish();
rollback;
