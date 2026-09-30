-- Fictional identities without passwords. Use separate local sign-up for interactive login.
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'authenticated', 'authenticated', 'a@example.invalid', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'authenticated', 'authenticated', 'b@example.invalid', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3', 'authenticated', 'authenticated', 'none@example.invalid', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', 'authenticated', 'authenticated', 'student-a1@example.invalid', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5', 'authenticated', 'authenticated', 'student-a2@example.invalid', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4', 'authenticated', 'authenticated', 'student-b1@example.invalid', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.tenants(id, name) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Tenant A'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'Tenant B');
insert into public.tenant_brand(tenant_id, brand_name, display_name, accent_color, secondary_color) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Tenant A', 'Tenant A (teste)', '#123B36', '#FFFFFF'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'Tenant B', 'Tenant B (teste)', '#37506B', '#FFFFFF');
insert into public.tenant_memberships(tenant_id, user_id, role) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'PROFISSIONAL'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'PROFISSIONAL'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', 'ALUNO'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5', 'ALUNO'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4', 'ALUNO');

insert into public.professionals(tenant_id, user_id, display_name) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'Profissional A'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'Profissional B');
insert into public.students(id, tenant_id, full_name, email, goal) values
  ('aaaaaaaa-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000001', 'Aluno A1', 'student-a1@example.invalid', 'Objetivo fictício'),
  ('aaaaaaaa-2222-4222-8222-222222222222', 'aaaaaaaa-0000-4000-8000-000000000001', 'Aluno A2', 'student-a2@example.invalid', null),
  ('bbbbbbbb-1111-4111-8111-111111111111', 'bbbbbbbb-0000-4000-8000-000000000002', 'Aluno B1', 'student-b1@example.invalid', null),
  ('aaaaaaaa-3333-4333-8333-333333333333', 'aaaaaaaa-0000-4000-8000-000000000001', 'Aluno sem conta', 'student-pending@example.invalid', null);
update public.students set user_id = case id
  when 'aaaaaaaa-1111-4111-8111-111111111111' then 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4'::uuid
  when 'aaaaaaaa-2222-4222-8222-222222222222' then 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5'::uuid
  else 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4'::uuid end
where id in ('aaaaaaaa-1111-4111-8111-111111111111', 'aaaaaaaa-2222-4222-8222-222222222222', 'bbbbbbbb-1111-4111-8111-111111111111');
