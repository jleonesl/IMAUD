-- POS: el banco emisor de la tarjeta NO es el banco adquirente del terminal.
-- El terminal sigue vinculado a su banco municipal, tomado exclusivamente de pos_terminals.
alter table public.payments add column if not exists payer_bank_code text
  references public.payment_banks(code);

do $patch$
declare def text;patched text;
begin
 select pg_get_functiondef(p.oid) into def from pg_proc p
 join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
 and p.proname='register_official_pos_received_payment';
 if def is null
   or position('declare v_result jsonb; v_payment_id uuid;v_quote numeric(18,2);' in def)=0
   or position('p_contributor_id,p_assessment_ids,p_external_reference,p_bank_code,p_evidence_path,' in def)=0
 then raise exception 'No coincide la versión del registro POS, se evita modificarlo'; end if;
 patched:=replace(def,
  'declare v_result jsonb; v_payment_id uuid;v_quote numeric(18,2);',
  'declare v_result jsonb; v_payment_id uuid;v_quote numeric(18,2);v_terminal public.pos_terminals%rowtype;');
 patched:=replace(patched,
  ' v_result:=public.register_official_pos_payment(',
  ' -- Banco elegido por el recaudador: emisor de la tarjeta del contribuyente.
  if not exists(select 1 from public.payment_banks b
    where b.code=p_bank_code and b.is_active=true) then
    raise exception ''Selecciona el banco emisor de la tarjeta del contribuyente'';
  end if;
  select * into v_terminal from public.pos_terminals
   where id=p_pos_terminal_id and is_active=true for share;
  if not found then raise exception ''Selecciona un punto de venta municipal activo'';end if;
  if not exists(select 1 from public.payment_banks b
    where b.code=v_terminal.bank_code and b.is_active=true) then
    raise exception ''El banco del terminal no está habilitado'';end if;
  v_result:=public.register_official_pos_payment(');
 patched:=replace(patched,
  'p_contributor_id,p_assessment_ids,p_external_reference,p_bank_code,p_evidence_path,',
  'p_contributor_id,p_assessment_ids,p_external_reference,v_terminal.bank_code,p_evidence_path,');
 patched:=replace(patched,
  'update public.payments set received_amount_bs=p_received_bs where id=v_payment_id;',
  'update public.payments set received_amount_bs=p_received_bs,
    payer_bank_code=p_bank_code where id=v_payment_id;');
 patched:=replace(patched,
  '''currency'',''VES'',''pos_terminal_id'',p_pos_terminal_id',
  '''currency'',''VES'',''pos_terminal_id'',p_pos_terminal_id,
   ''payer_bank_code'',p_bank_code,''terminal_bank_code'',v_terminal.bank_code');
 patched:=replace(patched,
  '''received_bs'',p_received_bs,''excess_bs'',p_received_bs-v_quote);',
  '''received_bs'',p_received_bs,''excess_bs'',p_received_bs-v_quote,
   ''payer_bank_code'',p_bank_code,''terminal_bank_code'',v_terminal.bank_code);');
 if patched=def or position('payer_bank_code=p_bank_code' in patched)=0 or
 position('v_terminal.bank_code,p_evidence_path' in patched)=0 then
   raise exception 'No se completó separación de bancos POS';end if;
 execute patched;
end $patch$;

-- Expose the two banks independently in operational and POS reports.
do $patch$
declare n text;def text;patched text;
begin
 foreach n in array array['get_official_operations_report','get_pos_terminal_report'] loop
  select pg_get_functiondef(p.oid) into def from pg_proc p
  join pg_namespace ns on ns.oid=p.pronamespace where ns.nspname='public' and p.proname=n;
  if def is null then raise exception 'Reporte no encontrado: %',n;end if;
  if n='get_official_operations_report' then
    patched:=replace(def,
     '''bank_code'',p.bank_code,''external_reference'',p.external_reference,',
     '''bank_code'',p.bank_code,''payer_bank_code'',p.payer_bank_code,
      ''external_reference'',p.external_reference,');
  else
    patched:=replace(def,
     '''receipt_number'',p.receipt_number,''reference'',p.external_reference,',
     '''receipt_number'',p.receipt_number,''reference'',p.external_reference,
      ''terminal_bank_code'',t.bank_code,''payer_bank_code'',p.payer_bank_code,');
  end if;
  if patched=def then raise exception 'No se encontró punto de integración en %',n;end if;
  execute patched;
 end loop;
end $patch$;