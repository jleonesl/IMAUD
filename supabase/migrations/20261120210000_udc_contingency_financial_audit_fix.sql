-- Financial approvals must use a financial audit record, not the navigation logger.
do $patch$
declare definition text;fixed text;
begin
 select pg_get_functiondef(p.oid) into definition from pg_proc p
 join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname='approve_udc_rate_contingency';
 if definition is null or position('perform public.record_staff_activity(' in definition)=0
 then raise exception 'Unexpected institutional UCD approval function';end if;
 fixed:=replace(definition,
  'perform public.record_staff_activity(''udc_rate_contingency_verified'',''tariffs'',r.id::text);',
  'insert into public.audit_log(actor_user_id,action,entity_table,entity_id,after_data)
    values (auth.uid(),''udc_rate_contingency_verified'',''udc_rates'',r.id,
      jsonb_build_object(''effective_date'',r.effective_date,''value_bs'',r.udc_value,
      ''currency'',r.udc_currency_code,''source_url'',r.source_url,
      ''verification_method'',''manual_official_publication_comparison'',
      ''evidence_notes'',btrim(p_evidence_notes)));');
 if definition=fixed then raise exception 'Could not replace navigation logger in financial approval';end if;
 execute fixed;
end $patch$;
