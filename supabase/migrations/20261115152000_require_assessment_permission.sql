create or replace function public.generate_official_property_assessments(
  p_property_id uuid,
  p_through_date date default current_date
)
returns table(assessment_id uuid, period_start date, amount numeric, result text)
language plpgsql
security definer
set search_path = public, private
as $$
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
  select * into v_schedule from public.tariff_schedules
  where is_approved=true and valid_from<=date '2027-01-01'
    and (valid_until is null or valid_until>=date '2027-01-01')
  order by valid_from desc limit 1;
  if not found then raise exception 'No existe un tabulador residencial aprobado y vigente desde enero de 2027. No se generó ninguna obligación.'; end if;
  select * into v_rule from public.tariff_rules
  where schedule_id=v_schedule.id and (sector_id=v_property.sector_id or sector_id is null)
    and typology_code=case when upper(v_typology) like '%III%' then 'III' when upper(v_typology) like '%II%' then 'II' else 'I' end
    and unit_basis='per_property'
  order by (sector_id is not null) desc limit 1;
  if not found then raise exception 'No existe una regla tarifaria residencial aprobada para la tipología y sector de este inmueble. No se generó ninguna obligación.'; end if;
  if p_through_date<date '2027-01-01' then return; end if;
  v_month:=date '2027-01-01';
  while v_month<=date_trunc('month',least(p_through_date,current_date))::date loop
    if not exists(select 1 from public.assessments a where a.property_id=p_property_id
      and a.period_start=v_month and a.period_end=(v_month+interval '1 month - 1 day')::date and a.is_demo=false) then
      select * into v_calc from public.calculate_udc_tariff(v_typology,v_month);
      if v_calc.udc_effective_date < (v_month - interval '7 days')::date then
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
$$;
revoke all on function public.generate_official_property_assessments(uuid,date) from public,anon;
grant execute on function public.generate_official_property_assessments(uuid,date) to authenticated;