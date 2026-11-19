-- SITMAUD: prevent billing of exonerated months and hide them from pending balances. Trial relief requires trial tariff authorization.
CREATE OR REPLACE FUNCTION public.quote_official_udc_payment(p_contributor_id uuid, p_assessment_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
   and source_url = 'https://www.bcv.org.ve/'
   order by effective_date desc limit 1;
 if not found or v_rate.effective_date < v_today-3 then
   raise exception 'No hay tasa UCD válida para el pago de hoy.';
 end if;
 foreach v_id in array p_assessment_ids loop
   select * into v_a from public.assessments where id=v_id and is_demo=false;
   if not found or v_a.status<>'pending' or v_a.period_start<date '2026-09-01' then
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
   if exists(select 1 from public.debt_relief_grants g
     where g.assessment_id=v_id and g.revoked_at is null) then
     raise exception 'El mes seleccionado está exonerado; no puede cobrarse.'; 
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
end; $function$
;

CREATE OR REPLACE FUNCTION public.quote_citizen_udc_payment(p_contributor_id uuid, p_assessment_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_rate public.udc_rates%rowtype;
 v_today date := (now() at time zone 'America/Caracas')::date;
 v_id uuid;v_a public.assessments%rowtype;v_udc numeric(18,4);
 v_bs numeric(18,2);v_total numeric(18,2):=0;v_total_udc numeric(18,4):=0;
 v_items jsonb:='[]'::jsonb;
begin
 if auth.uid() is null or not (exists(select 1 from public.citizen_accounts ca join public.contributors c on c.id=ca.contributor_id join auth.users au on au.id=ca.auth_user_id where ca.auth_user_id=auth.uid() and ca.is_active and ca.contributor_id=p_contributor_id and c.status='active' and au.email_confirmed_at is not null and lower(au.email)=lower(c.email) and not exists(select 1 from public.staff_profiles sp where sp.user_id=auth.uid() and sp.is_active))) then
   raise exception 'Sin permiso para consultar liquidaciones' using errcode='42501';
 end if;
 if p_contributor_id is null or p_assessment_ids is null
   or cardinality(p_assessment_ids) not between 1 and 100
   or cardinality(p_assessment_ids)<>(select count(distinct x) from unnest(p_assessment_ids) x) then
   raise exception 'Debes seleccionar obligaciones distintas (máximo 100)';
 end if;
 select * into v_rate from public.udc_rates where effective_date<=v_today
   and source_url = 'https://www.bcv.org.ve/'
   order by effective_date desc limit 1;
 if not found or v_rate.effective_date < v_today-3 then
   raise exception 'No hay tasa UCD válida para el pago de hoy.';
 end if;
 foreach v_id in array p_assessment_ids loop
   select * into v_a from public.assessments where id=v_id and is_demo=false;
   if not found or v_a.status<>'pending' or v_a.period_start<date '2026-09-01' then
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
   if exists(select 1 from public.debt_relief_grants g
     where g.assessment_id=v_id and g.revoked_at is null) then
     raise exception 'El mes seleccionado está exonerado; no puede cobrarse.'; 
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
end; $function$
;

CREATE OR REPLACE FUNCTION public.register_official_udc_payment_core(p_contributor_id uuid, p_assessment_ids uuid[], p_payment_method text, p_external_reference text, p_bank_code text, p_evidence_path text, p_paid_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 -- Los pagos por punto de venta se acreditan con la referencia del terminal.
 -- Transferencias y pago móvil siguen exigiendo evidencia privada verificable.
 if p_payment_method in ('transferencia','pago_movil') or v_evidence<>'' then
   if length(v_evidence)<8 or split_part(v_evidence,'/',1)<>p_contributor_id::text then
     raise exception 'Comprobante inválido: debe pertenecer al expediente del contribuyente';
   end if;
   if not exists(select 1 from storage.objects o
     where o.bucket_id='imaud-payment-proofs' and o.name=v_evidence
       and o.owner_id=auth.uid()::text) then
     raise exception 'El comprobante no está cargado en el repositorio privado del funcionario';
   end if;
 end if;
 if p_assessment_ids is null or cardinality(p_assessment_ids) not between 1 and 100
    or cardinality(p_assessment_ids)<>(select count(distinct x) from unnest(p_assessment_ids) x) then
   raise exception 'Selecciona obligaciones únicas (máximo 100)';
 end if;
 select * into v_rate from public.udc_rates where effective_date<=v_today
 and source_url = 'https://www.bcv.org.ve/'
 order by effective_date desc limit 1;
 if not found or v_rate.effective_date<v_today-3 then
   raise exception 'La tasa BCV/UCD no está vigente para el pago de hoy.';
 end if;
 -- El bloqueo del conjunto de obligaciones garantiza consistencia al registrar.
 for v_id in select unnest(p_assessment_ids) order by 1 loop
   select * into v_assessment from public.assessments
    where id=v_id and is_demo=false for update;
   if not found or v_assessment.status<>'pending'
     or v_assessment.period_start<date '2026-09-01' then
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
   if exists(select 1 from public.debt_relief_grants g
     where g.assessment_id=v_id and g.revoked_at is null) then
     raise exception 'El mes seleccionado está exonerado; no puede cobrarse.'; 
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
   nullif(v_evidence,''),now(),p_bank_code,v_rate.id,v_total_udc)
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
end; $function$
;

CREATE OR REPLACE FUNCTION public.register_citizen_udc_payment_core(p_contributor_id uuid, p_assessment_ids uuid[], p_payment_method text, p_external_reference text, p_bank_code text, p_evidence_path text, p_paid_at timestamp with time zone, p_municipal_account_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_rate public.udc_rates%rowtype;v_today date:=(now() at time zone 'America/Caracas')::date;
 v_id uuid;v_assessment public.assessments%rowtype;
 v_udc numeric(18,4);v_amount numeric(18,2);
 v_total numeric(18,2):=0;v_total_udc numeric(18,4):=0;
 v_payment_id uuid;v_receipt text;v_evidence text:=btrim(coalesce(p_evidence_path,''));
begin
 if auth.uid() is null or not (exists(select 1 from public.citizen_accounts ca join public.contributors c on c.id=ca.contributor_id join auth.users au on au.id=ca.auth_user_id where ca.auth_user_id=auth.uid() and ca.is_active and ca.contributor_id=p_contributor_id and c.status='active' and au.email_confirmed_at is not null and lower(au.email)=lower(c.email) and not exists(select 1 from public.staff_profiles sp where sp.user_id=auth.uid() and sp.is_active))) then
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
 if not exists(select 1 from public.municipal_payment_accounts m where m.id=p_municipal_account_id and m.is_published and m.method=p_payment_method) then raise exception 'Cuenta bancaria oficial receptora no publicada para el método de pago';end if;
 if not exists(select 1 from public.payment_banks b where b.code=p_bank_code and b.is_active=true) then
   raise exception 'Selecciona un banco del catálogo oficial';
 end if;
 if length(v_evidence)<8 or split_part(v_evidence,'/',1)<>p_contributor_id::text then
   raise exception 'Comprobante inválido: debe pertenecer al expediente del contribuyente';
 end if;
 if not exists(select 1 from storage.objects o
   where o.bucket_id='imaud-payment-proofs' and o.name=v_evidence
     and o.owner_id=auth.uid()::text) then
   raise exception 'El comprobante no está cargado en tu repositorio privado';
 end if;
 if p_assessment_ids is null or cardinality(p_assessment_ids) not between 1 and 100
    or cardinality(p_assessment_ids)<>(select count(distinct x) from unnest(p_assessment_ids) x) then
   raise exception 'Selecciona obligaciones únicas (máximo 100)';
 end if;
 select * into v_rate from public.udc_rates where effective_date<=v_today
 and source_url = 'https://www.bcv.org.ve/'
 order by effective_date desc limit 1;
 if not found or v_rate.effective_date<v_today-3 then
   raise exception 'La tasa BCV/UCD no está vigente para el pago de hoy.';
 end if;
 -- El bloqueo del conjunto de obligaciones garantiza consistencia al registrar.
 for v_id in select unnest(p_assessment_ids) order by 1 loop
   select * into v_assessment from public.assessments
    where id=v_id and is_demo=false for update;
   if not found or v_assessment.status<>'pending'
     or v_assessment.period_start<date '2026-09-01' then
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
   if exists(select 1 from public.debt_relief_grants g
     where g.assessment_id=v_id and g.revoked_at is null) then
     raise exception 'El mes seleccionado está exonerado; no puede cobrarse.'; 
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
   bank_code,payment_udc_rate_id,payment_udc_total,receiving_account_id)
 values(v_receipt,p_contributor_id,v_total,'VES',p_payment_method,
   btrim(p_external_reference),'pending',p_paid_at,auth.uid(),'portal_contribuyente',
   v_evidence,null,p_bank_code,v_rate.id,v_total_udc,p_municipal_account_id)
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
 values(auth.uid(),'citizen_payment_udc_submitted','payments',v_payment_id::text,
 jsonb_build_object('receipt_number',v_receipt,'rate_id',v_rate.id,
 'effective_date',v_rate.effective_date,'rate',v_rate.udc_value,
 'source',v_rate.source_url,'udc_total',v_total_udc,'total_bs',v_total,
 'bank_code',p_bank_code,'receiving_account_id',p_municipal_account_id,'reference',p_external_reference));
 return jsonb_build_object('payment_id',v_payment_id,'receipt_number',v_receipt,
 'status','pending','amount_bs',v_total,'udc_total',v_total_udc,
 'rate',v_rate.udc_value,'rate_date',v_rate.effective_date,
 'source_url',v_rate.source_url);
end; $function$
;

CREATE OR REPLACE FUNCTION public.exonerate_official_assessments(p_assessment_ids uuid[], p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_actor uuid:=auth.uid();
 v_reason text:=nullif(btrim(p_reason),'');
 v_id uuid;v_a public.assessments%rowtype;v_contributor uuid;v_this uuid;
 v_grant uuid;v_confirmed numeric(18,2);v_remainder numeric(18,2);
 v_applied int:=0;
begin
 if v_actor is null or not public.has_permission('debt_relief.apply') then
   raise exception 'No tienes permiso de exoneración' using errcode='42501';
 end if;
 if v_reason is null or length(v_reason)<12 or length(v_reason)>500 then
   raise exception 'Indica el fundamento de la exoneración (12 a 500 caracteres).';
 end if;
 if p_assessment_ids is null or cardinality(p_assessment_ids) not between 1 and 100
    or cardinality(p_assessment_ids)<>(select count(distinct a) from unnest(p_assessment_ids) a) then
   raise exception 'Selecciona de 1 a 100 meses distintos.';
 end if;
 -- Bloqueos ordenados garantizan que la operación sea atómica.
 for v_id in select unnest(p_assessment_ids) order by 1 loop
   select * into v_a from public.assessments where id=v_id and is_demo=false for update;
   if not found or v_a.status not in ('pending','partially_paid')
      or v_a.period_start<date '2026-09-01'
      or (v_a.period_start<date '2027-01-01' and not exists (
        select 1 from public.tariff_schedules ts where ts.is_approved=true
          and ts.valid_from<date '2027-01-01'
          and ts.valid_from<=v_a.period_end
          and (ts.valid_until is null or ts.valid_until>=v_a.period_start)
      )) then
     raise exception 'No es posible exonerar el período %: inexistente o no pendiente.',v_id;
   end if;
   select p.contributor_id into v_this from public.properties p
   where p.id=v_a.property_id and p.is_active=true;
   if v_this is null then raise exception 'Inmueble inactivo o sin contribuyente.';end if;
   if v_contributor is null then v_contributor:=v_this;
   elsif v_contributor<>v_this then raise exception 'Selecciona meses de un mismo contribuyente.';end if;
   if exists(select 1 from public.debt_relief_grants g where g.assessment_id=v_id) then
      raise exception 'La obligación % tiene un antecedente de exoneración; requiere revisión.',v_id;
   end if;
   if exists(select 1 from public.payment_allocations pa
      join public.payments py on py.id=pa.payment_id
      where pa.assessment_id=v_id and py.status='pending') then
      raise exception 'El mes % tiene un pago pendiente de Tesorería.',v_id;
   end if;
   select coalesce(sum(pa.amount),0) into v_confirmed
    from public.payment_allocations pa join public.payments py on py.id=pa.payment_id
    where pa.assessment_id=v_id and py.status='confirmed';
   v_remainder:=greatest(0,v_a.total_amount-v_confirmed);
   if v_remainder<=0 then raise exception 'El período % ya está totalmente pagado.',v_id;end if;
   insert into public.debt_relief_grants(assessment_id,legal_reference,approved_by)
   values(v_id,v_reason,v_actor) returning id into v_grant;
   insert into public.audit_log(actor_user_id,action,entity_table,entity_id,after_data)
   values(v_actor,'debt_exonerated_direct','debt_relief_grants',v_grant::text,
     jsonb_build_object('assessment_id',v_id,'contributor_id',v_contributor,
       'period_start',v_a.period_start,'period_end',v_a.period_end,
       'outstanding_exonerated_bs',v_remainder,'confirmed_before_exoneration_bs',v_confirmed,
       'reason',v_reason,'approved_by',v_actor,'revenue_added',0));
   v_applied:=v_applied+1;
 end loop;
 return jsonb_build_object('applied',v_applied,'status','exonerated',
   'contributor_id',v_contributor,'revenue_added',0);
end; $function$
;

CREATE OR REPLACE FUNCTION public.list_official_debtors(p_search text DEFAULT ''::text, p_kind text DEFAULT ''::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_items jsonb;v_count bigint;
begin
 if auth.uid() is null or not (public.has_permission('payments.read') or public.has_permission('assessments.read')) then
  raise exception 'Sin permiso para consultar deudas' using errcode='42501';
 end if;
 if p_limit not between 1 and 100 or p_offset<0 or p_offset>100000 or length(coalesce(p_search,''))>100
    or coalesce(p_kind,'') not in ('','individual','condominio') then
  raise exception 'Filtros de deudores no válidos';
 end if;
 with eligible as (
   select c.id contributor_id,
    coalesce(c.contract_number,'') contract,
    case when c.kind='juridico' then coalesce(c.legal_name,'Persona jurídica')
         else coalesce(nullif(concat_ws(' ',c.first_name,c.last_name),''),c.legal_name,'Contribuyente') end as full_name,
    case when c.identification_number ilike coalesce(nullif(c.identification_type,''),'~')||'-%'
        then c.identification_number else concat_ws('-',nullif(c.identification_type,''),nullif(c.identification_number,'')) end identification,
    coalesce(p.address,'') address,
    coalesce(p.is_consolidated_master,false) master,
    c.service_account_type,
    a.period_start,
    greatest(a.total_amount-coalesce(alloc.confirmed,0),0) due
   from public.assessments a
   join public.properties p on p.id=a.property_id and p.is_active=true
   join public.contributors c on c.id=p.contributor_id
   left join lateral (
      select sum(pa.amount) confirmed from public.payment_allocations pa
      join public.payments py on py.id=pa.payment_id and py.status='confirmed'
      where pa.assessment_id=a.id
   ) alloc on true
   where a.is_demo=false and a.status in ('pending','partially_paid')
     and not exists(select 1 from public.debt_relief_grants g where g.assessment_id=a.id and g.revoked_at is null)
     and a.total_amount>coalesce(alloc.confirmed,0)
 ),
 grouped as (
   select contributor_id,max(contract) contract,max(full_name) name,max(identification) id_number,
    string_agg(distinct address,' · ') address,
    bool_or(master or service_account_type='condominio') condominium,
    count(distinct period_start) months,sum(due) debt
   from eligible group by contributor_id
 ),
 filtered as (
   select * from grouped
   where (coalesce(p_kind,'')='' or
          (p_kind='condominio' and condominium=true) or
          (p_kind='individual' and condominium=false))
     and (btrim(coalesce(p_search,''))='' or
          contract ilike '%'||btrim(p_search)||'%' or
          translate(lower(name),'áéíóúüñ','aeiouun') like '%'||translate(lower(btrim(p_search)),'áéíóúüñ','aeiouun')||'%' or
          id_number ilike '%'||btrim(p_search)||'%' or
          address ilike '%'||btrim(p_search)||'%')
 )
 select count(*) from filtered into v_count;
 with eligible as (
   select c.id contributor_id,
    coalesce(c.contract_number,'') contract,
    case when c.kind='juridico' then coalesce(c.legal_name,'Persona jurídica')
         else coalesce(nullif(concat_ws(' ',c.first_name,c.last_name),''),c.legal_name,'Contribuyente') end as full_name,
    case when c.identification_number ilike coalesce(nullif(c.identification_type,''),'~')||'-%'
        then c.identification_number else concat_ws('-',nullif(c.identification_type,''),nullif(c.identification_number,'')) end identification,
    coalesce(p.address,'') address,
    coalesce(p.is_consolidated_master,false) master,
    c.service_account_type,a.period_start,
    greatest(a.total_amount-coalesce(alloc.confirmed,0),0) due
   from public.assessments a
   join public.properties p on p.id=a.property_id and p.is_active=true
   join public.contributors c on c.id=p.contributor_id
   left join lateral (select sum(pa.amount) confirmed from public.payment_allocations pa
    join public.payments py on py.id=pa.payment_id and py.status='confirmed'
    where pa.assessment_id=a.id) alloc on true
   where a.is_demo=false and a.status in ('pending','partially_paid')
     and not exists(select 1 from public.debt_relief_grants g where g.assessment_id=a.id and g.revoked_at is null)
     and a.total_amount>coalesce(alloc.confirmed,0)
 ),
 grouped as (
   select contributor_id,max(contract) contract,max(full_name) name,max(identification) id_number,
    string_agg(distinct address,' · ') address,
    bool_or(master or service_account_type='condominio') condominium,
    count(distinct period_start) months,sum(due) debt
   from eligible group by contributor_id
 ),
 filtered as (
   select * from grouped where
    (coalesce(p_kind,'')='' or (p_kind='condominio' and condominium=true) or (p_kind='individual' and condominium=false))
    and (btrim(coalesce(p_search,''))='' or contract ilike '%'||btrim(p_search)||'%'
     or translate(lower(name),'áéíóúüñ','aeiouun') like '%'||translate(lower(btrim(p_search)),'áéíóúüñ','aeiouun')||'%' or id_number ilike '%'||btrim(p_search)||'%'
     or address ilike '%'||btrim(p_search)||'%')
 )
 select coalesce(jsonb_agg(jsonb_build_object('contract',contract,'name',name,'idNumber',id_number,
   'address',address,'condominium',condominium,'months',months,'debt',debt) order by name,contract),'[]'::jsonb)
 into v_items from (select * from filtered order by name,contract limit p_limit offset p_offset) page;
 return jsonb_build_object('items',v_items,'total',v_count,'limit',p_limit,'offset',p_offset);
end $function$
;

CREATE OR REPLACE FUNCTION public.get_my_citizen_portal()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    'period_end',a.period_end,'amount_bs',a.total_amount,'status',case when exists(select 1 from public.debt_relief_grants g where g.assessment_id=a.id and g.revoked_at is null) then 'exonerated' else a.status end,
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
end; $function$
;