-- SITMAUD · Paso 4. Cobro oficial íntegro por períodos, con tasa del día del pago.
-- Los cargos conservan en audit_log su valor anterior; se almacenan los snapshots.
alter table public.payments add column if not exists bank_code text;
alter table public.payments add column if not exists payment_udc_rate_id uuid references public.udc_rates(id);
alter table public.payments add column if not exists payment_udc_total numeric(18,4);
alter table public.payment_allocations add column if not exists udc_amount numeric(18,4);
create index if not exists payments_payment_udc_rate_idx on public.payments(payment_udc_rate_id);
create index if not exists payment_allocations_assessment_idx on public.payment_allocations(assessment_id);

-- La evidencia oficial puede ser leída por funcionarios con permiso y solo
-- si está vinculada a un pago oficial; no se publica el bucket.
drop policy if exists payment_proof_read_staff on storage.objects;
create policy payment_proof_read_staff on storage.objects for select to authenticated using (
 bucket_id='imaud-payment-proofs' and public.has_permission('payments.read')
 and (exists(select 1 from public.payments py where py.evidence_path=objects.name)
      or exists(select 1 from public.demo_payments dp where dp.proof_storage_path=objects.name))
);
drop policy if exists payment_proof_cleanup_unattached on storage.objects;
create policy payment_proof_cleanup_unattached on storage.objects for delete to authenticated using (
 bucket_id='imaud-payment-proofs'
 and public.has_permission('payments.register')
 and owner_id=(select auth.uid())::text
 and not exists(select 1 from public.payments py where py.evidence_path=objects.name)
 and not exists(select 1 from public.demo_payments dp where dp.proof_storage_path=objects.name)
);

