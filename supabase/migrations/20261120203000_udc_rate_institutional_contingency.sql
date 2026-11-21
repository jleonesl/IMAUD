-- SITMAUD: contingency BCV approval with explicit institutional evidence.
-- A rate from a third-party source is never relabelled as direct BCV.
create table if not exists private.udc_rate_manual_checks (
  rate_id uuid primary key references public.udc_rates(id) on delete restrict,
  effective_date date not null,
  verified_currency text not null,
  verified_value numeric(20,8) not null check(verified_value>0),
  official_reference text not null default 'https://www.bcv.org.ve/',
  evidence_notes text not null check (length(btrim(evidence_notes))>=30),
  verified_by uuid not null references auth.users(id),
  verified_at timestamptz not null default now()
);
alter table private.udc_rate_manual_checks enable row level security;
revoke all on private.udc_rate_manual_checks from public,anon,authenticated;

create or replace function public.get_udc_rate_readiness()
returns jsonb language plpgsql stable security definer set search_path=''
as $fn$
declare r public.udc_rates%rowtype; v_today date:=(now() at time zone 'America/Caracas')::date;
v_manual boolean;v_valid boolean;
begin
 if auth.uid() is null or not (
   public.is_sitmaud_master() or public.has_permission('tariffs.read')
   or public.has_permission('payments.read') or public.has_permission('payments.register')
 ) then raise exception 'No autorizado para consultar UCD' using errcode='42501'; end if;
 select * into r from public.udc_rates order by effective_date desc limit 1;
 if not found then return jsonb_build_object('available',false,'ready',false,'reason','no_rate'); end if;
 select exists(select 1 from private.udc_rate_manual_checks c
  where c.rate_id=r.id and c.effective_date=r.effective_date
   and c.verified_currency=r.udc_currency_code
   and c.verified_value=r.udc_value) into v_manual;
 v_valid:=(r.effective_date<=v_today and r.effective_date>=v_today-3);
 return jsonb_build_object('available',true,'ready',v_valid and
   (r.source_url='https://www.bcv.org.ve/' or v_manual),
  'rate_id',r.id,'effective_date',r.effective_date,
  'currency',r.udc_currency_code,'value_bs',r.udc_value,
  'source_url',r.source_url,'verified_manually',v_manual,
  'verified_directly',r.source_url='https://www.bcv.org.ve/',
  'eligible_date',v_valid,'can_approve',public.is_sitmaud_master());
end $fn$;
revoke all on function public.get_udc_rate_readiness() from public,anon;
grant execute on function public.get_udc_rate_readiness() to authenticated;

create or replace function public.approve_udc_rate_contingency(
  p_rate_id uuid,p_confirmed_value numeric,p_evidence_notes text,p_confirm boolean default false)
returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare r public.udc_rates%rowtype; v_today date:=(now() at time zone 'America/Caracas')::date;
begin
 if auth.uid() is null or not public.is_sitmaud_master() then
  raise exception 'Solo el superusuario maestro puede verificar la UCD' using errcode='42501';
 end if;
 if not coalesce(p_confirm,false) then raise exception 'Debes confirmar la comprobación oficial'; end if;
 if p_evidence_notes is null or length(btrim(p_evidence_notes))<30 then
  raise exception 'Describe el respaldo oficial consultado (mínimo 30 caracteres)';
 end if;
 select * into r from public.udc_rates where id=p_rate_id for update;
 if not found then raise exception 'Tasa inexistente';end if;
 if r.effective_date>v_today or r.effective_date<v_today-3 then
  raise exception 'La fecha de la tasa está fuera del plazo admitido para pagos';
 end if;
 if r.udc_currency_code<>'EUR' then
  raise exception 'Verifica la moneda UCD vigente antes de aprobar: el registro no corresponde a EUR';
 end if;
 if p_confirmed_value is null or p_confirmed_value<=0
    or round(p_confirmed_value,8)<>round(r.udc_value,8) then
  raise exception 'La cifra contrastada con el BCV no coincide con el valor registrado. No se ha aprobado';
 end if;
 if r.source_url='https://www.bcv.org.ve/' then
  return jsonb_build_object('ok',true,'already_official',true,'effective_date',r.effective_date);
 end if;
 insert into private.udc_rate_manual_checks
  (rate_id,effective_date,verified_currency,verified_value,evidence_notes,verified_by)
 values (r.id,r.effective_date,r.udc_currency_code,r.udc_value,btrim(p_evidence_notes),auth.uid())
 on conflict (rate_id) do nothing;
 if not found then raise exception 'Esta tasa ya cuenta con una verificación registrada';end if;
 perform public.record_staff_activity('udc_rate_contingency_verified','tariffs',r.id::text);
 return jsonb_build_object('ok',true,'verified_manually',true,'rate_id',r.id,
   'effective_date',r.effective_date,'udc_value',r.udc_value,'source_url',r.source_url);
end $fn$;
revoke all on function public.approve_udc_rate_contingency(uuid,numeric,text,boolean) from public,anon;
grant execute on function public.approve_udc_rate_contingency(uuid,numeric,text,boolean) to authenticated;

-- Keep both the quote and transaction register reading the SAME eligible rate.
-- Old source integrity remains unchanged; institutional verification is an additional audit.
do $patch$
declare n text; definition text; patched text;
begin
 foreach n in array array['quote_official_udc_payment','quote_citizen_udc_payment',
   'register_official_udc_payment_core','register_citizen_udc_payment_core'] loop
  select pg_get_functiondef(p.oid) into definition
  from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
  where ns.nspname='public' and p.proname=n;
  if definition is null then raise exception 'Missing financial function %',n;end if;
  if position('and source_url = ''https://www.bcv.org.ve/''' in definition)=0 then
   raise exception 'Missing expected rate source check in %',n;
  end if;
  patched:=replace(definition,
    'and source_url = ''https://www.bcv.org.ve/''',
    'and (source_url = ''https://www.bcv.org.ve/'' or exists (
       select 1 from private.udc_rate_manual_checks c
       where c.rate_id = public.udc_rates.id
         and c.effective_date = public.udc_rates.effective_date
         and c.verified_currency = public.udc_rates.udc_currency_code
         and c.verified_value = public.udc_rates.udc_value
     ))');
  execute patched;
 end loop;
end $patch$;
