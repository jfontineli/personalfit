begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(15);

insert into auth.users(instance_id,id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select '00000000-0000-0000-0000-000000000000',x.id,'authenticated','authenticated',x.email,now(),'{}','{}',now(),now()
from (values
  ('55555555-5555-4555-8555-555555555501'::uuid,'dual-coach@nutrition.invalid'),
  ('55555555-5555-4555-8555-555555555502'::uuid,'other-coach@nutrition.invalid')
) x(id,email);
insert into public.tenants(id,name) values
  ('55555555-0000-4000-8000-000000000001','Dual nutrition A'),
  ('66666666-0000-4000-8000-000000000002','Dual nutrition B');
insert into public.tenant_memberships(tenant_id,user_id,role) values
  ('55555555-0000-4000-8000-000000000001','55555555-5555-4555-8555-555555555501','PROFISSIONAL'),
  ('55555555-0000-4000-8000-000000000001','55555555-5555-4555-8555-555555555502','PROFISSIONAL');
insert into public.professionals(tenant_id,user_id,display_name) values
  ('55555555-0000-4000-8000-000000000001','55555555-5555-4555-8555-555555555501','Personal nutricionista'),
  ('55555555-0000-4000-8000-000000000001','55555555-5555-4555-8555-555555555502','Outro personal');
insert into public.students(id,tenant_id,full_name,email) values
  ('55555555-aaaa-4aaa-8aaa-aaaaaaaaaaa1','55555555-0000-4000-8000-000000000001','Aluno A1','a1@nutrition.invalid'),
  ('55555555-aaaa-4aaa-8aaa-aaaaaaaaaaa2','55555555-0000-4000-8000-000000000001','Aluno A2','a2@nutrition.invalid'),
  ('66666666-bbbb-4bbb-8bbb-bbbbbbbbbbb1','66666666-0000-4000-8000-000000000002','Aluno B1','b1@nutrition.invalid');

set local role anon;
select throws_ok($$select public.nutrition_assign_self('55555555-aaaa-4aaa-8aaa-aaaaaaaaaaa1','CRN TESTE')$$,
  '42501',null,'anon cannot self assign');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','55555555-5555-4555-8555-555555555501',true);
select throws_ok($$select public.nutrition_get_draft('55555555-aaaa-4aaa-8aaa-aaaaaaaaaaa1')$$,
  '42501',null,'personal cannot read clinical draft before assignment');
select throws_ok($$select public.nutrition_assign_self('66666666-bbbb-4bbb-8bbb-bbbbbbbbbbb1','CRN TESTE')$$,
  '42501',null,'personal cannot self assign B student');
select is(public.nutrition_assign_self('55555555-aaaa-4aaa-8aaa-aaaaaaaaaaa1','CRN TESTE'),
  '55555555-0000-4000-8000-000000000001'::uuid,'personal assigns self to A1');
select is((select role from public.tenant_memberships where tenant_id='55555555-0000-4000-8000-000000000001'
  and user_id='55555555-5555-4555-8555-555555555501'),'PROFISSIONAL','personal role stays intact');
select is((public.nutrition_student_status('55555555-aaaa-4aaa-8aaa-aaaaaaaaaaa1')->>'is_self')::boolean,
  true,'status identifies own nutrition assignment');
select is((select count(*) from public.nutrition_my_students('55555555-0000-4000-8000-000000000001')),
  1::bigint,'dual role sees only assigned student in nutrition editor');
select throws_ok($$select public.nutrition_get_draft('55555555-aaaa-4aaa-8aaa-aaaaaaaaaaa2')$$,
  '42501',null,'dual role cannot read unassigned A2 nutrition draft');
select public.nutrition_save_draft('55555555-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  '{"title":"Plano fictício","guidance":"","meals":[{"id":"55555555-dddd-4ddd-8ddd-ddddddddddd1","name":"Refeição","time":"","options":[{"label":"Opção","foods":"Alimento fictício","notes":""}]}]}'::jsonb);
select is(public.nutrition_publish('55555555-aaaa-4aaa-8aaa-aaaaaaaaaaa1'),1,
  'dual role publishes assigned A1 plan');
select is(public.create_nutrition_invite('55555555-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  'other-coach@nutrition.invalid','Outro personal',encode(extensions.digest(repeat('b',64),'sha256'),'hex')) is not null,
  true,'professional invites another professional as nutritionist for A2');
select set_config('request.jwt.claim.sub','55555555-5555-4555-8555-555555555502',true);
select throws_ok($$select public.nutrition_get_draft('55555555-aaaa-4aaa-8aaa-aaaaaaaaaaa1')$$,
  '42501',null,'other personal in same tenant cannot read clinical draft');
select is(public.claim_nutrition_invite(repeat('b',64),'CRN TESTE 456'),
  '55555555-0000-4000-8000-000000000001'::uuid,'professional claims nutrition invitation with same account');
select is((select role from public.tenant_memberships where tenant_id='55555555-0000-4000-8000-000000000001'
  and user_id='55555555-5555-4555-8555-555555555502'),'PROFISSIONAL','invitation preserves professional role');
select is((public.nutrition_get_draft('55555555-aaaa-4aaa-8aaa-aaaaaaaaaaa2')->>'title'),'','invitee can edit only assigned A2');
reset role;
update public.nutritionists set active=false where tenant_id='55555555-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','55555555-5555-4555-8555-555555555501',true);
select throws_ok($$select public.nutrition_get_draft('55555555-aaaa-4aaa-8aaa-aaaaaaaaaaa1')$$,
  '42501',null,'inactive nutritionist loses clinical access');
select * from finish();
rollback;
