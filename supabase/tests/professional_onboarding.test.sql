begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select is((select relrowsecurity from pg_class where oid = 'public.professional_invitations'::regclass), true, 'professional invitations have RLS');

set local role anon;
select throws_ok($$select count(*) from public.professional_invitations$$, '42501', null, 'anon cannot read professional invitations');
select throws_ok($$select public.create_professional_tenant_invite('Intruso','Intruso','x@example.invalid',repeat('a',64))$$, '42501', null, 'anon cannot create tenant');
select throws_ok($$select public.claim_professional_invite(repeat('a',64))$$, '42501', null, 'anon cannot claim invitation');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true);
select throws_ok($$select public.create_professional_tenant_invite('Intruso','Intruso','x@example.invalid',repeat('a',64))$$, '42501', null, 'professional cannot create tenant');
select throws_ok($$insert into public.tenants(name) values ('Intruso')$$, '42501', null, 'client cannot insert tenant directly');
select throws_ok($$select count(*) from public.professional_invitations$$, '42501', null, 'professional cannot read invitation hashes');

reset role;
insert into public.platform_admins(user_id) values ('cccccccc-cccc-4ccc-8ccc-ccccccccccc3');
insert into auth.users(instance_id,id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('00000000-0000-0000-0000-000000000000','dddddddd-dddd-4ddd-8ddd-ddddddddddd1','authenticated','authenticated','new-pro@example.invalid',now(),'{}','{}',now(),now());

set local role authenticated;
select set_config('request.jwt.claim.sub', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3', true);
select set_config('test.tenant_id', public.create_professional_tenant_invite('Novo Tenant','Novo Personal','NEW-PRO@example.invalid',
  encode(extensions.digest(repeat('b',64),'sha256'),'hex'))->>'tenant_id', true);
select is((select count(*) from public.tenants where id = current_setting('test.tenant_id')::uuid), 0::bigint, 'admin has no tenant read bypass');
select is((select count(*) from public.students), 0::bigint, 'admin has no student read bypass');

reset role;
select is((select count(*) from public.tenants where id = current_setting('test.tenant_id')::uuid), 1::bigint, 'tenant created');
select is((select count(*) from public.tenant_brand where tenant_id = current_setting('test.tenant_id')::uuid), 1::bigint, 'tenant brand created');
select is((select count(*) from public.professional_invitations where tenant_id = current_setting('test.tenant_id')::uuid and email = 'new-pro@example.invalid' and used_at is null), 1::bigint, 'hashed invitation created for normalized email');
select is((select count(*) from public.professional_invitations where token_hash = repeat('b',64)), 0::bigint, 'raw token not stored');
select is((select count(*) from public.audit_events where tenant_id = current_setting('test.tenant_id')::uuid and action = 'TENANT_CREATE'), 1::bigint, 'tenant creation audited');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true);
select throws_ok($$select public.claim_professional_invite(repeat('b',64))$$, '42501', null, 'different email cannot claim professional invite');
reset role;
update auth.users set email_confirmed_at = null where id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1', true);
select throws_ok($$select public.claim_professional_invite(repeat('b',64))$$, '42501', null, 'unconfirmed email cannot claim professional invite');
reset role;
update auth.users set email_confirmed_at = now() where id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1';
update public.professional_invitations set expires_at = now() - interval '1 second' where tenant_id = current_setting('test.tenant_id')::uuid;
set local role authenticated;
select throws_ok($$select public.claim_professional_invite(repeat('b',64))$$, '22023', null, 'expired professional invite cannot be claimed');
reset role;
update public.professional_invitations set expires_at = now() + interval '1 hour' where tenant_id = current_setting('test.tenant_id')::uuid;
set local role authenticated;
select is(public.claim_professional_invite(repeat('b',64)), current_setting('test.tenant_id')::uuid, 'matching account claims tenant');
select throws_ok($$select public.claim_professional_invite(repeat('b',64))$$, '22023', null, 'professional invite is single use');
select is((select count(*) from public.tenant_brand where tenant_id = current_setting('test.tenant_id')::uuid), 1::bigint, 'professional reads own brand after activation');
select is((select count(*) from public.students where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001'), 0::bigint, 'new professional cannot read Tenant A students');
reset role;
select is((select count(*) from public.professionals where tenant_id = current_setting('test.tenant_id')::uuid and user_id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1'), 1::bigint, 'professional profile created');
select is((select count(*) from public.tenant_memberships where tenant_id = current_setting('test.tenant_id')::uuid and user_id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1' and role = 'PROFISSIONAL'), 1::bigint, 'professional membership created');
select is((select count(*) from public.audit_events where tenant_id = current_setting('test.tenant_id')::uuid and action = 'PROFESSIONAL_ACTIVATE'), 1::bigint, 'professional activation audited');

select * from finish();
rollback;
