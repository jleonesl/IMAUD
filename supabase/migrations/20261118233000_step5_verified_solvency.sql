-- SITMAUD · Paso 5: emisión institucional de solvencias con respaldo verificable.
-- No se admiten períodos futuros ni certificados basados en pagos aún no liquidados.
create or replace function public.issue_solvency_certificate(
 p_contributor_id uuid,p_period_start date,p_period_end date
) returns public.solvency_certificates
language plpgsql security definer set search_path='' as $$
declare
 v_actor uuid:=auth.uid();
 v_today date:=(now() at time zone 'America/Caracas')::date;
 v_person public.contributors%rowtype;
 v_result public.solvency_certificates%rowtype;
 v_properties jsonb;
 v_active integer;
 v_invalid integer;
 v_number text;
begin
 if v_actor is null or not public.has_permission('solvencies.issue') then
   raise exception 'Solo funcionarios con permiso de solvencia pueden emitir certificados' using errcode='42501';
 end if;
 if p_contributor_id is null or p_period_start is null or p_period_end is null
    or p_period_start<date '2027-01-01' or p_period_end>v_today
    or p_period_end<p_period_start or date_trunc('month',p_period_start)::date<>p_period_start
    or (date_trunc('month',p_period_end)+interval '1 month - 1 day')::date<>p_period_end then
   raise exception 'La solvencia requiere meses completos, no futuros y desde enero de 2027.';
 end if;
 if (extract(year from age(p_period_end,p_period_start))*12
     + extract(month from age(p_period_end,p_period_start)))>120 then
   raise exception 'El rango excede 120 meses y requiere revisión administrativa.';
 end if;
 select * into v_person from public.contributors
 where id=p_contributor_id and status='active' for share;
 if not found then raise exception 'Contribuyente inexistente o inactivo.'; end if;
 -- Una cuenta matriz se comprueba una vez; las viviendas hijas no originan cargos individuales.
 select count(*) into v_active from public.properties p
 where p.contributor_id=p_contributor_id and p.is_active=true
   and (p.organization_id is null or p.is_consolidated_master=true
        or not exists(select 1 from public.residential_organizations o
           where o.id=p.organization_id and o.consolidated_billing=true));
 if v_active=0 then raise exception 'No hay cuentas activas susceptibles de solvencia.'; end if;
 -- Bloqueo de registros durante la comprobación.
 perform 1 from public.assessments a join public.properties p on p.id=a.property_id
 where p.contributor_id=p_contributor_id and p.is_active=true
   and a.is_demo=false and a.period_end>=p_period_start and a.period_start<=p_period_end
 order by a.id for share of a;
 select count(*) into v_invalid
 from public.properties p
 cross join generate_series(p_period_start,p_period_end,interval '1 month') m(month_start)
 where p.contributor_id=p_contributor_id and p.is_active=true
 and (p.organization_id is null or p.is_consolidated_master=true
        or not exists(select 1 from public.residential_organizations o
           where o.id=p.organization_id and o.consolidated_billing=true))
 and not exists(
   select 1 from public.assessments a
   where a.property_id=p.id and a.is_demo=false
     and a.period_start=m.month_start::date
     and a.period_end=(m.month_start+interval '1 month - 1 day')::date
     and (
       (
         a.status='paid'
         and coalesce((select sum(pa.amount) from public.payment_allocations pa
             join public.payments py on py.id=pa.payment_id
             where pa.assessment_id=a.id and py.status='confirmed'),0)>=a.total_amount
       )
       or exists(select 1 from public.debt_relief_grants g
          where g.assessment_id=a.id and g.revoked_at is null
          and length(btrim(coalesce(g.legal_reference,'')))>=8)
     )
 );
 if v_invalid>0 then
    raise exception 'No se puede emitir: % meses/cuentas sin pago liquidado o exoneración autorizada.',v_invalid;
 end if;
 if exists(select 1 from public.solvency_certificates sc where sc.contributor_id=p_contributor_id
   and sc.period_start=p_period_start and sc.period_end=p_period_end and sc.status='issued') then
   raise exception 'Ya existe una solvencia vigente para el mismo período.';
 end if;
 select coalesce(jsonb_agg(jsonb_build_object(
    'property_id',p.id,'contract_number',coalesce(p.contract_number,v_person.contract_number),
    'address',p.address,'sector',coalesce(p.sector_name,s.name),
    'parish',coalesce(p.parish_name,pa.name),
    'typology',coalesce(o.billing_typology,p.typology_override,s.default_typology),
    'is_consolidated_master',p.is_consolidated_master,
    'consolidated_units',p.consolidated_units
 ) order by p.created_at),'[]'::jsonb) into v_properties
 from public.properties p
 left join public.sectors s on s.id=p.sector_id
 left join public.parishes pa on pa.id=p.parish_id
 left join public.residential_organizations o on o.id=p.organization_id
 where p.contributor_id=p_contributor_id and p.is_active=true
   and (p.organization_id is null or p.is_consolidated_master=true or coalesce(o.consolidated_billing,false)=false);
 v_number:='SOL-'||to_char(v_today,'YYYY')||'-'||
   lpad(nextval('public.solvency_certificate_seq')::text,6,'0');
 insert into public.solvency_certificates(
   certificate_number,contributor_id,period_start,period_end,issue_date,
   contributor_snapshot,property_snapshot,issued_by
 ) values(v_number,p_contributor_id,p_period_start,p_period_end,v_today,
   jsonb_build_object('kind',v_person.kind,'identification_type',v_person.identification_type,
     'identification_number',v_person.identification_number,'legal_name',v_person.legal_name,
     'first_name',v_person.first_name,'last_name',v_person.last_name,
     'contract_number',v_person.contract_number),
   v_properties,v_actor)
 returning * into v_result;
 insert into public.audit_log(actor_user_id,action,entity_table,entity_id,after_data)
 values(v_actor,'solvency_certificate_issued','solvency_certificates',v_result.id::text,
  jsonb_build_object('certificate_number',v_number,'contributor_id',p_contributor_id,
  'period_start',p_period_start,'period_end',p_period_end,
  'verified_accounts',v_active,'properties',v_properties));
 return v_result;
end; $$;
revoke all on function public.issue_solvency_certificate(uuid,date,date) from public,anon;
grant execute on function public.issue_solvency_certificate(uuid,date,date) to authenticated;

-- Verificación pública limitada: revela solo la validez y los períodos del documento,
-- nunca cédula, dirección, identidad o datos financieros del contribuyente.
create or replace function public.verify_solvency_number(p_number text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v public.solvency_certificates%rowtype;
begin
 if p_number is null or p_number !~ '^SOL-[0-9]{4}-[0-9]{6}$' then
   return jsonb_build_object('valid',false,'status','not_found');
 end if;
 select * into v from public.solvency_certificates where certificate_number=p_number;
 if not found then return jsonb_build_object('valid',false,'status','not_found'); end if;
 return jsonb_build_object('valid',v.status='issued','status',v.status,
   'certificate_number',v.certificate_number,'issue_date',v.issue_date,
   'period_start',v.period_start,'period_end',v.period_end);
end; $$;
revoke all on function public.verify_solvency_number(text) from public;
grant execute on function public.verify_solvency_number(text) to anon,authenticated;
