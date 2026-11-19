-- Case- and accent-insensitive debtor lookup; avoid V-V prefix duplication.
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