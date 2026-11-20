-- Policy-only change: let authorized collection staff read already-issued
-- official assessments without granting billing / debt-management powers.
create policy "assessments read payments authorized"
on public.assessments for select to authenticated
using (public.has_permission('payments.read') or public.has_permission('payments.register'));

-- Approved residential tariffs are needed for payment readiness.
create policy "approved tariff schedules read payments authorized"
on public.tariff_schedules for select to authenticated
using (is_approved=true
  and (public.has_permission('payments.read') or public.has_permission('payments.register')));
