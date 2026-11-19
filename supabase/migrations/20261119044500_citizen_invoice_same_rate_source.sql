-- Recibos: el ciudadano solo puede obtener pagos oficiales propios y confirmados.
create or replace function public.get_my_citizen_receipt(p_payment_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_portal jsonb;v_owner uuid;v_payment public.payments%rowtype;v_count int;
 v_amount numeric;v_bad int;v_details jsonb;v_c public.contributors%rowtype;
 v_rate public.udc_rates%rowtype;
begin
 v_portal:=public.get_my_citizen_portal();
 if coalesce((v_portal->>'activated')::boolean,false) is distinct from true then
   raise exception 'Acceso ciudadano no habilitado' using errcode='42501';
 end if;
 v_owner:=(v_portal->>'contributor_id')::uuid;
 select * into v_payment from public.payments
 where id=p_payment_id and contributor_id=v_owner
 and status='confirmed' and liquidated_at is not null;
 if not found then
   raise exception 'No se encontró un recibo liquidado en este expediente' using errcode='42501';
 end if;
 select * into v_c from public.contributors where id=v_owner;
 select * into v_rate from public.udc_rates where id=v_payment.payment_udc_rate_id;
 select count(*),coalesce(sum(pa.amount),0),
   count(*) filter(where ass.id is null or ass.is_demo or prop.contributor_id is distinct from v_owner),
   coalesce(jsonb_agg(jsonb_build_object(
     'period',ass.period_start,'end',ass.period_end,
     'amount_bs',pa.amount,'udc_amount',pa.udc_amount,
     'address',prop.address,'sector',prop.sector_name,'parish',prop.parish_name,
     'typology',coalesce(prop.typology_override,sec.default_typology,'Sin tipología'))
     order by ass.period_start),'[]'::jsonb)
 into v_count,v_amount,v_bad,v_details
 from public.payment_allocations pa
 left join public.assessments ass on ass.id=pa.assessment_id
 left join public.properties prop on prop.id=ass.property_id
 left join public.sectors sec on sec.id=prop.sector_id
 where pa.payment_id=v_payment.id;
 if v_count=0 or v_bad>0 or abs(v_amount-v_payment.amount)>0.01 then
   raise exception 'Las aplicaciones del recibo no están verificadas';
 end if;
 return jsonb_build_object(
  'receipt_number',v_payment.receipt_number,'contract',v_c.contract_number,
  'contributor_name',case when v_c.kind::text='juridico' then v_c.legal_name
       else concat_ws(' ',v_c.first_name,v_c.last_name) end,
  'identity',v_c.identification_type||'-'||v_c.identification_number,
  'issued_at',coalesce(v_payment.invoice_issued_at,v_payment.liquidated_at),
  'liquidated_at',v_payment.liquidated_at,
  'payment_method',v_payment.payment_method,'bank',v_payment.bank_code,
  'reference',v_payment.external_reference,'status','confirmed',
  'currency','VES','amount_bs',v_payment.amount,
  'udc_total',v_payment.payment_udc_total,
  'udc_rate_bs',v_rate.udc_value,'udc_currency',v_rate.udc_currency_code,
  'rate_date',v_rate.effective_date,'rate_source_url',v_rate.source_url,'periods',v_details);
end; $$;
revoke all on function public.get_my_citizen_receipt(uuid) from public,anon;
grant execute on function public.get_my_citizen_receipt(uuid) to authenticated;
