begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select is((select relrowsecurity from pg_class where oid = 'public.tenant_plans'::regclass), true, 'plans have RLS');
select is((select count(*) from public.tenant_plans where tenant_id in (
  'aaaaaaaa-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002'
)), 2::bigint, 'existing tenants have plans');

set local role anon;
select throws_ok($$select count(*) from public.tenant_plans$$, '42501', null, 'anon cannot read plans');
select throws_ok($$select * from public.list_platform_spaces()$$, '42501', null, 'anon cannot list platform spaces');
select throws_ok($$select public.set_platform_space_plan('aaaaaaaa-0000-4000-8000-000000000001','MENSAL',null,false)$$, '42501', null, 'anon cannot edit plans');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true);
select is((select count(*) from public.list_platform_spaces()), 0::bigint, 'professional cannot list platform spaces');
select throws_ok($$select public.set_platform_space_plan('aaaaaaaa-0000-4000-8000-000000000001','MENSAL',null,false)$$, '42501', null, 'professional cannot edit plans');
select throws_ok($$select count(*) from public.tenant_plans$$, '42501', null, 'professional cannot read plans directly');

reset role;
insert into public.platform_admins(user_id) values ('cccccccc-cccc-4ccc-8ccc-ccccccccccc3');
set local role authenticated;
select set_config('request.jwt.claim.sub', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3', true);
select ok((select count(*) from public.list_platform_spaces()) >= 2, 'admin lists spaces and professionals');
select is((select professional_email from public.list_platform_spaces()
  where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001'), 'a@example.invalid', 'admin sees initial professional email');
select is((select count(*) from public.students), 0::bigint, 'admin does not gain student access');
select public.set_platform_space_plan('aaaaaaaa-0000-4000-8000-000000000001','MENSAL',null,false);
select is((select plan_type from public.list_platform_spaces()
  where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001'), 'MENSAL', 'admin changes plan type');
select is((select plan_active from public.list_platform_spaces()
  where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001'), false, 'admin suspends space');
select is((select count(*) from public.tenants where id = 'aaaaaaaa-0000-4000-8000-000000000001'), 0::bigint, 'admin has no tenant read bypass');

select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true);
select is((select count(*) from public.tenant_memberships), 0::bigint, 'suspended professional loses membership visibility');
select is((select count(*) from public.students), 0::bigint, 'suspended professional loses student access');
select throws_ok($$select public.create_student_invite('aaaaaaaa-3333-4333-8333-333333333333',repeat('a',64))$$,
  '42501', null, 'suspended professional cannot issue student invite');
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', true);
select is((select count(*) from public.students), 0::bigint, 'suspended student loses access');
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', true);
select is((select count(*) from public.students where id = 'bbbbbbbb-1111-4111-8111-111111111111'), 1::bigint, 'other tenant remains available');

select set_config('request.jwt.claim.sub', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3', true);
select public.set_platform_space_plan('aaaaaaaa-0000-4000-8000-000000000001','ANUAL',
  (now() at time zone 'America/Sao_Paulo')::date - 1,true);
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true);
select is((select count(*) from public.students), 0::bigint, 'expired plan denies access');
select set_config('request.jwt.claim.sub', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3', true);
select public.set_platform_space_plan('aaaaaaaa-0000-4000-8000-000000000001','ANUAL',null,true);
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true);
select is((select count(*) from public.students where id in (
  'aaaaaaaa-1111-4111-8111-111111111111', 'aaaaaaaa-2222-4222-8222-222222222222',
  'aaaaaaaa-3333-4333-8333-333333333333')), 3::bigint, 'reactivation restores access without data loss');
reset role;
select is((select count(*) from public.audit_events where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001'
  and action = 'SPACE_PLAN_UPDATE'), 3::bigint, 'plan changes are audited');

select * from finish();
rollback;
