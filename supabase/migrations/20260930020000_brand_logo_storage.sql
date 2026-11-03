-- Private tenant logos. The path starts with the tenant UUID; the client path never grants access.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brand-logos', 'brand-logos', false, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create function public.can_access_brand_logo(p_name text, p_write boolean default false)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  v_tenant_id uuid;
begin
  if p_name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](png|jpg|webp)$'
     or (select auth.uid()) is null then
    return false;
  end if;
  v_tenant_id := split_part(p_name, '/', 1)::uuid;
  return public.tenant_access_allowed(v_tenant_id) and exists (
    select 1 from public.tenant_memberships m
    join public.user_profiles profile on profile.user_id = m.user_id
    where m.tenant_id = v_tenant_id and m.user_id = (select auth.uid())
      and m.active and profile.active
      and (not p_write or (m.role = 'PROFISSIONAL' and exists (
        select 1 from public.professionals p
        where p.tenant_id = m.tenant_id and p.user_id = m.user_id and p.active
      )))
  );
end $$;
revoke all on function public.can_access_brand_logo(text, boolean) from public, anon;
grant execute on function public.can_access_brand_logo(text, boolean) to authenticated;

create policy brand_logo_read on storage.objects for select to authenticated
  using (bucket_id = 'brand-logos' and public.can_access_brand_logo(name, false));
create policy brand_logo_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'brand-logos' and public.can_access_brand_logo(name, true));
create policy brand_logo_delete on storage.objects for delete to authenticated
  using (bucket_id = 'brand-logos' and public.can_access_brand_logo(name, true));
