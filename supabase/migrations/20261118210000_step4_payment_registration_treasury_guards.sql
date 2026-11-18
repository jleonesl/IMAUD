-- SITMAUD · Paso 4: controles transaccionales de recaudación y Tesorería.
-- Protege referencias bancarias y evita aplicar montos de una moneda distinta a VES.
create unique index if not exists payments_external_reference_normalized_unique
on public.payments (upper(btrim(external_reference)))
where external_reference is not null and btrim(external_reference)<>'';

create or replace function public.register_official_payment(
 p_contributor_id uuid,p_amount numeric,p_currency_code text,p_payment_method text,
 p_external_reference text,p_paid_at timestamptz,p_registration_channel text,
 p_evidence_path text,p_allocations jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_id uuid; v_receipt text; v_total numeric(14,2):=0; v_item jsonb;
 v_assessment public.assessments%rowtype; v_amount numeric(14,2);
 v_existing numeric(14,2); v_refs uuid[]; v_ref uuid;
begin
 if auth.uid() is null or not public.has_permission('payments.register') then
   raise exception 'No tienes permiso para registrar pagos' using errcode='42501';
 end if;
 -- Las obligaciones están denominadas en bolívares. Se deberá incorporar
 -- la conversión oficial fechada antes de habilitar pagos en divisas.
 if upper(coalesce(p_currency_code,''))<>'VES' then
   raise exception 'Para aplicar obligaciones se requiere monto en bolívares (VES). La conversión de divisas debe registrarse previamente.';
 end if;
 if p_amount is null or p_amount<=0 or round(p_amount,2)<>p_amount then
   raise exception 'El monto debe ser positivo y tener máximo dos decimales.';
 end if;
 if p_payment_method not in ('transferencia','pago_movil','punto_venta','efectivo') then
   raise exception 'Método de pago no permitido.';
 end if;
 if p_registration_channel not in ('taquilla','portal_contribuyente') then
   raise exception 'Canal de registro inválido.';
 end if;
 if length(btrim(coalesce(p_external_reference,'')))<3 then
   raise exception 'La referencia del pago es obligatoria.';
 end if;
 if p_paid_at is null or p_paid_at>now()+interval '5 minutes'
   or p_paid_at<now()-interval '90 days' then
   raise exception 'Fecha de pago fuera del período permitido. Requiere conciliación administrativa.';
 end if;
 if p_payment_method in ('transferencia','pago_movil','punto_venta')
    and length(btrim(coalesce(p_evidence_path,'')))<5 then
   raise exception 'El comprobante de pago es obligatorio para métodos bancarios.';
 end if;
 if not exists(select 1 from public.contributors where id=p_contributor_id) then
   raise exception 'Contribuyente no encontrado.';
 end if;
 if p_allocations is null or jsonb_typeof(p_allocations)<>'array'
    or jsonb_array_length(p_allocations)=0 or jsonb_array_length(p_allocations)>100 then
   raise exception 'Selecciona entre una y cien obligaciones.';
 end if;
 if exists(select 1 from jsonb_array_elements(p_allocations) x
    where jsonb_typeof(x)<>'object'
      or coalesce(x->>'assessment_id','') !~ '^[0-9a-fA-F-]{36}$'
      or coalesce(x->>'amount','') !~ '^[0-9]+(\.[0-9]{1,2})?$') then
   raise exception 'Aplicación inválida: se requieren ID y monto con máximo dos decimales.';
 end if;
 select array_agg((x->>'assessment_id')::uuid order by (x->>'assessment_id')::uuid)
 into v_refs from jsonb_array_elements(p_allocations) x;
 if (select count(distinct x) from unnest(v_refs) x)<>cardinality(v_refs) then
   raise exception 'No se puede incluir la misma obligación dos veces.';
 end if;
 -- Bloqueos ordenados para evitar dos registros concurrentes que excedan el saldo.
 foreach v_ref in array v_refs loop
   select * into v_assessment from public.assessments
     where id=v_ref and is_demo=false for update;
   if not found then raise exception 'La obligación % no existe en el registro oficial.',v_ref; end if;
   if not exists(select 1 from public.properties pr
     where pr.id=v_assessment.property_id and pr.contributor_id=p_contributor_id) then
     raise exception 'Una obligación no pertenece a este contribuyente.';
   end if;
   if v_assessment.status not in ('pending','partially_paid') then
     raise exception 'La obligación % ya está cancelada o anulada.',v_ref;
   end if;
 end loop;
 for v_item in select value from jsonb_array_elements(p_allocations) loop
   v_ref:=(v_item->>'assessment_id')::uuid;
   v_amount:=(v_item->>'amount')::numeric;
   if v_amount<=0 then raise exception 'Los importes de aplicación deben ser positivos.'; end if;
   select * into v_assessment from public.assessments where id=v_ref;
   select coalesce(sum(pa.amount),0) into v_existing from public.payment_allocations pa
   join public.payments py on py.id=pa.payment_id
   where pa.assessment_id=v_ref and py.status<>'reversed';
   if v_existing+v_amount>v_assessment.total_amount then
     raise exception 'La aplicación supera el saldo disponible de la obligación %.',v_ref;
   end if;
   v_total:=v_total+v_amount;
 end loop;
 if v_total<>p_amount then
   raise exception 'El total de aplicaciones (%) no coincide con el pago (%).',v_total,p_amount;
 end if;
 if exists(select 1 from public.payments
    where upper(btrim(external_reference))=upper(btrim(p_external_reference))) then
   raise exception 'Esta referencia ya fue registrada.';
 end if;
 v_receipt:='IMAUD-'||to_char(clock_timestamp(),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
 insert into public.payments(receipt_number,contributor_id,amount,currency_code,
   payment_method,external_reference,status,paid_at,registered_by,
   registration_channel,evidence_path,invoice_issued_at)
 values(v_receipt,p_contributor_id,p_amount,'VES',p_payment_method,
   btrim(p_external_reference),'pending',p_paid_at,auth.uid(),
   p_registration_channel,nullif(btrim(coalesce(p_evidence_path,'')),''),now())
 returning id into v_id;
 for v_item in select value from jsonb_array_elements(p_allocations) loop
   insert into public.payment_allocations(payment_id,assessment_id,amount)
   values(v_id,(v_item->>'assessment_id')::uuid,(v_item->>'amount')::numeric);
 end loop;
 insert into public.payment_treasury_events(payment_id,event_type,actor_id,notes)
 values(v_id,'registered',auth.uid(),'Pago y aplicaciones registrados. Pendiente de verificación bancaria.');
 return jsonb_build_object('payment_id',v_id,'receipt_number',v_receipt,
   'status','pending','liquidated',false);
end; $$;

create or replace function public.liquidate_official_payment(
 p_payment_id uuid,p_treasury_note text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
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
 if length(btrim(coalesce(p_treasury_note,'')))<8 then
   raise exception 'Tesorería debe documentar la verificación de la acreditación bancaria (mínimo 8 caracteres).';
 end if;
 if exists(select 1 from public.payments py
   where py.id<>p_payment_id and py.status='confirmed'
     and upper(btrim(py.external_reference))=upper(btrim(v_payment.external_reference))) then
   raise exception 'Referencia bancaria ya liquidada.';
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
 return jsonb_build_object('payment_id',p_payment_id,'status','confirmed',
   'treasury_verified_by',auth.uid(),'liquidated',true);
end; $$;

revoke all on function public.register_official_payment(uuid,numeric,text,text,text,timestamptz,text,text,jsonb) from public,anon;
grant execute on function public.register_official_payment(uuid,numeric,text,text,text,timestamptz,text,text,jsonb) to authenticated;
revoke all on function public.liquidate_official_payment(uuid,text) from public,anon;
grant execute on function public.liquidate_official_payment(uuid,text) to authenticated;
