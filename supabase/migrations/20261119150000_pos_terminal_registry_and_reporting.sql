-- SITMAUD · Catálogo y recaudación por terminal de punto de venta.
-- Migración repetible sin modificar operaciones históricas.
create table if not exists public.pos_terminals (
 id uuid primary key default gen_random_uuid(),
 terminal_code text not null unique check (length(btrim(terminal_code)) between 3 and 60),
 name text not null check (length(btrim(name)) between 3 and 120),
 bank_code text not null references public.payment_banks(code),
 location text not null default '',
 notes text,
 is_active boolean not null default true,
 created_at timestamptz not null default now(),
 created_by uuid default auth.uid(),
 updated_at timestamptz not null default now()
);
create index if not exists pos_terminals_bank_idx on public.pos_terminals(bank_code,is_active);
alter table public.pos_terminals enable row level security;
revoke all on public.pos_terminals from anon,authenticated;
grant select,insert,update on public.pos_terminals to authenticated;
drop policy if exists pos_terminals_read_staff on public.pos_terminals;
create policy pos_terminals_read_staff on public.pos_terminals for select to authenticated
using (public.has_permission('payments.register') or public.has_permission('reports.read') or public.has_permission('settings.manage'));
drop policy if exists pos_terminals_insert_admin on public.pos_terminals;
create policy pos_terminals_insert_admin on public.pos_terminals for insert to authenticated
with check (public.has_permission('settings.manage'));
drop policy if exists pos_terminals_update_admin on public.pos_terminals;
create policy pos_terminals_update_admin on public.pos_terminals for update to authenticated
using (public.has_permission('settings.manage'))
with check (public.has_permission('settings.manage'));
alter table public.payments add column if not exists pos_terminal_id uuid references public.pos_terminals(id);
create index if not exists payments_pos_terminal_date_idx on public.payments(pos_terminal_id,paid_at) where pos_terminal_id is not null;

CREATE OR REPLACE FUNCTION public.enforce_pos_terminal_at_cashier()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid; v_terminal public.pos_terminals%rowtype; v_setting text;
begin
 if new.payment_method <> 'punto_venta' or new.registration_channel <> 'taquilla' then return new; end if;
 v_setting:=nullif(current_setting('sitmaud.pos_terminal_id',true),'');
 if v_setting is null then
   raise exception 'Debes seleccionar el punto de venta municipal antes de registrar el pago.';
 end if;
 v_id:=v_setting::uuid;
 select * into v_terminal from public.pos_terminals where id=v_id and is_active=true for share;
 if not found then raise exception 'Punto de venta no existe o está inactivo'; end if;
 if v_terminal.bank_code is distinct from new.bank_code then
   raise exception 'El banco del punto de venta no coincide con el banco del pago';
 end if;
 new.pos_terminal_id:=v_id;
 return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.get_pos_terminal_report(p_from date, p_to date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_result jsonb;
begin
 if auth.uid() is null or not (public.has_permission('reports.read') or public.has_permission('settings.manage')) then
   raise exception 'Sin permiso para consultar reportes de puntos de venta' using errcode='42501';
 end if;
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>366 then
   raise exception 'Rango de fechas inválido (máximo 366 días)';
 end if;
 select jsonb_build_object(
  'from',p_from,'to',p_to,
  'terminals',coalesce((
    select jsonb_agg(jsonb_build_object('id',t.id,'code',t.terminal_code,
      'name',t.name,'bank_code',t.bank_code,'location',t.location,'active',t.is_active,
      'registered_count',coalesce(a.total_count,0),
      'registered_bs',coalesce(a.registered_bs,0),
      'pending_bs',coalesce(a.pending_bs,0),
      'validated_bs',coalesce(a.validated_bs,0),
      'rejected_bs',coalesce(a.rejected_bs,0)) order by t.terminal_code)
    from public.pos_terminals t
    left join lateral (
      select count(*) total_count,coalesce(sum(p.amount),0) registered_bs,
      coalesce(sum(p.amount) filter(where p.status='pending'),0) pending_bs,
      coalesce(sum(p.amount) filter(where p.status='confirmed'),0) validated_bs,
      coalesce(sum(p.amount) filter(where p.status='reversed'),0) rejected_bs
      from public.payments p where p.pos_terminal_id=t.id
       and (p.paid_at at time zone 'America/Caracas')::date between p_from and p_to
    ) a on true
  ),'[]'::jsonb),
  'transactions',coalesce((
     select jsonb_agg(jsonb_build_object('terminal_code',t.terminal_code,'paid_at',p.paid_at,
       'receipt_number',p.receipt_number,'reference',p.external_reference,'amount_bs',p.amount,
       'status',p.status,'cashier',coalesce(sp.display_name,'—')) order by p.paid_at desc)
     from public.payments p join public.pos_terminals t on t.id=p.pos_terminal_id
     left join public.staff_profiles sp on sp.user_id=p.registered_by
     where (p.paid_at at time zone 'America/Caracas')::date between p_from and p_to
  ),'[]'::jsonb)
 ) into v_result;
 return v_result;
end $function$
;

CREATE OR REPLACE FUNCTION public.register_official_pos_payment(p_contributor_id uuid, p_assessment_ids uuid[], p_external_reference text, p_bank_code text, p_evidence_path text, p_paid_at timestamp with time zone, p_expected_rate_id uuid, p_expected_total_bs numeric, p_pos_terminal_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_terminal public.pos_terminals%rowtype; v_payment jsonb; v_previous text;
begin
 if auth.uid() is null or not public.has_permission('payments.register') then
   raise exception 'No autorizado a registrar pagos' using errcode='42501';
 end if;
 select * into v_terminal from public.pos_terminals
 where id=p_pos_terminal_id and is_active=true for share;
 if not found then raise exception 'Selecciona un punto de venta municipal activo'; end if;
 if v_terminal.bank_code is distinct from p_bank_code then
   raise exception 'El banco del terminal no coincide con el banco seleccionado';
 end if;
 v_previous:=current_setting('sitmaud.pos_terminal_id',true);
 perform set_config('sitmaud.pos_terminal_id',p_pos_terminal_id::text,true);
 v_payment:=public.register_official_udc_payment(
   p_contributor_id,p_assessment_ids,'punto_venta',p_external_reference,
   p_bank_code,p_evidence_path,p_paid_at,p_expected_rate_id,p_expected_total_bs
 );
 perform set_config('sitmaud.pos_terminal_id',coalesce(v_previous,''),true);
 return v_payment||jsonb_build_object('pos_terminal_id',p_pos_terminal_id,'pos_terminal_code',v_terminal.terminal_code);
end $function$
;
revoke all on function public.enforce_pos_terminal_at_cashier() from public,anon,authenticated;
drop trigger if exists trg_payment_pos_terminal on public.payments;
create trigger trg_payment_pos_terminal before insert on public.payments
for each row execute function public.enforce_pos_terminal_at_cashier();
revoke all on function public.register_official_pos_payment(uuid,uuid[],text,text,text,timestamptz,uuid,numeric,uuid) from public,anon;
grant execute on function public.register_official_pos_payment(uuid,uuid[],text,text,text,timestamptz,uuid,numeric,uuid) to authenticated;
revoke all on function public.get_pos_terminal_report(date,date) from public,anon;
grant execute on function public.get_pos_terminal_report(date,date) to authenticated;
