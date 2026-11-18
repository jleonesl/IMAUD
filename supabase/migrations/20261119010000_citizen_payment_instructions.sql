-- SITMAUD / Información de pago visible únicamente con cuenta ciudadana activa.
-- Ninguna cuenta bancaria se publica hasta cargar y habilitar datos oficiales verificados.
create table if not exists public.municipal_payment_accounts (
 id uuid primary key default gen_random_uuid(),
 method text not null check (method in ('transferencia','pago_movil')),
 bank_name text not null check(length(btrim(bank_name)) between 3 and 120),
 holder_name text not null check(length(btrim(holder_name)) between 3 and 180),
 holder_rif text not null check(length(btrim(holder_rif)) between 8 and 20),
 account_number text,
 mobile_number text,
 is_published boolean not null default false,
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id),
 constraint official_account_fields check(
  (method='transferencia' and account_number ~ '^[0-9]{20}$' and mobile_number is null)
  or (method='pago_movil' and mobile_number ~ '^[0-9]{10,15}$' and account_number is null)
 )
);
alter table public.municipal_payment_accounts enable row level security;
revoke all on public.municipal_payment_accounts from public,anon,authenticated;

create or replace function public.get_municipal_payment_instructions()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_accounts jsonb;
begin
 if auth.uid() is null or not exists(
  select 1 from public.citizen_accounts ca
  join public.contributors c on c.id=ca.contributor_id
  where ca.auth_user_id=auth.uid() and ca.is_active=true and c.status='active'
 ) then
  raise exception 'Acceso ciudadano activado requerido' using errcode='42501';
 end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'method',method,'bank',bank_name,'holder',holder_name,
  'rif',holder_rif,'account_number',account_number,
  'mobile_number',mobile_number
 ) order by bank_name,method),'[]'::jsonb) into v_accounts
 from public.municipal_payment_accounts where is_published=true;
 return jsonb_build_object('accounts',v_accounts,
  'notice','Utilice únicamente cuentas verificadas y publicadas por la Alcaldía. Registre su referencia y comprobante para la validación de Tesorería. La transferencia no acredita automáticamente la deuda.');
end $$;
revoke all on function public.get_municipal_payment_instructions() from public,anon;
grant execute on function public.get_municipal_payment_instructions() to authenticated;

create or replace function public.manage_municipal_payment_account(
 p_id uuid,p_method text,p_bank text,p_holder text,p_rif text,
 p_account text,p_phone text,p_published boolean
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if auth.uid() is null or not public.is_sitmaud_master() then
  raise exception 'Solo el superusuario maestro puede configurar cuentas bancarias oficiales' using errcode='42501';
 end if;
 if p_id is null then
  insert into public.municipal_payment_accounts(method,bank_name,holder_name,holder_rif,
     account_number,mobile_number,is_published,updated_by)
  values(p_method,btrim(p_bank),btrim(p_holder),upper(btrim(p_rif)),
    nullif(btrim(coalesce(p_account,'')),''),nullif(btrim(coalesce(p_phone,'')),''),p_published,auth.uid())
  returning id into v_id;
 else
  update public.municipal_payment_accounts set
   method=p_method,bank_name=btrim(p_bank),holder_name=btrim(p_holder),
   holder_rif=upper(btrim(p_rif)),account_number=nullif(btrim(coalesce(p_account,'')),''), 
   mobile_number=nullif(btrim(coalesce(p_phone,'')),''),is_published=p_published,
   updated_at=now(),updated_by=auth.uid()
  where id=p_id returning id into v_id;
  if v_id is null then raise exception 'Cuenta bancaria no encontrada';end if;
 end if;
 insert into public.audit_log(actor_user_id,action,entity_table,entity_id,after_data)
 values(auth.uid(),'municipal_payment_account_updated','municipal_payment_accounts',v_id::text,
  jsonb_build_object('method',p_method,'bank',p_bank,'published',p_published));
 return jsonb_build_object('id',v_id,'published',p_published);
end $$;
revoke all on function public.manage_municipal_payment_account(uuid,text,text,text,text,text,text,boolean) from public,anon;
grant execute on function public.manage_municipal_payment_account(uuid,text,text,text,text,text,text,boolean) to authenticated;

create or replace function public.list_municipal_payment_accounts_admin()
returns jsonb language sql stable security definer set search_path=''
as $$ select coalesce(jsonb_agg(to_jsonb(x) order by x.bank_name),'[]'::jsonb)
 from public.municipal_payment_accounts x
 where public.is_sitmaud_master(); $$;
revoke all on function public.list_municipal_payment_accounts_admin() from public,anon;
grant execute on function public.list_municipal_payment_accounts_admin() to authenticated;
