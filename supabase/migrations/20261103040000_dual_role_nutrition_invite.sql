-- A professional may claim a nutrition invitation in the same tenant without losing the professional role.
create or replace function public.claim_nutrition_invite(p_token text, p_crn text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_invite public.nutrition_invitations%rowtype; v_email text;
begin
  if auth.uid() is null or p_token is null or p_token !~ '^[0-9a-f]{64}$'
    or length(btrim(coalesce(p_crn,''))) not between 3 and 40
    then raise exception 'invalid invitation' using errcode = '22023'; end if;
  select * into v_invite from public.nutrition_invitations
    where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
      and used_at is null and expires_at > now() for update;
  if not found then raise exception 'invitation unavailable' using errcode = '22023'; end if;
  select lower(email) into v_email from auth.users where id = auth.uid() and email_confirmed_at is not null;
  if v_email is null or v_email <> v_invite.email or not public.tenant_access_allowed(v_invite.tenant_id)
    or not exists (select 1 from public.user_profiles where user_id = auth.uid() and active)
    or not exists (select 1 from public.students where id = v_invite.student_id and status = 'ACTIVE')
    then raise exception 'invitation unavailable' using errcode = '42501'; end if;
  if exists (select 1 from public.nutrition_assignments where tenant_id = v_invite.tenant_id and student_id = v_invite.student_id and active)
    then raise exception 'student already assigned' using errcode = '22023'; end if;
  if exists (select 1 from public.tenant_memberships where tenant_id = v_invite.tenant_id and user_id = auth.uid()
      and role not in ('NUTRICIONISTA','PROFISSIONAL'))
    then raise exception 'account has another role in this space' using errcode = '42501'; end if;
  insert into public.tenant_memberships(tenant_id, user_id, role)
    values (v_invite.tenant_id, auth.uid(), 'NUTRICIONISTA') on conflict (tenant_id,user_id) do update set active = true;
  insert into public.nutritionists(tenant_id,user_id,display_name,crn)
    values (v_invite.tenant_id,auth.uid(),v_invite.display_name,btrim(p_crn))
    on conflict (tenant_id,user_id) do update set active = true;
  insert into public.nutrition_assignments(tenant_id,student_id,nutritionist_user_id)
    values (v_invite.tenant_id,v_invite.student_id,auth.uid());
  update public.nutrition_invitations set used_at = now() where id = v_invite.id;
  insert into public.audit_events(tenant_id, actor_user_id, action, resource_id)
    values (v_invite.tenant_id, auth.uid(), 'NUTRITION_ACTIVATE', v_invite.student_id);
  return v_invite.tenant_id;
end $$;
revoke all on function public.claim_nutrition_invite(text,text) from public, anon;
grant execute on function public.claim_nutrition_invite(text,text) to authenticated;
