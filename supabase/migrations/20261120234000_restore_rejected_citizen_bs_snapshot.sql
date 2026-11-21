-- Extend rejected-debt restoration to citizen-submitted UCD payments as well.
-- Both staff and citizen registration must preserve the exact prior Bs obligation.
do $patch$
declare definition text; adjusted text;
begin
 select pg_get_functiondef(p.oid) into definition from pg_proc p
 join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname='register_citizen_udc_payment_core';
 if definition is null or position('-- La modificación se registra en la bitácora automática antes/después.' in definition)=0
 then raise exception 'Cannot locate citizen debt repricing';end if;
 adjusted:=replace(definition,
   '   -- La modificación se registra en la bitácora automática antes/después.',
   '   -- Save the previous debt for restoration if Treasury rejects the submitted payment.
   insert into private.payment_assessment_prior_amounts
     (payment_id,assessment_id,base_amount,total_amount)
   values(v_payment_id,v_id,v_assessment.base_amount,v_assessment.total_amount);
   -- La modificación se registra en la bitácora automática antes/después.');
 execute adjusted;
end $patch$;