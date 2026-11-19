-- Explicit conflict constraint avoids PL/pgSQL RETURNS TABLE(period_start) ambiguity.
CREATE OR REPLACE FUNCTION private.generate_condominium_assessments_internal(p_organization_id uuid, p_through_date date DEFAULT CURRENT_DATE)
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
 -- Uso interno: ejecutable únicamente por el programador de la base de datos.
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
 v_month:=(case when (now() at time zone 'America/Caracas')::date >= date '2027-01-01' then date '2027-01-01' else date '2026-09-01' end);
 while v_month<=date_trunc('month',p_through_date)::date loop
   if exists(select 1 from public.assessments a
     where a.property_id=v_property.id and a.period_start=v_month
       and a.period_end=(v_month+interval '1 month - 1 day')::date and a.is_demo=true) then
     -- El cargo DEMO se conserva para conciliación; no bloquear los demás meses.
     v_month:=(v_month+interval '1 month')::date;
     continue;
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
     ) on conflict on constraint assessments_property_id_period_start_period_end_key do nothing returning id into v_new_id;
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
 v_month:=(case when (now() at time zone 'America/Caracas')::date >= date '2027-01-01' then date '2027-01-01' else date '2026-09-01' end);
 while v_month<=date_trunc('month',p_through_date)::date loop
   if exists(select 1 from public.assessments a
     where a.property_id=v_property.id and a.period_start=v_month
       and a.period_end=(v_month+interval '1 month - 1 day')::date and a.is_demo=true) then
     -- El cargo DEMO se conserva para conciliación; no bloquear los demás meses.
     v_month:=(v_month+interval '1 month')::date;
     continue;
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
     ) on conflict on constraint assessments_property_id_period_start_period_end_key do nothing returning id into v_new_id;
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
  v_month:=(case when (now() at time zone 'America/Caracas')::date >= date '2027-01-01' then date '2027-01-01' else date '2026-09-01' end);
  while v_month<=date_trunc('month',least(p_through_date,(now() at time zone 'America/Caracas')::date))::date loop
    if exists(select 1 from public.assessments a where a.property_id=p_property_id
      and a.period_start=v_month and a.period_end=(v_month+interval '1 month - 1 day')::date
      and a.is_demo=true) then
      -- Se conserva el mes DEMO como incidencia; procesar los siguientes meses.
      v_month:=(v_month+interval '1 month')::date;
      continue;
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
      on conflict on constraint assessments_property_id_period_start_period_end_key do nothing returning id into v_id;
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

CREATE OR REPLACE FUNCTION private.generate_property_assessments_internal(p_property_id uuid, p_through_date date DEFAULT CURRENT_DATE)
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
  -- Uso interno: ejecutable únicamente por el programador de la base de datos.
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
  v_month:=(case when (now() at time zone 'America/Caracas')::date >= date '2027-01-01' then date '2027-01-01' else date '2026-09-01' end);
  while v_month<=date_trunc('month',least(p_through_date,(now() at time zone 'America/Caracas')::date))::date loop
    if exists(select 1 from public.assessments a where a.property_id=p_property_id
      and a.period_start=v_month and a.period_end=(v_month+interval '1 month - 1 day')::date
      and a.is_demo=true) then
      -- Se conserva el mes DEMO como incidencia; procesar los siguientes meses.
      v_month:=(v_month+interval '1 month')::date;
      continue;
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
      on conflict on constraint assessments_property_id_period_start_period_end_key do nothing returning id into v_id;
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