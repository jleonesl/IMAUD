-- SITMAUD: no permitir que una tasa diferente a la confirmada por el cajero
-- cambie silenciosamente el valor del cobro entre vista previa y registro.
alter function public.register_official_udc_payment(uuid,uuid[],text,text,text,text,timestamptz)
 rename to register_official_udc_payment_core;
revoke all on function public.register_official_udc_payment_core(uuid,uuid[],text,text,text,text,timestamptz) from public,anon,authenticated;
create or replace function public.register_official_udc_payment(
 p_contributor_id uuid,p_assessment_ids uuid[],p_payment_method text,
 p_external_reference text,p_bank_code text,p_evidence_path text,
 p_paid_at timestamptz,p_expected_rate_id uuid,p_expected_total_bs numeric
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_quote jsonb;v_result jsonb;v_rate public.udc_rates%rowtype;
begin
 if auth.uid() is null or not public.has_permission('payments.register') then
   raise exception 'Sin permiso para registrar pagos' using errcode='42501';
 end if;
 if p_expected_rate_id is null or p_expected_total_bs is null then
   raise exception 'Debes confirmar la tasa y el total del servidor antes de registrar.';
 end if;
 select * into v_rate from public.udc_rates where id=p_expected_rate_id for share;
 if not found then raise exception 'La tasa confirmada ya no existe.'; end if;
 v_quote:=public.quote_official_udc_payment(p_contributor_id,p_assessment_ids);
 if (v_quote->>'rate_id')::uuid<>p_expected_rate_id
    or (v_quote->>'total_bs')::numeric<>p_expected_total_bs then
    raise exception 'La tasa o el importe del pago cambió; vuelve a cotizar los meses antes de registrar.';
 end if;
 v_result:=public.register_official_udc_payment_core(
   p_contributor_id,p_assessment_ids,p_payment_method,p_external_reference,
   p_bank_code,p_evidence_path,p_paid_at);
 if (v_result->>'rate_date')::date<>v_rate.effective_date
    or (v_result->>'amount_bs')::numeric<>p_expected_total_bs then
   raise exception 'El valor registrado difiere de lo confirmado; transacción cancelada.';
 end if;
 return v_result;
end; $$;
revoke all on function public.register_official_udc_payment(uuid,uuid[],text,text,text,text,timestamptz,uuid,numeric) from public,anon;
grant execute on function public.register_official_udc_payment(uuid,uuid[],text,text,text,text,timestamptz,uuid,numeric) to authenticated;

-- Impedir el uso del registrador anterior que aplicaba bolívares congelados
-- al generar el cargo y no la tasa de la fecha del pago.
revoke all on function public.register_official_payment(uuid,numeric,text,text,text,timestamptz,text,text,jsonb) from public,anon,authenticated;