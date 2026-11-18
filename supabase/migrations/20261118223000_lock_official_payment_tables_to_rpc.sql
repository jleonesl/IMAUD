-- Los cobros oficiales solo pueden mutar a través de funciones SECURITY DEFINER
-- auditables; el navegador conserva lectura autorizada por RLS.
revoke all on table public.payments,public.payment_allocations from anon,authenticated;
grant select on table public.payments,public.payment_allocations to authenticated;
drop policy if exists "payments create authorized" on public.payments;
drop policy if exists "allocations create authorized" on public.payment_allocations;