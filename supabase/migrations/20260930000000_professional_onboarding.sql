-- A platform administrator creates a tenant and invites its first professional.
-- The professional creates their own Auth credentials and claims the invitation.
create table public.professional_invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  email text not null check (email = lower(btrim(email)) and length(email) between 3 and 320),
  display_name text not null check (length(btrim(display_name)) between 1 and 160),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null default (now() + interval '48 hours'),
  used_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index professional_invitations_tenant_idx on public.professional_invitations(tenant_id);
alter table public.professional_invitations enable row level security;
revoke all on public.professional_invitations from public, anon, authenticated;

create function public.create_professional_tenant_invite(
  p_tenant_name text, p_professional_name text, p_professional_email text, p_token_hash text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_tenant uuid; v_expiry timestamptz; v_email text;
begin
  if auth.uid() is null or not exists (
    select 1 from public.platform_admins a
      join public.user_profiles p on p.user_id = a.user_id
    where a.user_id = auth.uid() and a.active and p.active
  ) then raise exception 'not authorized' using errcode = '42501'; end if;
  v_email := lower(btrim(p_professional_email));
  if p_tenant_name is null or length(btrim(p_tenant_name)) not between 1 and 160
    or p_professional_name is null or length(btrim(p_professional_name)) not between 1 and 160
    or v_email is null or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or length(v_email) > 320 or p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$'
  then raise exception 'invalid invitation' using errcode = '22023'; end if;

  insert into public.tenants(name) values (btrim(p_tenant_name)) returning id into v_tenant;
  insert into public.tenant_brand(tenant_id, brand_name, display_name, accent_color, secondary_color)
    values (v_tenant, btrim(p_tenant_name), btrim(p_professional_name), '#123B36', '#FFFFFF');
  insert into public.professional_invitations(tenant_id, email, display_name, token_hash, created_by)
    values (v_tenant, v_email, btrim(p_professional_name), p_token_hash, auth.uid())
    returning expires_at into v_expiry;
  insert into public.audit_events(tenant_id, actor_user_id, action, resource_id)
    values (v_tenant, auth.uid(), 'TENANT_CREATE', v_tenant);
  return jsonb_build_object('tenant_id', v_tenant, 'expires_at', v_expiry);
end $$;
revoke all on function public.create_professional_tenant_invite(text,text,text,text) from public, anon;
grant execute on function public.create_professional_tenant_invite(text,text,text,text) to authenticated;

create function public.claim_professional_invite(p_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_invite public.professional_invitations%rowtype; v_email text;
begin
  if auth.uid() is null or p_token is null or p_token !~ '^[0-9a-f]{64}$'
    then raise exception 'invalid invitation' using errcode = '22023'; end if;
  select * into v_invite from public.professional_invitations
    where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
      and used_at is null and expires_at > now() for update;
  if not found then raise exception 'invitation unavailable' using errcode = '22023'; end if;
  select lower(email) into v_email from auth.users
    where id = auth.uid() and email_confirmed_at is not null;
  if v_email is null or v_email <> v_invite.email
    or not exists (select 1 from public.user_profiles where user_id = auth.uid() and active)
    or exists (select 1 from public.tenant_memberships where tenant_id = v_invite.tenant_id and user_id = auth.uid())
  then raise exception 'invitation unavailable' using errcode = '42501'; end if;
  insert into public.tenant_memberships(tenant_id, user_id, role)
    values (v_invite.tenant_id, auth.uid(), 'PROFISSIONAL');
  insert into public.professionals(tenant_id, user_id, display_name)
    values (v_invite.tenant_id, auth.uid(), v_invite.display_name);
  update public.professional_invitations set used_at = now() where id = v_invite.id;
  insert into public.audit_events(tenant_id, actor_user_id, action, resource_id)
    values (v_invite.tenant_id, auth.uid(), 'PROFESSIONAL_ACTIVATE', auth.uid());
  return v_invite.tenant_id;
end $$;
revoke all on function public.claim_professional_invite(text) from public, anon;
grant execute on function public.claim_professional_invite(text) to authenticated;
