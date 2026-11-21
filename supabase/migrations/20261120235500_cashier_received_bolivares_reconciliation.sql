-- SITMAUD: keep amount owed to municipality separate from VES actually collected.
-- This first version supports exact amounts or cent-level excesses of up to Bs. 0.99.
-- The legal debt (payments.amount and payment_allocations.amount) is never increased.
alter table public.payments add column if not exists received_amount_bs numeric(18,2);
alter table public.payments add constraint payments_received_amount_bs_positive
  check (received_amount_bs is null or received_amount_bs>0);

create or replace function public.register_official_udc_received_payment(
 p_contributor_id uuid,p_assessment_ids uuid[],p_payment_method text,
 p_external_reference text,p_bank_code text,p_evidence_path text,
 p_paid_at timestamptz,p_expected_rate_id uuid,p_expected_total_bs numeric,
 p_received_bs numeric
) returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare v_result jsonb; v_payment_id uuid; v_quote numeric(18,2);v_received numeric(18,2);
begin
 if auth.uid() is null or not public.has_permission('payments.register') then
  raise exception 'Sin permiso para registrar pagos' using errcode='42501';
 end if;
 if p_received_bs is null or p_received_bs<=0 or p_received_bs<>round(p_received_bs,2) then
  raise exception 'Ingresa el importe realmente recibido en Bs. con máximo dos decimales';
 end if;
 if p_expected_total_bs is null or p_received_bs<p_expected_total_bs
   or p_received_bs>p_expected_total_bs+0.99 then
  raise exception 'El monto recibido debe estar entre el total cotizado y un máximo de Bs. 0,99 adicionales. Diferencias mayores requieren conciliación específica.';
 end if;
 v_result:=public.register_official_udc_payment(
   p_contributor_id,p_assessment_ids,p_payment_method,p_external_reference,
   p_bank_code,p_evidence_path,p_paid_at,p_expected_rate_id,p_expected_total_bs);
 v_payment_id:=(v_result->>'payment_id')::uuid;
 v_quote:=(v_result->>'amount_bs')::numeric;
 v_received:=p_received_bs;
 if v_received<v_quote or v_received>v_quote+0.99 then
  raise exception 'La cotización cambió; vuelve a calcular el importe antes de registrar';
 end if;
 update public.payments set received_amount_bs=v_received where id=v_payment_id;
 insert into public.audit_log(actor_user_id,action,entity_table,entity_id,after_data)
 values(auth.uid(),'payment_actual_ves_recorded','payments',v_payment_id::text,
  jsonb_build_object('receipt_number',v_result->>'receipt_number',
   'assessed_bs',v_quote,'received_bs',v_received,'excess_bs',v_received-v_quote,
   'currency','VES'));
 return v_result || jsonb_build_object('assessed_bs',v_quote,
    'received_bs',v_received,'excess_bs',v_received-v_quote);
end $fn$;

create or replace function public.register_official_pos_received_payment(
 p_contributor_id uuid,p_assessment_ids uuid[],p_external_reference text,
 p_bank_code text,p_evidence_path text,p_paid_at timestamptz,
 p_expected_rate_id uuid,p_expected_total_bs numeric,p_pos_terminal_id uuid,
 p_received_bs numeric
) returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare v_result jsonb; v_payment_id uuid;v_quote numeric(18,2);
begin
 if auth.uid() is null or not public.has_permission('payments.register') then
  raise exception 'Sin permiso para registrar pagos' using errcode='42501';
 end if;
 if p_received_bs is null or p_received_bs<=0 or p_received_bs<>round(p_received_bs,2)
   or p_expected_total_bs is null or p_received_bs<p_expected_total_bs
   or p_received_bs>p_expected_total_bs+0.99 then
  raise exception 'Indica el monto recibido exacto, con hasta Bs. 0,99 adicionales sobre el total calculado';
 end if;
 v_result:=public.register_official_pos_payment(
  p_contributor_id,p_assessment_ids,p_external_reference,p_bank_code,p_evidence_path,
  p_paid_at,p_expected_rate_id,p_expected_total_bs,p_pos_terminal_id);
 v_payment_id:=(v_result->>'payment_id')::uuid;
 v_quote:=(v_result->>'amount_bs')::numeric;
 if p_received_bs<v_quote or p_received_bs>v_quote+0.99 then
  raise exception 'El monto calculado cambió. Debes cotizar nuevamente.';
 end if;
 update public.payments set received_amount_bs=p_received_bs where id=v_payment_id;
 insert into public.audit_log(actor_user_id,action,entity_table,entity_id,after_data)
 values(auth.uid(),'payment_actual_ves_recorded','payments',v_payment_id::text,
  jsonb_build_object('receipt_number',v_result->>'receipt_number',
   'assessed_bs',v_quote,'received_bs',p_received_bs,'excess_bs',p_received_bs-v_quote,
   'currency','VES','pos_terminal_id',p_pos_terminal_id));
 return v_result || jsonb_build_object('assessed_bs',v_quote,
  'received_bs',p_received_bs,'excess_bs',p_received_bs-v_quote);
end $fn$;

revoke all on function public.register_official_udc_received_payment(
 uuid,uuid[],text,text,text,text,timestamptz,uuid,numeric,numeric) from public,anon;
grant execute on function public.register_official_udc_received_payment(
 uuid,uuid[],text,text,text,text,timestamptz,uuid,numeric,numeric) to authenticated;
revoke all on function public.register_official_pos_received_payment(
 uuid,uuid[],text,text,text,timestamptz,uuid,numeric,uuid,numeric) from public,anon;
grant execute on function public.register_official_pos_received_payment(
 uuid,uuid[],text,text,text,timestamptz,uuid,numeric,uuid,numeric) to authenticated;

-- Existing payment records remain valid: null means legacy and corresponds
-- to their historical payments.amount, never converted at today's exchange rate.
-- Financial views/report totals must use coalesce(received_amount_bs,amount).
do $patch$
declare n text;definition text;updated text;
begin
 foreach n in array array['get_official_financial_overview',
   'get_official_operations_report','get_pos_terminal_report'] loop
  select pg_get_functiondef(p.oid) into definition
  from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
  where ns.nspname='public' and p.proname=n;
  if definition is null then raise exception 'Missing financial report %',n;end if;
  updated:=definition;
  if n='get_official_financial_overview' then
   updated:=replace(updated,'sum(amount) filter(where','sum(coalesce(received_amount_bs,amount)) filter(where');
  elsif n='get_official_operations_report' then
   updated:=replace(updated,'sum(py.amount)','sum(coalesce(py.received_amount_bs,py.amount))');
   updated:=replace(updated,'''amount'',p.amount,',
    '''amount'',coalesce(p.received_amount_bs,p.amount),
     ''assessed_bs'',p.amount,''received_bs'',coalesce(p.received_amount_bs,p.amount),
     ''excess_bs'',greatest(coalesce(p.received_amount_bs,p.amount)-p.amount,0),');
  else
   updated:=replace(updated,'sum(p.amount)','sum(coalesce(p.received_amount_bs,p.amount))');
   updated:=replace(updated,'''amount_bs'',p.amount,',
     '''amount_bs'',coalesce(p.received_amount_bs,p.amount),
      ''assessed_bs'',p.amount,''excess_bs'',greatest(coalesce(p.received_amount_bs,p.amount)-p.amount,0),');
  end if;
  if updated=definition then raise exception 'Report % was not patched',n;end if;
  execute updated;
 end loop;
end $patch$;
