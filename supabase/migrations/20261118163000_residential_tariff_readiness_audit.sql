-- SITMAUD: auditoría previa a la aprobación del tabulador residencial.
-- No modifica tarifas ni activa cobros. La validación normativa sigue siendo obligatoria.
create or replace function public.residential_tariff_readiness(p_schedule_id uuid)
returns table(check_code text, passed boolean, detail text)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  s public.tariff_schedules%rowtype;
  missing_count integer;
  ambiguous_count integer;
  invalid_count integer;
begin
  if auth.uid() is null or public.current_staff_role() is null then
    raise exception 'Solo el personal institucional autenticado puede consultar la auditoría tarifaria.';
  end if;
  select * into s from public.tariff_schedules where id=p_schedule_id;
  if not found then raise exception 'Tabulador no encontrado'; end if;

  check_code:='vigencia_2027';
  passed:=s.valid_from=date '2027-01-01' and (s.valid_until is null or s.valid_until>=s.valid_from);
  detail:=case when passed then 'Inicio de vigencia configurado para enero de 2027' else 'La vigencia no coincide con el ciclo oficial de enero de 2027' end;
  return next;

  check_code:='ordenanza_documentada';
  passed:=length(trim(coalesce(s.ordinance_reference,'')))>=15
    and s.ordinance_reference !~* 'pendiente|catálogo de trabajo|excel';
  detail:=case when passed then 'Referencia normativa registrada; requiere revisión documental humana'
    else 'Falta vincular y cotejar la ordenanza promulgada y sus anexos' end;
  return next;

  select count(*) into invalid_count from public.tariff_rules r
  where r.schedule_id=p_schedule_id and
  (r.amount<=0 or r.unit_basis<>'per_property' or
   upper(trim(r.typology_code)) not in ('I','II','III','TIPO I','TIPO II','TIPO III'));
  check_code:='reglas_validas';passed:=invalid_count=0;
  detail:=invalid_count||' reglas residenciales no válidas';return next;

  select count(*) into missing_count from (values ('I'),('II'),('III')) as t(code)
  where not exists (
    select 1 from public.tariff_rules r where r.schedule_id=p_schedule_id
      and r.sector_id is null and r.parish_id is null and r.unit_basis='per_property'
      and upper(trim(r.typology_code)) in (t.code,'TIPO '||t.code)
  );
  check_code:='tipologias_completas';passed:=missing_count=0;
  detail:=missing_count||' tipologías sin regla general (I, II, III)';return next;

  select count(*) into missing_count from public.sectors sec
  where sec.is_active and (
    sec.default_typology is null or upper(trim(sec.default_typology)) not in
      ('I','II','III','TIPO I','TIPO II','TIPO III')
  );
  check_code:='sectores_tipificados';passed:=missing_count=0;
  detail:=missing_count||' sectores activos sin tipología residencial válida';return next;

  select count(*) into ambiguous_count from (
    select coalesce(r.sector_id::text,'general') scope,
      case when upper(trim(r.typology_code)) like '%III%' then 'III'
           when upper(trim(r.typology_code)) like '%II%' then 'II' else 'I' end typ
    from public.tariff_rules r where r.schedule_id=p_schedule_id and r.unit_basis='per_property'
    group by 1,2 having count(*)>1
  ) d;
  check_code:='sin_reglas_duplicadas';passed:=ambiguous_count=0;
  detail:=ambiguous_count||' combinaciones ámbito/tipología duplicadas';return next;

  check_code:='aprobacion_formal';
  passed:=s.is_approved and s.approved_by is not null;
  detail:=case when passed then 'Marcado aprobado y con responsable registrado'
    else 'Aún no existe aprobación formal por funcionario autorizado' end;
  return next;
end;
$$;
revoke all on function public.residential_tariff_readiness(uuid) from public,anon;
grant execute on function public.residential_tariff_readiness(uuid) to authenticated;
