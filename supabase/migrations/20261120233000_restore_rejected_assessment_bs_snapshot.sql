-- Keep historical Bs debt snapshots when a payment is later rejected.
-- Payment registration recalculates UCD, but rejected bank operations must not
-- permanently rewrite the original pending assessment amount.
create table if not exists private.payment_assessment_prior_amounts (
 payment_id uuid not null references public.payments(id) on delete restrict,
 assessment_id uuid not null references public.assessments(id) on delete restrict,
 base_amount numeric(18,4) not null,
 total_amount numeric(18,4) not null,
 captured_at timestamptz not null default now(),
 primary key(payment_id,assessment_id)
);
alter table private.payment_assessment_prior_amounts enable row level security;
revoke all on private.payment_assessment_prior_amounts from public,anon,authenticated;

do $patch$
declare def text;modified text;
begin
 select pg_get_functiondef(p.oid) into def from pg_proc p
 join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname='register_official_udc_payment_core';
 if def is null or position('-- La modificación se registra en la bitácora automática antes/después.' in def)=0
 then raise exception 'Cannot find assessment repricing location';end if;
 modified:=replace(def,
 '   -- La modificación se registra en la bitácora automática antes/después.',
 '   -- Preserve the original pending Bs amount before repricing for this bank operation.
   insert into private.payment_assessment_prior_amounts
     (payment_id,assessment_id,base_amount,total_amount)
   values(v_payment_id,v_id,v_assessment.base_amount,v_assessment.total_amount);
   -- La modificación se registra en la bitácora automática antes/después.');
 execute modified;
end $patch$;

do $patch$
declare def text;modified text;
begin
 select pg_get_functiondef(p.oid) into def from pg_proc p
 join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname='reject_official_payment';
 if def is null or position('  insert into public.payment_treasury_events' in def)=0
 then raise exception 'Cannot find rejection event location';end if;
 modified:=replace(def,'  insert into public.payment_treasury_events',
 '  -- Return each rejected month to its previously stored Bs reference,
  -- only if there is no other active payment against that assessment.
  update public.assessments a set
    base_amount=old.base_amount,total_amount=old.total_amount
  from private.payment_assessment_prior_amounts old
  where old.payment_id=p_payment_id and old.assessment_id=a.id
    and a.status=''pending''
    and not exists(
      select 1 from public.payment_allocations pa
      join public.payments other_payment on other_payment.id=pa.payment_id
      where pa.assessment_id=a.id and pa.payment_id<>p_payment_id
        and other_payment.status<>''reversed''
    );
  if exists (
    select 1 from private.payment_assessment_prior_amounts old
    join public.assessments a on a.id=old.assessment_id
    where old.payment_id=p_payment_id and a.status<>''pending''
  ) then
    raise exception ''An assessment changed status during rejection: cannot safely restore prior values'';
  end if;
  insert into public.payment_treasury_events');
 execute modified;
end $patch$;