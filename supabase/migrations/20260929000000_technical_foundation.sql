create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now()
);

create table public.tenant_brand (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) > 0),
  accent_color text not null check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  updated_at timestamptz not null default now()
);

create table public.tenant_memberships (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('PROFESSIONAL', 'STUDENT')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);
create index tenant_memberships_user_idx on public.tenant_memberships(user_id, tenant_id) where active;

create table public.technical_operation_receipts (
  user_id uuid not null references auth.users(id) on delete cascade,
  operation_id uuid not null,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, operation_id)
);

alter table public.tenants enable row level security;
alter table public.tenant_brand enable row level security;
alter table public.tenant_memberships enable row level security;
alter table public.technical_operation_receipts enable row level security;

revoke all on public.tenants, public.tenant_brand, public.tenant_memberships,
  public.technical_operation_receipts from anon, authenticated;
grant select on public.tenants, public.tenant_memberships to authenticated;
grant select, update on public.tenant_brand to authenticated;
grant select, insert on public.technical_operation_receipts to authenticated;

-- A membership can only reveal its own row. This avoids recursive RLS policies.
create policy membership_select_own on public.tenant_memberships
  for select to authenticated using (user_id = (select auth.uid()));

create policy tenant_select_member on public.tenants
  for select to authenticated using (
    exists (select 1 from public.tenant_memberships m
      where m.tenant_id = id and m.user_id = (select auth.uid()) and m.active)
  );

create policy brand_select_member on public.tenant_brand
  for select to authenticated using (
    exists (select 1 from public.tenant_memberships m
      where m.tenant_id = tenant_brand.tenant_id and m.user_id = (select auth.uid()) and m.active)
  );
create policy brand_update_professional on public.tenant_brand
  for update to authenticated
  using (exists (select 1 from public.tenant_memberships m
    where m.tenant_id = tenant_brand.tenant_id and m.user_id = (select auth.uid())
      and m.active and m.role = 'PROFESSIONAL'))
  with check (exists (select 1 from public.tenant_memberships m
    where m.tenant_id = tenant_brand.tenant_id and m.user_id = (select auth.uid())
      and m.active and m.role = 'PROFESSIONAL'));

create policy receipt_select_own on public.technical_operation_receipts
  for select to authenticated using (user_id = (select auth.uid()) and exists (
    select 1 from public.tenant_memberships m where m.tenant_id = technical_operation_receipts.tenant_id
      and m.user_id = (select auth.uid()) and m.active));
create policy receipt_insert_member on public.technical_operation_receipts
  for insert to authenticated with check (user_id = (select auth.uid()) and exists (
    select 1 from public.tenant_memberships m where m.tenant_id = technical_operation_receipts.tenant_id
      and m.user_id = (select auth.uid()) and m.active));

-- The receipt insertion is the technical side effect; the PK makes retries idempotent.
-- SECURITY INVOKER preserves the caller's RLS and membership checks.
create function public.record_technical_operation(p_tenant_id uuid, p_operation_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare inserted_count integer;
begin
  insert into public.technical_operation_receipts(user_id, operation_id, tenant_id)
    values (auth.uid(), p_operation_id, p_tenant_id)
    on conflict (user_id, operation_id) do nothing;
  get diagnostics inserted_count = row_count;
  return inserted_count = 1;
end;
$$;
revoke all on function public.record_technical_operation(uuid, uuid) from public, anon;
grant execute on function public.record_technical_operation(uuid, uuid) to authenticated;
