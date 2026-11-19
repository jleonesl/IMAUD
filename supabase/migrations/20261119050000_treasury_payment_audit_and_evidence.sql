CREATE OR REPLACE FUNCTION public.liquidate_official_payment(p_payment_id uuid, p_treasury_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_payment public.payments%rowtype; v_row record;
 v_confirmed numeric(14,2);v_payment_total numeric(14,2);
begin
 if auth.uid() is null or not public.has_permission('payments.validate') then
   raise exception 'Solo Tesorería con permiso puede liquidar pagos' using errcode='42501';
 end if;
 select * into v_payment from public.payments where id=p_payment_id for update;
 if not found or v_payment.status<>'pending' then
   raise exception 'Pago inexistente o no pendiente de liquidación.';
 end if;
 if v_payment.registered_by=auth.uid() then
   raise exception 'El funcionario que registró el pago no puede validarlo como Tesorería.';
 end if;
 if length(btrim(coalesce(p_treasury_note,'')))<20 then
   raise exception 'Tesorería debe documentar la verificación de la acreditación bancaria (mínimo 20 caracteres).';
 end if;
 if exists(select 1 from public.payments py
   where py.id<>p_payment_id and py.status='confirmed'
     and upper(btrim(py.external_reference))=upper(btrim(v_payment.external_reference))) then
   raise exception 'Referencia bancaria ya liquidada.';
 end if;
 if v_payment.registration_channel='portal_contribuyente' and
   (v_payment.evidence_path is null or
    not exists(select 1 from storage.objects o where o.bucket_id='imaud-payment-proofs'
      and o.name=v_payment.evidence_path)) then
   raise exception 'El comprobante ciudadano privado no está disponible; no se puede liquidar.';
 end if;
 if v_payment.external_reference is null or length(btrim(v_payment.external_reference))<3
    or v_payment.bank_code is null then
   raise exception 'Tesorería debe verificar banco y referencia registrados antes de liquidar.';
 end if;
 select coalesce(sum(amount),0) into v_payment_total
 from public.payment_allocations where payment_id=p_payment_id;
 if v_payment_total<>v_payment.amount then
   raise exception 'La suma aplicada (%) no coincide con el total del pago (%).',v_payment_total,v_payment.amount;
 end if;
 -- Serializar la liquidación por obligación: prevents concurrent overpayment.
 for v_row in
   select a.id from public.assessments a
   join public.payment_allocations pa on pa.assessment_id=a.id
   where pa.payment_id=p_payment_id order by a.id
 loop
   perform 1 from public.assessments where id=v_row.id for update;
 end loop;
 for v_row in
   select a.id,a.total_amount,
     coalesce((select sum(pa.amount) from public.payment_allocations pa
       join public.payments py on py.id=pa.payment_id
       where pa.assessment_id=a.id and py.status='confirmed'),0) as already_confirmed,
     pa.amount as incoming
   from public.payment_allocations pa
   join public.assessments a on a.id=pa.assessment_id
   where pa.payment_id=p_payment_id
 loop
   if v_row.already_confirmed+v_row.incoming>v_row.total_amount then
     raise exception 'La liquidación supera el saldo de la obligación %.',v_row.id;
   end if;
 end loop;
 update public.payments set status='confirmed',
   treasury_verified_at=now(),treasury_verified_by=auth.uid(),
   liquidated_at=now(),liquidated_by=auth.uid()
 where id=p_payment_id;
 for v_row in
   select a.id,a.total_amount,
     coalesce((select sum(pa.amount) from public.payment_allocations pa
      join public.payments py on py.id=pa.payment_id
      where pa.assessment_id=a.id and py.status='confirmed'),0) as confirmed
   from public.assessments a
   join public.payment_allocations allocated on allocated.assessment_id=a.id
   where allocated.payment_id=p_payment_id
 loop
   update public.assessments set
     status=case when v_row.confirmed>=v_row.total_amount then 'paid'
       else 'partially_paid' end
   where id=v_row.id;
 end loop;
 insert into public.payment_treasury_events(payment_id,event_type,actor_id,notes)
 values(p_payment_id,'liquidated',auth.uid(),btrim(p_treasury_note));
 insert into public.audit_log(actor_user_id,action,entity_table,entity_id,before_data,after_data)
 values(auth.uid(),'treasury_payment_liquidated','payments',p_payment_id::text,
  jsonb_build_object('status',v_payment.status,'liquidated_at',v_payment.liquidated_at),
  jsonb_build_object('status','confirmed','receipt_number',v_payment.receipt_number,
   'amount_bs',v_payment.amount,'treasury_verified_by',auth.uid(),
   'bank_code',v_payment.bank_code,'reference',v_payment.external_reference,
   'registration_channel',v_payment.registration_channel,
   'treasury_note',btrim(p_treasury_note)));
 return jsonb_build_object('payment_id',p_payment_id,'status','confirmed',
   'treasury_verified_by',auth.uid(),'liquidated',true);
end; $function$;

CREATE OR REPLACE FUNCTION public.reject_official_payment(p_payment_id uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_payment public.payments%rowtype;
begin
  if auth.uid() is null or not public.has_permission('payments.validate') then
    raise exception 'Solo Tesorería con permiso asignado puede rechazar pagos' using errcode='42501';
  end if;
  if length(btrim(coalesce(p_reason,'')))<8 then raise exception 'Indica el motivo del rechazo'; end if;
  select * into v_payment from public.payments where id=p_payment_id for update;
  if not found or v_payment.status<>'pending' then raise exception 'Solo se pueden rechazar pagos pendientes'; end if;
  update public.payments set status='reversed',reversed_at=now(),reversed_by=auth.uid(),reversal_reason=btrim(p_reason),rejection_reason=btrim(p_reason)
  where id=p_payment_id;
  insert into public.payment_treasury_events(payment_id,event_type,actor_id,notes)
  values(p_payment_id,'rejected',auth.uid(),btrim(p_reason));
  insert into public.audit_log(actor_user_id,action,entity_table,entity_id,before_data,after_data)
  values(auth.uid(),'treasury_payment_rejected','payments',p_payment_id::text,
   jsonb_build_object('status',v_payment.status,'receipt_number',v_payment.receipt_number),
   jsonb_build_object('status','reversed','reason',btrim(p_reason),
    'rejected_by',auth.uid(),'amount_bs',v_payment.amount,
    'bank_code',v_payment.bank_code,'reference',v_payment.external_reference));
  return jsonb_build_object('payment_id',p_payment_id,'status','reversed','reason',btrim(p_reason));
end;
$function$;
revoke all on function public.liquidate_official_payment(uuid,text) from public,anon;
revoke all on function public.reject_official_payment(uuid,text) from public,anon;
grant execute on function public.liquidate_official_payment(uuid,text) to authenticated;
grant execute on function public.reject_official_payment(uuid,text) to authenticated;