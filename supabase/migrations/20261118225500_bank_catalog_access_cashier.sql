drop policy if exists "Authorized staff can read payment bank catalog" on public.payment_banks;
create policy "Authorized staff can read payment bank catalog"
on public.payment_banks for select to authenticated
using (
  public.has_permission('payments.read')
  or public.has_permission('payments.register')
);