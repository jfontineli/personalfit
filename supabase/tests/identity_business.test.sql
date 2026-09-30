begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select is((select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname in ('user_profiles','platform_admins','professionals','students','student_internal_notes','student_invitations','audit_events') and c.relrowsecurity), 7::bigint, 'every new private table has RLS');
select is((select count(*) from public.students where user_id is null), 1::bigint, 'student may exist before account');
select is((select count(*) from public.professionals), 2::bigint, 'fictional professionals seeded');
select is((select count(*) from public.user_profiles), 6::bigint, 'profiles created for seeded identities');
select is((select count(*) from public.platform_admins), 0::bigint, 'no platform admin seeded with tenant access');

set local role anon;
select throws_ok($$select count(*) from public.students$$, '42501', null, 'anon cannot read students');
select throws_ok($$select public.claim_student_invite('0000000000000000000000000000000000000000000000000000000000000000')$$, '42501', null, 'anon cannot claim invite');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true);
select is((select count(*) from public.students), 3::bigint, 'professional A reads A students');
select is((select count(*) from public.students where tenant_id = 'bbbbbbbb-0000-4000-8000-000000000002'), 0::bigint, 'professional A cannot read B student by tenant id');
select is((select count(*) from public.students where id = 'bbbbbbbb-1111-4111-8111-111111111111'), 0::bigint, 'professional A cannot read B student by known id');
select results_eq($$update public.students set full_name = 'intrusion' where id = 'bbbbbbbb-1111-4111-8111-111111111111' returning 1$$, $$select 1 where false$$, 'professional A cannot alter B student');
select results_eq($$update public.students set full_name = 'Aluno A1 alterado' where id = 'aaaaaaaa-1111-4111-8111-111111111111' returning 1$$, $$select 1$$, 'professional A may alter own tenant student');
select throws_ok($$insert into public.students(tenant_id,full_name,email) values ('bbbbbbbb-0000-4000-8000-000000000002','Intruso','intruso@example.invalid')$$, '42501', null, 'payload tenant B does not grant insert');
select throws_ok($$insert into public.students(tenant_id,full_name,email) values ('aaaaaaaa-0000-4000-8000-000000000001','Duplicado','STUDENT-A1@EXAMPLE.INVALID')$$, '23505', null, 'email uniqueness is case insensitive within tenant');
select throws_ok($$insert into public.tenant_memberships(tenant_id,user_id,role) values ('aaaaaaaa-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4','ALUNO')$$, '42501', null, 'client cannot create duplicate membership');
select results_eq($$update public.tenant_brand set display_name = 'Intrusão' where tenant_id = 'bbbbbbbb-0000-4000-8000-000000000002' returning 1$$, $$select 1 where false$$, 'professional A cannot change B brand');
select results_eq($$update public.tenant_brand set display_name = 'Marca A' where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001' returning 1$$, $$select 1$$, 'professional A may change A brand');
select is((select count(*) from public.audit_events where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001' and actor_user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1' and action in ('STUDENT_UPDATE','BRAND_UPDATE')), 2::bigint, 'student and brand updates audited');

select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', true);
select is((select count(*) from public.students), 1::bigint, 'student A1 reads only own student row');
select is((select count(*) from public.students where id = 'aaaaaaaa-2222-4222-8222-222222222222'), 0::bigint, 'student A1 cannot read A2');
select is((select count(*) from public.students where id = 'bbbbbbbb-1111-4111-8111-111111111111'), 0::bigint, 'student A1 cannot read B1');
select is((select count(*) from public.student_internal_notes), 0::bigint, 'student cannot read internal notes');
select results_eq($$update public.students set full_name = 'Aluno alterado' where id = 'aaaaaaaa-1111-4111-8111-111111111111' returning 1$$, $$select 1 where false$$, 'student cannot alter even own protected registration');
select results_eq($$update public.tenant_brand set display_name = 'Intrusão' where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001' returning 1$$, $$select 1 where false$$, 'student cannot alter tenant brand');

select set_config('request.jwt.claim.sub', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3', true);
select is((select count(*) from public.students), 0::bigint, 'user without membership sees no students');
select is((select count(*) from public.user_profiles), 1::bigint, 'user without membership sees own profile only');
select is((select count(*) from public.platform_admins), 0::bigint, 'ordinary user has no platform admin role');

reset role;
update public.tenant_memberships set active = false where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5', true);
select is((select count(*) from public.students), 0::bigint, 'inactive membership sees no student');
select is((select count(*) from public.tenant_memberships), 0::bigint, 'inactive membership metadata is hidden');
reset role;

-- Inactivation revokes the student's membership and does not delete the row.
update public.students set status = 'INACTIVE' where id = 'aaaaaaaa-1111-4111-8111-111111111111';
select is((select active from public.tenant_memberships where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4'), false, 'student inactivation revokes membership');
update public.students set status = 'ACTIVE' where id = 'aaaaaaaa-1111-4111-8111-111111111111';
select is((select active from public.tenant_memberships where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4'), true, 'student reactivation restores membership');
select is((select count(*) from public.audit_events where resource_id = 'aaaaaaaa-1111-4111-8111-111111111111' and action in ('STUDENT_INACTIVATE','STUDENT_REACTIVATE')), 2::bigint, 'inactivation and reactivation audited distinctly');
update public.professionals set active = false where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
select is((select active from public.tenant_memberships where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'), false, 'professional deactivation revokes membership');
update public.professionals set active = true where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
update public.user_profiles set active = false where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4';
select is((select active from public.tenant_memberships where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4'), false, 'profile deactivation revokes memberships');

insert into public.platform_admins(user_id) values ('cccccccc-cccc-4ccc-8ccc-ccccccccccc3');
set local role authenticated;
select set_config('request.jwt.claim.sub', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3', true);
select is((select count(*) from public.platform_admins), 1::bigint, 'platform admin sees own role');
select is((select count(*) from public.students), 0::bigint, 'platform admin has no tenant student bypass');
reset role;

insert into auth.users(instance_id,id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('00000000-0000-0000-0000-000000000000','ffffffff-ffff-4fff-8fff-fffffffffff1','authenticated','authenticated','student-pending@example.invalid',now(),'{}','{}',now(),now());
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true);
select set_config('request.jwt.claim.email', 'a@example.invalid', true);
select is(public.create_student_invite('aaaaaaaa-3333-4333-8333-333333333333', encode(extensions.digest(repeat('a',64),'sha256'),'hex')) > now(), true, 'professional creates expiring invite');
select throws_ok($$select public.create_student_invite('bbbbbbbb-1111-4111-8111-111111111111', encode(extensions.digest(repeat('b',64),'sha256'),'hex'))$$, '42501', null, 'professional cannot invite B student');
select set_config('request.jwt.claim.sub', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3', true);
select set_config('request.jwt.claim.email', 'none@example.invalid', true);
select throws_ok($$select public.claim_student_invite(repeat('a',64))$$, '42501', null, 'different confirmed email cannot claim student');
select set_config('request.jwt.claim.sub', 'ffffffff-ffff-4fff-8fff-fffffffffff1', true);
select set_config('request.jwt.claim.email', 'student-pending@example.invalid', true);
reset role;
update auth.users set email_confirmed_at = null where id = 'ffffffff-ffff-4fff-8fff-fffffffffff1';
set local role authenticated;
select throws_ok($$select public.claim_student_invite(repeat('a',64))$$, '42501', null, 'unconfirmed email cannot claim student');
reset role;
update auth.users set email_confirmed_at = now() where id = 'ffffffff-ffff-4fff-8fff-fffffffffff1';
update public.student_invitations set expires_at = now() - interval '1 second' where student_id = 'aaaaaaaa-3333-4333-8333-333333333333' and used_at is null;
set local role authenticated;
select throws_ok($$select public.claim_student_invite(repeat('a',64))$$, '22023', null, 'expired invite cannot be claimed');
reset role;
update public.student_invitations set expires_at = now() + interval '1 hour' where student_id = 'aaaaaaaa-3333-4333-8333-333333333333' and used_at is null;
set local role authenticated;
select is(public.claim_student_invite(repeat('a',64)), 'aaaaaaaa-3333-4333-8333-333333333333'::uuid, 'verified invite links student to Auth user');
select is((select user_id from public.students where id = 'aaaaaaaa-3333-4333-8333-333333333333'), 'ffffffff-ffff-4fff-8fff-fffffffffff1'::uuid, 'student user_id linked');
select is((select count(*) from public.tenant_memberships where user_id = 'ffffffff-ffff-4fff-8fff-fffffffffff1' and role = 'ALUNO'), 1::bigint, 'claim creates one student membership');
select throws_ok($$select public.claim_student_invite(repeat('a',64))$$, '22023', null, 'invite cannot be reused');
reset role;
select is((select count(*) from public.audit_events where actor_user_id = 'ffffffff-ffff-4fff-8fff-fffffffffff1' and action = 'MEMBERSHIP_INSERT'), 1::bigint, 'membership activation audited');

select * from finish();
rollback;
