-- SITMAUD · generación masiva de obligaciones y programación mensual.
-- En 2026 se utiliza septiembre como comienzo del ensayo; desde 2027 el ciclo arranca en enero.
-- Las liquidaciones existentes jamás se borran ni se reemplazan.
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
revoke all on function private.generate_property_assessments_internal(uuid,date) from public,anon,authenticated;
revoke all on function private.generate_condominium_assessments_internal(uuid,date) from public,anon,authenticated;

create table if not exists private.billing_batch_checkpoint (
 job_key text primary key,
 last_property_id uuid,
 updated_at timestamptz not null default now(),
 scanned_total bigint not null default 0,
 generated_total bigint not null default 0
);
create table if not exists private.billing_generation_issues (
 property_id uuid primary key,
 last_error text not null,
 attempts integer not null default 1,
 last_seen_at timestamptz not null default now()
);
revoke all on private.billing_batch_checkpoint from public,anon,authenticated;
revoke all on private.billing_generation_issues from public,anon,authenticated;

create or replace function private.run_billing_batch(p_batch_size integer default 100, p_allow_trial boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_today date := (now() at time zone 'America/Caracas')::date;
 v_property record; v_last uuid; v_count integer:=0; v_created integer:=0; v_failed integer:=0;
 v_first uuid; v_rows integer; v_target date;
 v_items integer;
begin
 if not p_allow_trial and v_today<date '2027-01-01' then
  return jsonb_build_object('status','before_production','processed',0,'created',0,'failed',0);
 end if;
 if p_batch_size<1 or p_batch_size>200 then raise exception 'Tamaño de lote inválido'; end if;
 if not pg_try_advisory_xact_lock(21906,2027) then
   return jsonb_build_object('status','already_running','processed',0);
 end if;
 v_target:=v_today;
 insert into private.billing_batch_checkpoint(job_key) values('official')
 on conflict(job_key) do nothing;
 select last_property_id into v_last from private.billing_batch_checkpoint where job_key='official' for update;
 for v_property in
  select p.id,p.organization_id,p.is_consolidated_master
  from public.properties p
  where p.is_active=true and p.property_use='residencial'
    and (v_last is null or p.id>v_last)
    and (p.is_consolidated_master=false or
      (p.is_consolidated_master=true and p.organization_id is not null))
  order by p.id limit p_batch_size
 loop
  v_count:=v_count+1;v_last:=v_property.id;
  begin
   if v_property.is_consolidated_master then
    select count(*) filter(where result='created') into v_items
    from private.generate_condominium_assessments_internal(v_property.organization_id,v_target);
   else
    select count(*) filter(where result='created') into v_items
    from private.generate_property_assessments_internal(v_property.id,v_target);
   end if;
   v_created:=v_created+coalesce(v_items,0);
   delete from private.billing_generation_issues where property_id=v_property.id;
  exception when others then
   v_failed:=v_failed+1;
   insert into private.billing_generation_issues(property_id,last_error)
   values(v_property.id,left(sqlerrm,500))
   on conflict(property_id) do update set
     last_error=excluded.last_error, attempts=private.billing_generation_issues.attempts+1,last_seen_at=now();
  end;
 end loop;
 if v_count<p_batch_size then
  v_last:=null;
 end if;
 update private.billing_batch_checkpoint set last_property_id=v_last,updated_at=now(),
  scanned_total=scanned_total+v_count,generated_total=generated_total+v_created
  where job_key='official';
 return jsonb_build_object('status',case when v_last is null then 'cycle_complete' else 'more' end,
  'processed',v_count,'created',v_created,'failed',v_failed,
  'remaining_in_cycle',v_last is not null);
end $$;
revoke all on function private.run_billing_batch(integer,boolean) from public,anon,authenticated;

-- El superusuario usa lotes de hasta 200: 50.000 inmuebles se procesan sin peticiones gigantes.
create or replace function public.run_trial_billing_batch(p_batch_size integer default 100)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.has_permission('assessments.create') then
  raise exception 'No autorizado a generar obligaciones' using errcode='42501';
 end if;
 if (now() at time zone 'America/Caracas')::date >= date '2027-01-01' then
  raise exception 'La generación manual de pruebas no está disponible después de diciembre 2026';
 end if;
 return private.run_billing_batch(p_batch_size,true);
end $$;
revoke all on function public.run_trial_billing_batch(integer) from public,anon;
grant execute on function public.run_trial_billing_batch(integer) to authenticated;

-- Programador en horario de Caracas: lote pequeño cada minuto; se reanuda desde cursor.
-- A partir de enero, cron genera mensualidades sin intervención del funcionario.
select cron.schedule('sitmaud-monthly-billing-batches','* 4-13 * * *',
  $$select private.run_billing_batch(100,false)$$);
