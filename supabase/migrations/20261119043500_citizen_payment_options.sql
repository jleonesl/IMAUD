
create or replace function public.get_citizen_payment_options()
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare v_accounts jsonb;v_banks jsonb;
begin
 if auth.uid() is null or not exists(
  select 1 from public.citizen_accounts ca join public.contributors c on c.id=ca.contributor_id
  join auth.users u on u.id=ca.auth_user_id
  where ca.auth_user_id=auth.uid() and ca.is_active and c.status='active'
    and u.email_confirmed_at is not null and lower(u.email)=lower(c.email)
    and not exists(select 1 from public.staff_profiles sp where sp.user_id=auth.uid() and sp.is_active)
 ) then raise exception 'Solo contribuyentes con acceso verificado' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',id,'method',method,'bank',bank_name,'holder',holder_name,'rif',holder_rif,
  'account_number',account_number,'mobile_number',mobile_number) order by bank_name),'[]'::jsonb)
 into v_accounts from public.municipal_payment_accounts where is_published=true;
 select coalesce(jsonb_agg(jsonb_build_object('code',code,'name',name) order by name),'[]'::jsonb)
 into v_banks from public.payment_banks where is_active=true;
 return jsonb_build_object('accounts',v_accounts,'banks',v_banks);
end;$fn$;
revoke all on function public.get_citizen_payment_options() from public,anon;
grant execute on function public.get_citizen_payment_options() to authenticated;
