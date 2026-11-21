-- Receipt prefixes must reflect the institutional local date in Coro, not UTC server midnight.
do $patch$
declare n text; def text; corrected text;
begin
 foreach n in array array['register_official_udc_payment_core',
   'register_citizen_udc_payment_core','register_official_payment'] loop
   select pg_get_functiondef(p.oid) into def from pg_proc p
     join pg_namespace ns on ns.oid=p.pronamespace
     where ns.nspname='public' and p.proname=n and p.prokind='f';
   if def is null or position('to_char(clock_timestamp(),''YYYYMMDD'')' in def)=0 then
     raise exception 'Expected receipt timestamp not found in %',n;
   end if;
   corrected:=replace(def,'to_char(clock_timestamp(),''YYYYMMDD'')',
     'to_char(clock_timestamp() at time zone ''America/Caracas'',''YYYYMMDD'')');
   execute corrected;
 end loop;
end $patch$;