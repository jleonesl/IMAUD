-- SITMAUD: debtors queried server-side with permission checks and pagination.
create or replace function public.list_official_debtors(
 p_search text default '', p_kind text default '', p_limit integer default 50, p_offset integer default 0
) returns jsonb language plpgsql stable security definer set search_path='' as $$
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
    concat_ws('-',nullif(c.identification_type,''),nullif(c.identification_number,'')) identification,
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
          name ilike '%'||btrim(p_search)||'%' or
          id_number ilike '%'||btrim(p_search)||'%' or
          address ilike '%'||btrim(p_search)||'%')
 )
 select count(*) from filtered into v_count;
 with eligible as (
   select c.id contributor_id,
    coalesce(c.contract_number,'') contract,
    case when c.kind='juridico' then coalesce(c.legal_name,'Persona jurídica')
         else coalesce(nullif(concat_ws(' ',c.first_name,c.last_name),''),c.legal_name,'Contribuyente') end as full_name,
    concat_ws('-',nullif(c.identification_type,''),nullif(c.identification_number,'')) identification,
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
     or name ilike '%'||btrim(p_search)||'%' or id_number ilike '%'||btrim(p_search)||'%'
     or address ilike '%'||btrim(p_search)||'%')
 )
 select coalesce(jsonb_agg(jsonb_build_object('contract',contract,'name',name,'idNumber',id_number,
   'address',address,'condominium',condominium,'months',months,'debt',debt) order by name,contract),'[]'::jsonb)
 into v_items from (select * from filtered order by name,contract limit p_limit offset p_offset) page;
 return jsonb_build_object('items',v_items,'total',v_count,'limit',p_limit,'offset',p_offset);
end $$;
revoke all on function public.list_official_debtors(text,text,integer,integer) from public,anon;
grant execute on function public.list_official_debtors(text,text,integer,integer) to authenticated;

create index if not exists assessments_status_property_lookup_idx
 on public.assessments(property_id,period_start) where is_demo=false and status in ('pending','partially_paid');
create index if not exists payment_allocations_assessment_lookup_idx on public.payment_allocations(assessment_id,payment_id);
create index if not exists payments_contributor_created_lookup_idx on public.payments(contributor_id,created_at desc);
