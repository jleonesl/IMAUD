-- SITMAUD · Paso 6: indicadores y operaciones sin DEMO ni duplicación de cuentas matrices.
create or replace function public.get_official_financial_overview()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 v_today date:=(now() at time zone 'America/Caracas')::date;
 v_first date:=date_trunc('month',(now() at time zone 'America/Caracas'))::date;
 v_due numeric(18,2);
 v_pending numeric(18,2);
 v_liquidated_today numeric(18,2);
 v_liquidated_month numeric(18,2);
 v_liquidated_total numeric(18,2);
 v_pending_count integer;
 v_reg_today integer;
 v_paid_today integer;
 v_paid_month integer;
 v_debts_count integer;
begin
 if auth.uid() is null
   or not public.has_permission('dashboard.read')
   or not public.has_permission('payments.read')
   or not public.has_permission('assessments.read') then
   raise exception 'Sin permisos para consultar indicadores financieros' using errcode='42501';
 end if;
 -- El saldo registrado en Bs. es contable y puede variar al recalcular UCD
 -- en la fecha del pago, según el procedimiento tributario aprobado.
 select coalesce(sum(greatest(0,a.total_amount - coalesce((
   select sum(al.amount) from public.payment_allocations al
   join public.payments py on py.id=al.payment_id and py.status='confirmed'
   where al.assessment_id=a.id
 ),0))),0),count(*) filter(where a.status in ('pending','partially_paid'))
 into v_due,v_debts_count from public.assessments a
 where a.is_demo=false and a.status in ('pending','partially_paid')
   and not exists(select 1 from public.debt_relief_grants g
     where g.assessment_id=a.id and g.revoked_at is null);
 select coalesce(sum(amount) filter(where status='pending'),0),
        count(*) filter(where status='pending'),
        count(*) filter(where (created_at at time zone 'America/Caracas')::date=v_today),
        coalesce(sum(amount) filter(where status='confirmed' and
          (liquidated_at at time zone 'America/Caracas')::date=v_today),0),
        count(*) filter(where status='confirmed' and
          (liquidated_at at time zone 'America/Caracas')::date=v_today),
        coalesce(sum(amount) filter(where status='confirmed' and
          (liquidated_at at time zone 'America/Caracas')::date>=v_first
          and (liquidated_at at time zone 'America/Caracas')::date<=v_today),0),
        count(*) filter(where status='confirmed' and
          (liquidated_at at time zone 'America/Caracas')::date>=v_first
          and (liquidated_at at time zone 'America/Caracas')::date<=v_today),
        coalesce(sum(amount) filter(where status='confirmed'),0)
 into v_pending,v_pending_count,v_reg_today,v_liquidated_today,
      v_paid_today,v_liquidated_month,v_paid_month,v_liquidated_total
 from public.payments;
 return jsonb_build_object(
  'as_of',now(),'timezone','America/Caracas','currency','VES',
  'amount_to_collect',v_due,'pending_count',v_pending_count,
  'pending_amount',v_pending,'registered_today_count',v_reg_today,
  'liquidated_today_count',v_paid_today,'liquidated_month_count',v_paid_month,
  'liquidated_today',v_liquidated_today,'liquidated_month',v_liquidated_month,
  'liquidated_total',v_liquidated_total,'pending_debts_count',v_debts_count,
  'pending_by_currency',jsonb_build_object('VES',v_pending),
  'liquidated_today_by_currency',jsonb_build_object('VES',v_liquidated_today),
  'liquidated_month_by_currency',jsonb_build_object('VES',v_liquidated_month),
  'liquidated_total_by_currency',jsonb_build_object('VES',v_liquidated_total),
  'approved_tariff_count',(select count(*) from public.tariff_schedules where is_approved),
  'basis','official_assessments_and_confirmed_treasury_payments',
  'note','La deuda en bolívares es el valor registrado y puede recalcularse al pagar según UCD vigente');
end; $$;
revoke all on function public.get_official_financial_overview() from public,anon;
grant execute on function public.get_official_financial_overview() to authenticated;

create or replace function public.get_official_operations_report(
 p_from date,p_to date,p_status text default null,
 p_limit integer default 100,p_offset integer default 0
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_count bigint;v_rows jsonb;v_totals jsonb;
begin
 if auth.uid() is null or not public.has_permission('reports.read')
   or not public.has_permission('payments.read') then
   raise exception 'Sin permisos para consultar reportes oficiales' using errcode='42501';
 end if;
 if p_from is null or p_to is null or p_from>p_to or p_to-p_from>3660 then
   raise exception 'Rango no válido, máximo 10 años';
 end if;
 if p_status is not null and p_status not in ('pending','confirmed','reversed') then
   raise exception 'Estado de operación no permitido';
 end if;
 if p_limit is null or p_limit<1 or p_limit>250 or p_offset is null
   or p_offset<0 or p_offset>100000 then
   raise exception 'Paginación fuera del rango permitido';
 end if;
 select count(*) into v_count from public.payments py
 where py.created_at >= (p_from::timestamp at time zone 'America/Caracas')
 and py.created_at < ((p_to+1)::timestamp at time zone 'America/Caracas')
 and (p_status is null or py.status::text=p_status);
 select coalesce(jsonb_object_agg(status_code,jsonb_build_object(
   'count',total_count,'amount_ves',total_amount)),'{}'::jsonb)
 into v_totals from (
   select py.status::text status_code,count(*) total_count,
      coalesce(sum(py.amount),0) total_amount
   from public.payments py
   where py.created_at >= (p_from::timestamp at time zone 'America/Caracas')
   and py.created_at < ((p_to+1)::timestamp at time zone 'America/Caracas')
   and (p_status is null or py.status::text=p_status)
   group by py.status
 ) totals;
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',p.id,'receipt_number',p.receipt_number,
   'contributor_name',coalesce(c.legal_name,nullif(trim(concat_ws(' ',c.first_name,c.last_name)),''),'Sin nombre'),
   'identification',concat_ws('-',c.identification_type,c.identification_number),
   'contract_number',c.contract_number,
   'created_at',p.created_at,'paid_at',p.paid_at,'liquidated_at',p.liquidated_at,
   'status',p.status,'currency_code',p.currency_code,'amount',p.amount,
   'bank_code',p.bank_code,'external_reference',p.external_reference,
   'payment_method',p.payment_method,'udc_total',p.payment_udc_total,
   'rate_effective_date',r.effective_date,'rate_source',r.source_url
 ) order by p.created_at desc,p.id desc),'[]'::jsonb) into v_rows from (
   select py.* from public.payments py
   where py.created_at >= (p_from::timestamp at time zone 'America/Caracas')
   and py.created_at < ((p_to+1)::timestamp at time zone 'America/Caracas')
   and (p_status is null or py.status::text=p_status)
   order by py.created_at desc,py.id desc limit p_limit offset p_offset
 ) p
 join public.contributors c on c.id=p.contributor_id
 left join public.udc_rates r on r.id=p.payment_udc_rate_id;
 return jsonb_build_object(
   'from',p_from,'to',p_to,'filter_status',p_status,
   'timezone','America/Caracas','basis','registered_official_operations',
   'rows',v_rows,'total_count',v_count,'limit',p_limit,'offset',p_offset,
   'totals_by_status',v_totals);
end; $$;
revoke all on function public.get_official_operations_report(date,date,text,integer,integer) from public,anon;
grant execute on function public.get_official_operations_report(date,date,text,integer,integer) to authenticated;
