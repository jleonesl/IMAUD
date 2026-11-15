-- SITMAUD: disable legacy simulation operations without deleting historical records.
-- Applied on live Supabase 2026-11-15 as migration 20261115122541.
-- New official financial workflows MUST be implemented and tested separately.
alter table public.properties disable trigger trg_demo_monthly_obligation_new_property;

do $block$
declare fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and (p.proname like '%demo%' or p.proname='auto_current_month_demo_on_property')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', fn.signature);
  end loop;
end;
$block$;
