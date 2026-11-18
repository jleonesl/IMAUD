-- SITMAUD: sólo tasas consultadas desde el BCV oficial habilitan cálculos tributarios.
-- Mantiene tasas históricas para auditoría, no las borra ni modifica.
create or replace function public.calculate_udc_tariff(
 p_typology_code text, p_period_date date default current_date
) returns table (
 typology_code text, coefficient numeric, udc_currency_code text,
 udc_currency_name text, udc_value numeric, udc_effective_date date,
 monthly_amount numeric, source_url text
)
language plpgsql stable set search_path=public
as $$
declare
 v_coefficient numeric(8,3);
 v_rate public.udc_rates%rowtype;
 v_typology text := upper(trim(coalesce(p_typology_code,'')));
begin
 v_coefficient := case
  when v_typology in ('I','TIPO I','TIPO I:') then 3.0
  when v_typology in ('II','TIPO II','TIPO II:') then 1.5
  when v_typology in ('III','TIPO III','TIPO III:') then 0.5
  else null end;
 if v_coefficient is null then
  raise exception 'Tipología no válida. Use Tipo I, Tipo II o Tipo III.';
 end if;
 select * into v_rate from public.udc_rates
 where effective_date<=p_period_date
 order by effective_date desc limit 1;
 if not found then
  raise exception 'No existe una tasa BCV para la fecha solicitada.';
 end if;
 if v_rate.source_url is distinct from 'https://www.bcv.org.ve/'
   or v_rate.source_name is distinct from 'Banco Central de Venezuela — fuente oficial' then
  raise exception 'La tasa BCV registrada para % no fue obtenida directamente del sitio oficial. Se bloqueó el cálculo.',v_rate.effective_date;
 end if;
 if v_rate.effective_date < (p_period_date - interval '7 days')::date then
  raise exception 'La tasa oficial BCV de % no es suficientemente reciente para %. Se bloqueó el cálculo.',v_rate.effective_date,p_period_date;
 end if;
 return query select
 case when v_typology like '%III%' then 'III'
      when v_typology like '%II%' then 'II' else 'I' end,
 v_coefficient,v_rate.udc_currency_code,v_rate.udc_currency_name,
 v_rate.udc_value,v_rate.effective_date,
 round(v_coefficient*v_rate.udc_value,2),v_rate.source_url;
end;
$$;
