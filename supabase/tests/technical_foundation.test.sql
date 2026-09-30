begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(19);

set local role anon;
select throws_ok($$select count(*) from public.tenants$$, '42501', null, 'anon cannot read tenants');
select throws_ok($$select public.record_technical_operation('aaaaaaaa-0000-4000-8000-000000000001', 'dddddddd-0000-4000-8000-000000000005')$$, '42501', null, 'anon cannot call the operation RPC');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true);
select is((select count(*) from public.tenants), 1::bigint, 'A sees only its tenant');
select is((select count(*) from public.tenant_brand), 1::bigint, 'A sees only its brand');
select is((select count(*) from public.tenant_memberships), 1::bigint, 'A sees only its own membership');
select is((select count(*) from public.tenant_brand where tenant_id = 'bbbbbbbb-0000-4000-8000-000000000002'), 0::bigint, 'A cannot read B brand');
select results_eq($$update public.tenant_brand set display_name = 'intrusion' where tenant_id = 'bbbbbbbb-0000-4000-8000-000000000002' returning 1$$, $$select 1 where false$$, 'A cannot update B brand');
select results_eq($$update public.tenant_brand set display_name = 'A valid update' where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001' returning 1$$, $$select 1$$, 'A professional can update A brand');
select is(public.record_technical_operation('aaaaaaaa-0000-4000-8000-000000000001', 'dddddddd-0000-4000-8000-000000000001'), true, 'first operation creates receipt');
select is(public.record_technical_operation('aaaaaaaa-0000-4000-8000-000000000001', 'dddddddd-0000-4000-8000-000000000001'), false, 'retry does not create receipt');
select is((select count(*) from public.technical_operation_receipts where operation_id = 'dddddddd-0000-4000-8000-000000000001'), 1::bigint, 'one operation has one effect');
select throws_ok($$select public.record_technical_operation('bbbbbbbb-0000-4000-8000-000000000002', 'dddddddd-0000-4000-8000-000000000002')$$, '42501', null, 'A cannot write B receipt');

select set_config('request.jwt.claim.sub', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3', true);
select is((select count(*) from public.tenants), 0::bigint, 'user without membership sees no tenant');
select is((select count(*) from public.tenant_brand), 0::bigint, 'user without membership sees no brand');
select throws_ok($$select public.record_technical_operation('aaaaaaaa-0000-4000-8000-000000000001', 'dddddddd-0000-4000-8000-000000000003')$$, '42501', null, 'user without membership cannot write receipt');

select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', true);
select is((select count(*) from public.tenants), 1::bigint, 'B sees its own tenant');
select is((select count(*) from public.tenants where id = 'aaaaaaaa-0000-4000-8000-000000000001'), 0::bigint, 'B cannot read A');

reset role;
update public.tenant_memberships set active = false where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true);
select is((select count(*) from public.tenants), 0::bigint, 'inactive member sees no tenant');
select throws_ok($$select public.record_technical_operation('aaaaaaaa-0000-4000-8000-000000000001', 'dddddddd-0000-4000-8000-000000000004')$$, '42501', null, 'inactive member cannot write receipt');

select * from finish();
rollback;
