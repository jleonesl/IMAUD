-- SITMAUD: Treasury must explicitly match bank, reference and actually credited VES
-- before recognizing a pending payment as liquidated income.
create table if not exists private.payment_bank_reconciliations (
 payment_id uuid primary key references public.payments(id) on delete restrict,
 bank_code text not null,
 external_reference text not null,
 bank_received_bs numeric(18,2) not null check(bank_received_bs>0),
 tax_applied_bs numeric(18,2) not null check(tax_applied_bs>0),
 reconciliation_difference_bs numeric(18,2) not null,
 verified_by uuid not null references auth.users(id),
 verified_at timestamptz not null default now(),
 notes text not null check(length(btrim(notes))>=20)
);
alter table private.payment_bank_reconciliations enable row level security;
revoke all on private.payment_bank_reconciliations from public,anon,authenticated;

create or replace function public.liquidate_official_payment_reconciled(
 p_payment_id uuid, p_bank_code text,p_external_reference text,
 p_confirmed_received_bs numeric,p_treasury_note text
) returns jsonb
language plpgsql security definer set search_path=''
as $fn$
declare p public.payments%rowtype; result jsonb; actual numeric(18,2);
begin
 if auth.uid() is null or not public.has_permission('payments.validate') then
  raise exception 'Sin permiso de Tesorería para liquidar' using errcode='42501';
 end if;
 select * into p from public.payments where id=p_payment_id for update;
 if not found or p.status<>'pending' then raise exception 'Pago no pendiente o inexistente';end if;
 if p.registered_by=auth.uid() then
  raise exception 'El funcionario que registró el pago no puede liquidarlo';
 end if;
 actual:=coalesce(p.received_amount_bs,p.amount);
 if p.currency_code<>'VES' or p.bank_code is null or length(btrim(p.bank_code))=0 then
  raise exception 'No se puede conciliar un pago sin banco ni monto original en VES';
 end if;
 if btrim(coalesce(p_bank_code,''))<>btrim(p.bank_code) then
  raise exception 'El banco indicado no coincide con el banco del pago';
 end if;
 if upper(btrim(coalesce(p_external_reference,'')))<>upper(btrim(coalesce(p.external_reference,'')))
    or length(btrim(coalesce(p_external_reference,'')))<3 then
  raise exception 'La referencia acreditada no coincide con el pago registrado';
 end if;
 if p_confirmed_received_bs is null or p_confirmed_received_bs<>round(p_confirmed_received_bs,2)
    or p_confirmed_received_bs<>actual then
  raise exception 'El monto efectivamente acreditado en bolívares no coincide con el registrado; no liquidar';
 end if;
 if length(btrim(coalesce(p_treasury_note,'')))<20 then
  raise exception 'Tesorería debe documentar la comprobación bancaria (mínimo 20 caracteres)';
 end if;
 result:=public.liquidate_official_payment(p_payment_id,p_treasury_note);
 insert into private.payment_bank_reconciliations
 (payment_id,bank_code,external_reference,bank_received_bs,tax_applied_bs,
 reconciliation_difference_bs,verified_by,notes)
 values(p.id,p.bank_code,p.external_reference,actual,p.amount,
  actual-p.amount,auth.uid(),btrim(p_treasury_note));
 insert into public.audit_log(actor_user_id,action,entity_table,entity_id,after_data)
 values(auth.uid(),'treasury_bank_reconciled','payments',p.id::text,
  jsonb_build_object('receipt_number',p.receipt_number,
  'bank_code',p.bank_code,'reference',p.external_reference,
  'received_bs',actual,'tax_applied_bs',p.amount,
  'difference_bs',actual-p.amount,'pos_terminal_id',p.pos_terminal_id,
  'verified_at',now()));
 return result||jsonb_build_object('received_bs',actual,'tax_applied_bs',p.amount,
 'difference_bs',actual-p.amount,'bank_reconciled',true);
end $fn$;
revoke all on function public.liquidate_official_payment_reconciled(uuid,text,text,numeric,text) from public,anon;
grant execute on function public.liquidate_official_payment_reconciled(uuid,text,text,numeric,text) to authenticated;
