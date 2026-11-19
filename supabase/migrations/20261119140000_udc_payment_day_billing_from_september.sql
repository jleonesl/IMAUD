-- SITMAUD: monthly UCD; BCV rate on payment day.
-- Only approved tariffs; retain bank, auth, audit guards.
-- generate_official_property_assessments
CREATE OR REPLACE FUNCTION public.generate_official_property_assessments(p_property_id uuid, p_through_date date DEFAULT CURRENT_DATE)
 RETURNS TABLE(assessment_id uuid, period_start date, amount numeric, result text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare
  v_property public.properties%rowtype;
  v_sector_typology text;
  v_typology text;
  v_schedule public.tariff_schedules%rowtype;
  v_rule public.tariff_rules%rowtype;
  v_calc record;
  v_month date;
  v_amount numeric(14,4);
  v_id uuid;
  v_count integer := 0;
begin
  if auth.uid() is null or not public.has_permission('assessments.create') then
    raise exception 'No tienes permiso institucional para generar liquidaciones.';
  end if;
  select * into v_property from public.properties where id=p_property_id and is_active=true for update;
  if not found then raise exception 'No se encontró un inmueble activo para liquidar.'; end if;
  if v_property.property_use <> 'residencial' then
    raise exception 'La liquidación comercial, industrial e institucional requiere el Anexo B y un tabulador aprobado específico.';
  end if;
  if coalesce(v_property.is_consolidated_master,false) then
    raise exception 'La liquidación consolidada de condominios requiere validar la regla institucional de cuenta matriz antes de generar cargos.';
  end if;
  select default_typology into v_sector_typology from public.sectors where id=v_property.sector_id and is_active=true;
  v_typology:=coalesce(nullif(trim(v_property.typology_override),''),v_sector_typology);
  if v_typology is null or upper(v_typology) not in ('I','II','III','TIPO I','TIPO II','TIPO III') then
    raise exception 'El inmueble no tiene una tipología residencial válida. Asigne Tipo I, II o III antes de liquidar.';
  end if;
  if p_through_date<date '2026-09-01' then return; end if;
  if p_through_date> (now() at time zone 'America/Caracas')::date then
    raise exception 'No se pueden generar obligaciones de meses futuros';
  end if;
  v_month:=date '2026-09-01';
  while v_month<=date_trunc('month',least(p_through_date,(now() at time zone 'America/Caracas')::date))::date loop
    if exists(select 1 from public.assessments a where a.property_id=p_property_id
      and a.period_start=v_month and a.period_end=(v_month+interval '1 month - 1 day')::date
      and a.is_demo=true) then
      raise exception 'Existe un registro histórico de prueba en ese período; requiere conciliación antes de generar obligación oficial';
    end if;
    if not exists(select 1 from public.assessments a where a.property_id=p_property_id
      and a.period_start=v_month and a.period_end=(v_month+interval '1 month - 1 day')::date and a.is_demo=false) then

     select * into v_schedule from public.tariff_schedules
       where is_approved=true
         and valid_from <= (v_month + interval '1 month - 1 day')::date
         and (valid_until is null or valid_until >= v_month)
       order by valid_from desc limit 1;
     if not found then raise exception 'No hay tabulador aprobado para %',to_char(v_month,'MM/YYYY'); end if;
     select * into v_rule from public.tariff_rules
       where schedule_id=v_schedule.id
         and (sector_id=v_property.sector_id or sector_id is null)
         and upper(trim(typology_code))=case when upper(v_typology) like '%III%' then 'TIPO III' when upper(v_typology) like '%II%' then 'TIPO II' else 'TIPO I' end
         and unit_basis='per_property' and parish_id is null
       order by (sector_id is not null) desc limit 1;
     if not found then raise exception 'No hay regla tarifaria para %',v_typology; end if;
      select * into v_calc from public.calculate_udc_tariff(v_typology,(now() at time zone 'America/Caracas')::date);
      if v_calc.udc_effective_date < ((now() at time zone 'America/Caracas')::date - 3) then
        raise exception 'No existe una tasa BCV/UCD suficientemente reciente para el período %. No se generó ninguna obligación.',to_char(v_month,'MM/YYYY');
      end if;
      if abs(v_rule.amount-v_calc.coefficient)>0.0001 then
        raise exception 'El coeficiente aprobado no coincide con el Anexo A para la tipología %. No se generó ninguna obligación.',v_typology;
      end if;
      v_amount:=v_calc.monthly_amount;
      insert into public.assessments(property_id,tariff_rule_id,period_start,period_end,base_amount,
        adjustment_amount,total_amount,status,is_demo,udc_rate_id,udc_currency_code,udc_value_snapshot,coefficient_snapshot)
      values(p_property_id,v_rule.id,v_month,(v_month+interval '1 month - 1 day')::date,
        v_amount,0,v_amount,'pending',false,
        (select id from public.udc_rates where effective_date=v_calc.udc_effective_date limit 1),
        v_calc.udc_currency_code,v_calc.udc_value,v_calc.coefficient)
      on conflict(property_id,period_start,period_end) do nothing returning id into v_id;
      if v_id is not null then
        v_count:=v_count+1; assessment_id:=v_id; period_start:=v_month; amount:=v_amount; result:='created'; return next;
      end if;
    end if;
    v_month:=(v_month+interval '1 month')::date;
  end loop;
  if v_count=0 then assessment_id:=null; period_start:=null; amount:=0; result:='already_up_to_date'; return next; end if;
end;
$function$
;

-- generate_official_condominium_assessments
CREATE OR REPLACE FUNCTION public.generate_official_condominium_assessments(p_organization_id uuid, p_through_date date DEFAULT CURRENT_DATE)
 RETURNS TABLE(assessment_id uuid, period_start date, amount numeric, result text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare
 v_org public.residential_organizations%rowtype;
 v_property public.properties%rowtype;
 v_schedule public.tariff_schedules%rowtype;
 v_rule public.tariff_rules%rowtype;
 v_rate record;
 v_typology text;
 v_sector_typology text;
 v_count integer;
 v_month date;
 v_amount numeric(14,4);
 v_new_id uuid;
 v_count_new integer:=0;
 v_today date:=(now() at time zone 'America/Caracas')::date;
begin
 if auth.uid() is null or not public.has_permission('assessments.create') then
   raise exception 'No tienes permiso institucional para generar obligaciones.' using errcode='42501';
 end if;
 if p_through_date>v_today then
   raise exception 'No se pueden generar obligaciones futuras';
 end if;
 if p_through_date<date '2026-09-01' then
   return;
 end if;
 select * into v_org from public.residential_organizations
 where id=p_organization_id and organization_type='condominio'
 for update;
 if not found or v_org.consolidated_billing is distinct from true then
   raise exception 'No existe un condominio habilitado para facturación consolidada.';
 end if;
 select * into v_property from public.properties
 where organization_id=p_organization_id and is_consolidated_master=true and is_active=true
 for update;
 if not found then raise exception 'El condominio no tiene una cuenta matriz activa.'; end if;
 if (select count(*) from public.properties
      where organization_id=p_organization_id and is_consolidated_master=true and is_active=true)<>1 then
   raise exception 'Se requiere exactamente una cuenta matriz activa por condominio.';
 end if;
 if v_property.property_use<>'residencial' then
   raise exception 'La cuenta matriz no está clasificada como residencial.';
 end if;
 v_count:=v_org.unit_count;
 if v_count is null or v_count<1 or v_count>100000 or
    v_property.consolidated_units is distinct from v_count then
   raise exception 'La cantidad de viviendas en el condominio y su cuenta matriz debe coincidir.';
 end if;
 select default_typology into v_sector_typology
 from public.sectors where id=v_property.sector_id and is_active=true;
 v_typology:=v_org.billing_typology;
 if v_sector_typology is null or v_typology not in ('TIPO I','TIPO II','TIPO III') then
   raise exception 'El condominio requiere tipología asignada y sector activo.';
 end if;
 if v_typology is distinct from v_sector_typology and
   (v_org.billing_typology_assigned_by is null
    or length(trim(coalesce(v_org.billing_typology_reason,'')))<15) then
    raise exception 'La clasificación especial del condominio requiere justificación documentada.';
 end if;
 v_month:=date '2026-09-01';
 while v_month<=date_trunc('month',p_through_date)::date loop
   if exists(select 1 from public.assessments a
     where a.property_id=v_property.id and a.period_start=v_month
       and a.period_end=(v_month+interval '1 month - 1 day')::date and a.is_demo=true) then
     raise exception 'Existe un cargo DEMO en %; requiere conciliación previa.',to_char(v_month,'MM/YYYY');
   end if;
   if not exists(select 1 from public.assessments a where a.property_id=v_property.id
      and a.period_start=v_month and a.period_end=(v_month+interval '1 month - 1 day')::date) then
     select * into v_schedule from public.tariff_schedules
     where is_approved=true and valid_from<=(v_month+interval '1 month - 1 day')::date
       and (valid_until is null or valid_until>=v_month)
     order by valid_from desc limit 1;
     if not found then raise exception 'No hay tabulador aprobado para %',to_char(v_month,'MM/YYYY'); end if;
     select * into v_rule from public.tariff_rules
     where schedule_id=v_schedule.id and unit_basis='per_property' and parish_id is null
       and (sector_id=v_property.sector_id or sector_id is null)
       and upper(trim(typology_code))=v_typology
     order by (sector_id is not null) desc limit 1;
     if not found then raise exception 'No hay regla tarifaria para %',v_typology; end if;
     select * into v_rate from public.calculate_udc_tariff(v_typology,v_today);
     if abs(v_rule.amount-v_rate.coefficient)>0.0001 then
       raise exception 'Coeficiente no coincide con tabulador aprobado';
     end if;
     v_amount:=round((v_rule.amount*v_count*v_rate.udc_value)::numeric,2);
     v_new_id:=null;
     insert into public.assessments(
       property_id,tariff_rule_id,period_start,period_end,base_amount,
       adjustment_amount,total_amount,status,is_demo,created_by,
       udc_rate_id,udc_currency_code,udc_value_snapshot,coefficient_snapshot,
       consolidated_unit_count_snapshot
     ) values(
       v_property.id,v_rule.id,v_month,(v_month+interval '1 month - 1 day')::date,
       v_amount,0,v_amount,'pending',false,auth.uid(),
       (select id from public.udc_rates where effective_date=v_rate.udc_effective_date limit 1),
       v_rate.udc_currency_code,v_rate.udc_value,v_rate.coefficient,v_count
     ) on conflict(property_id,period_start,period_end) do nothing returning id into v_new_id;
     if v_new_id is not null then
       insert into public.audit_log(actor_user_id,action,entity_table,entity_id,after_data)
       values(auth.uid(),'condominium_assessment_created','assessments',v_new_id::text,
       jsonb_build_object('organization_id',p_organization_id,'property_id',v_property.id,
         'period_start',v_month,'units',v_count,'typology',v_typology,
         'coefficient',v_rate.coefficient,'rate',v_rate.udc_value,
         'rate_date',v_rate.udc_effective_date,'rate_source',v_rate.source_url,'total_bs',v_amount));
       v_count_new:=v_count_new+1;
       assessment_id:=v_new_id; period_start:=v_month; amount:=v_amount; result:='created';
       return next;
     end if;
   end if;
   v_month:=(v_month+interval '1 month')::date;
 end loop;
 if v_count_new=0 then
   assessment_id:=null; period_start:=null; amount:=0; result:='already_up_to_date';return next;
 end if;
end; $function$
;

-- quote_official_udc_payment
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

-- quote_citizen_udc_payment
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

-- register_official_udc_payment_core
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

-- register_citizen_udc_payment_core
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