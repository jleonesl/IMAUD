-- SITMAUD: facturación mensual consolidada de condominios, enero 2027 en adelante.
-- No crea cargos por adelantado, ni toca registros DEMO.
create or replace function public.prevent_duplicate_consolidated_charge()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if new.is_demo=false and exists (
    select 1 from public.properties p
    join public.residential_organizations o on o.id=p.organization_id
    where p.id=new.property_id and o.consolidated_billing=true
      and p.is_consolidated_master=false
  ) then
    raise exception 'Este inmueble pertenece a una cuenta matriz consolidada. El cobro se realiza únicamente al condominio.';
  end if;
  if new.is_demo=false and exists (
    select 1 from public.organization_units u
    join public.residential_organizations o on o.id=u.organization_id
    where u.property_id=new.property_id and o.consolidated_billing=true
  ) then
    raise exception 'La vivienda está vinculada a un condominio con facturación consolidada; no se permite una obligación individual.';
  end if;
  return new;
end; $$;
drop trigger if exists protect_consolidated_assessments on public.assessments;
create trigger protect_consolidated_assessments
before insert or update of property_id,is_demo on public.assessments
for each row execute function public.prevent_duplicate_consolidated_charge();

create or replace function public.generate_official_condominium_assessments(
  p_organization_id uuid, p_through_date date default current_date
)
returns table(assessment_id uuid, period_start date, amount numeric, result text)
language plpgsql security definer set search_path=public,private as $$
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
 if p_through_date<date '2027-01-01' then
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
 v_month:=date '2027-01-01';
 while v_month<=date_trunc('month',p_through_date)::date loop
   if exists(select 1 from public.assessments a
     where a.property_id=v_property.id and a.period_start=v_month
       and a.period_end=(v_month+interval '1 month - 1 day')::date and a.is_demo=true) then
     raise exception 'Existe un cargo DEMO en %; requiere conciliación previa.',to_char(v_month,'MM/YYYY');
   end if;
   if not exists(select 1 from public.assessments a where a.property_id=v_property.id
      and a.period_start=v_month and a.period_end=(v_month+interval '1 month - 1 day')::date) then
     select * into v_schedule from public.tariff_schedules
     where is_approved=true and valid_from<=v_month
       and (valid_until is null or valid_until>=v_month)
       and title='Tarifa residencial oficial · Ordenanza 2024 · inicio enero 2027'
     order by valid_from desc limit 1;
     if not found then raise exception 'No hay tabulador aprobado para %',to_char(v_month,'MM/YYYY'); end if;
     select * into v_rule from public.tariff_rules
     where schedule_id=v_schedule.id and unit_basis='per_property' and parish_id is null
       and (sector_id=v_property.sector_id or sector_id is null)
       and upper(trim(typology_code))=v_typology
     order by (sector_id is not null) desc limit 1;
     if not found then raise exception 'No hay regla tarifaria para %',v_typology; end if;
     select * into v_rate from public.calculate_udc_tariff(v_typology,v_month);
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
end; $$;
revoke all on function public.generate_official_condominium_assessments(uuid,date) from public,anon;
grant execute on function public.generate_official_condominium_assessments(uuid,date) to authenticated;