create or replace function public.quote_official_udc_payment(
 p_contributor_id uuid,p_assessment_ids uuid[]
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_rate public.udc_rates%rowtype;
 v_today date := (now() at time zone 'America/Caracas')::date;
 v_id uuid;v_a public.assessments%rowtype;v_udc numeric(18,4);
 v_bs numeric(18,2);v_total numeric(18,2):=0;v_total_udc numeric(18,4):=0;
 v_items jsonb:='[]'::jsonb;
begin
 if auth.uid() is null or not (public.has_permission('payments.register') or public.has_permission('payments.read')) then
   raise exception 'Sin permiso para consultar liquidaciones' using errcode='42501';
 end if;
 if p_contributor_id is null or p_assessment_ids is null
   or cardinality(p_assessment_ids) not between 1 and 100
   or cardinality(p_assessment_ids)<>(select count(distinct x) from unnest(p_assessment_ids) x) then
   raise exception 'Debes seleccionar obligaciones distintas (máximo 100)';
 end if;
 select * into v_rate from public.udc_rates where effective_date<=v_today
   and source_url in ('https://www.bcv.org.ve/','https://bcv.today/api/v1/rate.json')
   order by effective_date desc limit 1;
 if not found or v_rate.effective_date < v_today-3 then
   raise exception 'No hay tasa UCD válida para el pago de hoy.';
 end if;
 foreach v_id in array p_assessment_ids loop
   select * into v_a from public.assessments where id=v_id and is_demo=false;
   if not found or v_a.status<>'pending' or v_a.period_start<date '2027-01-01' then
     raise exception 'Obligación inexistente, ya aplicada o fuera del período oficial: %',v_id;
   end if;
   if v_a.coefficient_snapshot is null or v_a.coefficient_snapshot<=0
     or v_a.udc_value_snapshot is null or v_a.udc_value_snapshot<=0 then
     raise exception 'Obligación sin snapshots de UCD: %',v_id;
   end if;
   if v_a.adjustment_amount<>0 then
     raise exception 'El mes % tiene ajustes/exoneraciones; requiere conciliación específica.',v_a.period_start;
   end if;
   if not exists(select 1 from public.properties pr where pr.id=v_a.property_id
     and pr.contributor_id=p_contributor_id and pr.is_active=true) then
     raise exception 'Una obligación no corresponde al contribuyente activo.';
   end if;
   if exists(select 1 from public.payment_allocations pa
     join public.payments py on py.id=pa.payment_id
     where pa.assessment_id=v_id and py.status<>'reversed') then
     raise exception 'El mes % tiene un pago pendiente o confirmado.',v_a.period_start;
   end if;
   v_udc:=v_a.coefficient_snapshot*coalesce(v_a.consolidated_unit_count_snapshot,1);
   v_bs:=round(v_udc*v_rate.udc_value,2);
   v_total:=v_total+v_bs;v_total_udc:=v_total_udc+v_udc;
   v_items:=v_items||jsonb_build_array(jsonb_build_object(
     'assessment_id',v_id,'period_start',v_a.period_start,
     'udc_amount',v_udc,'amount_bs',v_bs,
     'units',coalesce(v_a.consolidated_unit_count_snapshot,1)));
 end loop;
 return jsonb_build_object('effective_date',v_rate.effective_date,
   'rate_id',v_rate.id,'rate',v_rate.udc_value,'currency',v_rate.udc_currency_code,
   'source_url',v_rate.source_url,'total_udc',v_total_udc,
   'total_bs',v_total,'allocations',v_items);
end; $$;

create or replace function public.register_official_udc_payment(
 p_contributor_id uuid,p_assessment_ids uuid[],p_payment_method text,
 p_external_reference text,p_bank_code text,p_evidence_path text,p_paid_at timestamptz
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_rate public.udc_rates%rowtype;v_today date:=(now() at time zone 'America/Caracas')::date;
 v_id uuid;v_assessment public.assessments%rowtype;
 v_udc numeric(18,4);v_amount numeric(18,2);
 v_total numeric(18,2):=0;v_total_udc numeric(18,4):=0;
 v_payment_id uuid;v_receipt text;v_evidence text:=btrim(coalesce(p_evidence_path,''));
begin
 if auth.uid() is null or not public.has_permission('payments.register') then
   raise exception 'Sin permiso para registrar pagos' using errcode='42501';
 end if;
 if p_paid_at is null or (p_paid_at at time zone 'America/Caracas')::date<>v_today
   or p_paid_at>now()+interval '5 minutes' then
   raise exception 'El cobro con tasa diaria requiere fecha de pago de hoy; los pagos históricos requieren conciliación especial.';
 end if;
 if p_payment_method not in ('transferencia','pago_movil','punto_venta') then
   raise exception 'Este procedimiento exige un pago bancario verificable.';
 end if;
 if length(btrim(coalesce(p_external_reference,'')))<3 then
   raise exception 'Referencia bancaria obligatoria';
 end if;
 if not exists(select 1 from public.payment_banks b where b.code=p_bank_code and b.is_active=true) then
   raise exception 'Selecciona un banco del catálogo oficial';
 end if;
 if length(v_evidence)<8 or split_part(v_evidence,'/',1)<>p_contributor_id::text then
   raise exception 'Comprobante inválido: debe pertenecer al expediente del contribuyente';
 end if;
 if not exists(select 1 from storage.objects o
   where o.bucket_id='imaud-payment-proofs' and o.name=v_evidence
     and o.owner_id=auth.uid()::text) then
   raise exception 'El comprobante no está cargado en el repositorio privado del funcionario';
 end if;
 if p_assessment_ids is null or cardinality(p_assessment_ids) not between 1 and 100
    or cardinality(p_assessment_ids)<>(select count(distinct x) from unnest(p_assessment_ids) x) then
   raise exception 'Selecciona obligaciones únicas (máximo 100)';
 end if;
 select * into v_rate from public.udc_rates where effective_date<=v_today
 and source_url in ('https://www.bcv.org.ve/','https://bcv.today/api/v1/rate.json')
 order by effective_date desc limit 1;
 if not found or v_rate.effective_date<v_today-3 then
   raise exception 'La tasa BCV/UCD no está vigente para el pago de hoy.';
 end if;
 -- El bloqueo del conjunto de obligaciones garantiza consistencia al registrar.
 for v_id in select unnest(p_assessment_ids) order by 1 loop
   select * into v_assessment from public.assessments
    where id=v_id and is_demo=false for update;
   if not found or v_assessment.status<>'pending'
     or v_assessment.period_start<date '2027-01-01' then
     raise exception 'Mes no disponible para cobro: %',v_id;
   end if;
   if v_assessment.coefficient_snapshot is null or v_assessment.coefficient_snapshot<=0
      or v_assessment.udc_value_snapshot is null or v_assessment.udc_value_snapshot<=0
      or v_assessment.adjustment_amount<>0 then
     raise exception 'La obligación % requiere revisión de UCD/ajustes.',v_id;
   end if;
   if not exists(select 1 from public.properties pr
      where pr.id=v_assessment.property_id and pr.contributor_id=p_contributor_id
      and pr.is_active=true) then
     raise exception 'Obligación no vinculada al contribuyente';
   end if;
   if exists(select 1 from public.payment_allocations pa join public.payments py
      on py.id=pa.payment_id where pa.assessment_id=v_id and py.status<>'reversed') then
     raise exception 'El mes ya tiene una operación bancaria registrada.';
   end if;
 end loop;
 if exists(select 1 from public.payments
     where upper(btrim(external_reference))=upper(btrim(p_external_reference))) then
   raise exception 'Referencia bancaria duplicada.';
 end if;
 v_receipt:='IMAUD-'||to_char(clock_timestamp(),'YYYYMMDD')||'-'||
    upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
 -- Guardar cuenta pendiente. El servidor calcula todos los importes.
 foreach v_id in array p_assessment_ids loop
   select * into v_assessment from public.assessments where id=v_id;
   v_udc:=v_assessment.coefficient_snapshot*coalesce(v_assessment.consolidated_unit_count_snapshot,1);
   v_amount:=round(v_udc*v_rate.udc_value,2);
   v_total:=v_total+v_amount;v_total_udc:=v_total_udc+v_udc;
 end loop;
 insert into public.payments(receipt_number,contributor_id,amount,currency_code,
   payment_method,external_reference,status,paid_at,registered_by,
   registration_channel,evidence_path,invoice_issued_at,
   bank_code,payment_udc_rate_id,payment_udc_total)
 values(v_receipt,p_contributor_id,v_total,'VES',p_payment_method,
   btrim(p_external_reference),'pending',p_paid_at,auth.uid(),'taquilla',
   v_evidence,now(),p_bank_code,v_rate.id,v_total_udc)
 returning id into v_payment_id;
 foreach v_id in array p_assessment_ids loop
   select * into v_assessment from public.assessments where id=v_id;
   v_udc:=v_assessment.coefficient_snapshot*coalesce(v_assessment.consolidated_unit_count_snapshot,1);
   v_amount:=round(v_udc*v_rate.udc_value,2);
   -- La modificación se registra en la bitácora automática antes/después.
   update public.assessments set base_amount=v_amount,total_amount=v_amount
     where id=v_id;
   insert into public.payment_allocations(payment_id,assessment_id,amount,udc_amount)
     values(v_payment_id,v_id,v_amount,v_udc);
 end loop;
 insert into public.payment_treasury_events(payment_id,event_type,actor_id,notes)
 values(v_payment_id,'registered',auth.uid(),
 'Pago pendiente. Tasa UCD del '||v_rate.effective_date::text||
 ' consultada en '||v_rate.source_url||'. Banco '||p_bank_code);
 insert into public.audit_log(actor_user_id,action,entity_table,entity_id,after_data)
 values(auth.uid(),'official_payment_udc_registered','payments',v_payment_id::text,
 jsonb_build_object('receipt_number',v_receipt,'rate_id',v_rate.id,
 'effective_date',v_rate.effective_date,'rate',v_rate.udc_value,
 'source',v_rate.source_url,'udc_total',v_total_udc,'total_bs',v_total,
 'bank_code',p_bank_code,'reference',p_external_reference));
 return jsonb_build_object('payment_id',v_payment_id,'receipt_number',v_receipt,
 'status','pending','amount_bs',v_total,'udc_total',v_total_udc,
 'rate',v_rate.udc_value,'rate_date',v_rate.effective_date,
 'source_url',v_rate.source_url);
end; $$;
revoke all on function public.quote_official_udc_payment(uuid,uuid[]) from public,anon;
grant execute on function public.quote_official_udc_payment(uuid,uuid[]) to authenticated;
revoke all on function public.register_official_udc_payment(uuid,uuid[],text,text,text,text,timestamptz) from public,anon;
grant execute on function public.register_official_udc_payment(uuid,uuid[],text,text,text,text,timestamptz) to authenticated;
