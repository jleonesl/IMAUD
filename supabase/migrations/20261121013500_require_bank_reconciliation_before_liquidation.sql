-- Reconciliation is mandatory for newly liquidated payments.
-- The internal legacy operation remains callable by the reconciled SECURITY DEFINER
-- wrapper, but no longer directly through the browser's authenticated API role.
revoke execute on function public.liquidate_official_payment(uuid,text) from public,anon,authenticated;
