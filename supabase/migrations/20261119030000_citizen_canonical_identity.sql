-- Canonicalizar V-/E-/J- para permitir login ciudadano incluso si el expediente
-- ya guarda el prefijo. No modificar la cédula archivada ni datos del contribuyente.
create or replace function public.get_my_citizen_portal()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_a public.citizen_accounts%rowtype;v_c public.contributors%rowtype;v_verified bool;
begin
 if auth.uid() is null then raise exception 'Sesión ciudadana requerida' using errcode='42501';end if;
 select ca.* into v_a from public.citizen_accounts ca where ca.auth_user_id=auth.uid() and ca.is_active=true;
 if not found then return jsonb_build_object('activated',false);end if;
 select c.* into v_c from public.contributors c where c.id=v_a.contributor_id and c.status='active';
 if not found then return jsonb_build_object('activated',false);end if;
 select exists(select 1 from auth.users au where au.id=auth.uid() and au.email_confirmed_at is not null
   and lower(au.email)=lower(v_c.email)) into v_verified;
 if not v_verified or exists(select 1 from public.staff_profiles sp where sp.user_id=auth.uid() and sp.is_active) then
  return jsonb_build_object('activated',false);
 end if;
 return jsonb_build_object(
  'activated',true,'identity_type',v_a.identity_type,'contributor_id',v_c.id,
  'contract_number',v_c.contract_number,'service_account_type',v_c.service_account_type,
  'name',case when v_c.kind::text='juridico' then v_c.legal_name else trim(concat_ws(' ',v_c.first_name,v_c.last_name)) end,
  'identification',v_c.identification_type||'-'||regexp_replace(upper(v_c.identification_number),'^[VEJ][ -]?','','g'),
  'properties',coalesce((select jsonb_agg(jsonb_build_object(
    'id',p.id,'address',p.address,'parish',p.parish_name,'sector',p.sector_name,
    'consolidated',p.is_consolidated_master,'units',p.consolidated_units)
    order by p.created_at) from public.properties p where p.contributor_id=v_c.id and p.is_active),'[]'::jsonb),
  'obligations',coalesce((select jsonb_agg(jsonb_build_object(
    'id',a.id,'property_id',a.property_id,'period_start',a.period_start,
    'period_end',a.period_end,'amount_bs',a.total_amount,'status',a.status,
    'udc_coefficient',a.coefficient_snapshot,'units',coalesce(a.consolidated_unit_count_snapshot,1))
    order by a.period_start desc)
    from public.assessments a join public.properties p on p.id=a.property_id
    where p.contributor_id=v_c.id and p.is_active and a.is_demo=false),'[]'::jsonb),
  'payments',coalesce((select jsonb_agg(jsonb_build_object(
    'id',p.id,'receipt',p.receipt_number,'amount_bs',p.amount,'paid_at',p.paid_at,
    'method',p.payment_method,'status',p.status,'liquidated_at',p.liquidated_at,
    'bank',p.bank_code,'reference',p.external_reference)
    order by p.created_at desc)
    from public.payments p where p.contributor_id=v_c.id),'[]'::jsonb)
 );
end; $$;
revoke all on function public.get_my_citizen_portal() from public,anon;
grant execute on function public.get_my_citizen_portal() to authenticated;
